import { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";

export interface Cache {
  /**
   * Return the cached value for `key`, or run `load`, cache its result for
   * `ttlSeconds`, and return it. Concurrent misses for the same key within this
   * process share one `load` call, so a burst of traffic on a cold key turns into
   * a single database query instead of one per request (cache stampede).
   */
  getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;
  del(...keys: string[]): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Redis-backed cache that degrades to pass-through: if Redis is down or slow,
 * requests still get served from Postgres rather than failing.
 */
export class RedisCache implements Cache {
  private readonly inflight = new Map<string, Promise<unknown>>();
  readonly client: Redis;

  constructor(
    url: string,
    private readonly log: FastifyBaseLogger,
  ) {
    this.client = new Redis(url, {
      // Don't queue commands while disconnected; error out and fall through to the DB.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 500,
      lazyConnect: false,
    });
    this.client.on("error", (err: Error) => this.log.warn({ err }, "redis error"));
  }

  async getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.client.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      this.log.warn({ err, key }, "cache read failed, falling through");
    }

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await load();
        try {
          await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
        } catch (err) {
          this.log.warn({ err, key }, "cache write failed");
        }
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.log.warn({ err, keys }, "cache delete failed");
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    this.client.disconnect();
  }
}

/**
 * In-process cache for running without Redis, e.g. on Cloud Run where the CDN in
 * front (Firebase Hosting) is the main cache and paying for a managed Redis isn't
 * worth it. Entries live only as long as the instance, which is fine: a cold
 * instance just reloads from Postgres. Same single-flight contract as RedisCache.
 * Bounded so arbitrary search queries can't grow it without limit; the oldest
 * entry is evicted first.
 */
export class MemoryCache implements Cache {
  private readonly store = new Map<string, { value: unknown; expires: number }>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 1_000) {}

  async getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.store.delete(key);
        this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
        if (this.store.size > this.maxEntries) {
          const oldest = this.store.keys().next().value;
          if (oldest !== undefined) this.store.delete(oldest);
        }
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key);
  }

  /** Reported as not-Redis in /readyz. */
  async ping(): Promise<boolean> {
    return false;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

/** No-op cache, for measuring the API with no caching at all (load tests). */
export class NoCache implements Cache {
  async getOrSet<T>(_key: string, _ttl: number, load: () => Promise<T>): Promise<T> {
    return load();
  }
  async del(): Promise<void> {}
  async ping(): Promise<boolean> {
    return false;
  }
  async close(): Promise<void> {}
}
