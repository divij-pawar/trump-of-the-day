import pg from "pg";
import { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";

/**
 * Channel the pipeline announces a processed day on (payload: "YYYY-MM-DD"): a
 * Postgres NOTIFY channel and, under the same name, a Redis pub/sub channel.
 */
export const NEWS_CHANNEL = "news_updated";

export type NewsUpdatedHandler = (date: string) => void | Promise<void>;

/** Where this replica hears about pipeline updates from. */
export interface UpdateSource {
  readonly connected: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const DATE_PAYLOAD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Subscribes to the pipeline's Redis pub/sub channel. Every replica subscribes, so
 * one PUBLISH reaches all of them and each pushes to its own WebSocket clients:
 * the usual way to fan WebSocket messages out across horizontally scaled servers.
 * Unlike Postgres LISTEN it doesn't hold a database connection open, so a
 * serverless database (Neon) can still scale to zero.
 *
 * Subscriber mode needs its own connection; ioredis reconnects and resubscribes
 * on its own.
 */
export class RedisNewsSubscriber implements UpdateSource {
  private client: Redis | null = null;

  constructor(
    private readonly url: string,
    private readonly onUpdate: NewsUpdatedHandler,
    private readonly log: FastifyBaseLogger,
  ) {}

  get connected(): boolean {
    return this.client?.status === "ready";
  }

  async start(): Promise<void> {
    const client = new Redis(this.url, { maxRetriesPerRequest: null, connectTimeout: 5_000 });
    client.on("error", (err: Error) => this.log.warn({ err }, "redis subscriber error"));
    client.on("message", (channel: string, payload: string) => {
      if (channel !== NEWS_CHANNEL || !DATE_PAYLOAD.test(payload)) return;
      Promise.resolve(this.onUpdate(payload)).catch((err) =>
        this.log.error({ err }, "news update handler failed"),
      );
    });
    this.client = client;
    try {
      await client.subscribe(NEWS_CHANNEL);
      this.log.info("subscribed to news updates (redis)");
    } catch (err) {
      // ioredis keeps retrying and resubscribes once connected.
      this.log.warn({ err }, "redis subscribe failed; will retry");
    }
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client) await client.quit().catch(() => client.disconnect());
  }
}

/**
 * Holds one dedicated (non-pooled) connection that LISTENs for pipeline updates,
 * reconnecting with backoff if it drops. Every API replica runs its own listener,
 * so each one invalidates its cache keys and pushes to its own WebSocket clients
 * without needing a separate fan-out channel.
 */
export class NewsListener implements UpdateSource {
  private client: pg.Client | null = null;
  private stopped = false;
  private retryDelayMs = 1_000;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly onUpdate: NewsUpdatedHandler,
    private readonly log: FastifyBaseLogger,
  ) {}

  get connected(): boolean {
    return this.client !== null;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({ connectionString: this.connectionString });
    client.on("notification", (msg) => {
      if (msg.channel !== NEWS_CHANNEL || !msg.payload || !DATE_PAYLOAD.test(msg.payload)) return;
      Promise.resolve(this.onUpdate(msg.payload)).catch((err) =>
        this.log.error({ err }, "news update handler failed"),
      );
    });
    client.on("error", (err) => {
      this.log.warn({ err }, "LISTEN connection error");
      this.scheduleReconnect(client);
    });
    client.on("end", () => this.scheduleReconnect(client));

    try {
      await client.connect();
      await client.query(`LISTEN ${NEWS_CHANNEL}`);
      this.client = client;
      this.retryDelayMs = 1_000;
      this.log.info("listening for news updates");
    } catch (err) {
      this.log.warn({ err }, "LISTEN connection failed");
      this.scheduleReconnect(client);
    }
  }

  private scheduleReconnect(client: pg.Client): void {
    if (this.client === client) this.client = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    if (this.stopped || this.retryTimer) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, 60_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const client = this.client;
    this.client = null;
    if (client) {
      client.removeAllListeners();
      await client.end().catch(() => {});
    }
  }
}
