import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";

export type ServerMessage =
  | { type: "hello"; clients: number }
  | { type: "news_updated"; date: string }
  | { type: "pong"; t: number };

const HEARTBEAT_MS = 30_000;

/** Close code for a connection that reached its maximum lifetime; clients reconnect. */
export const MAX_LIFETIME_CLOSE_CODE = 4000;

/**
 * Tracks this replica's WebSocket clients. Pings every 30s both to drop dead
 * connections and to keep the ALB/CloudFront idle timeouts from closing quiet ones.
 */
export class LiveHub {
  private readonly clients = new Set<WebSocket>();
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly heartbeat: NodeJS.Timeout;

  /**
   * @param maxLifetimeMs close each connection after this long (0 = never). On
   *   Cloud Run an open WebSocket is an in-flight request, billed for as long as
   *   it lasts, so production caps it and lets visible tabs reconnect.
   */
  constructor(
    private readonly log: FastifyBaseLogger,
    private readonly maxLifetimeMs = 0,
  ) {
    this.heartbeat = setInterval(() => this.sweep(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  get size(): number {
    return this.clients.size;
  }

  add(socket: WebSocket): void {
    this.clients.add(socket);
    this.alive.set(socket, true);
    socket.on("pong", () => this.alive.set(socket, true));
    const lifetime =
      this.maxLifetimeMs > 0
        ? setTimeout(() => {
            socket.close(MAX_LIFETIME_CLOSE_CODE, "max lifetime reached");
            // Stop counting it now rather than after the close handshake completes.
            this.clients.delete(socket);
          }, this.maxLifetimeMs)
        : undefined;
    lifetime?.unref();
    socket.on("close", () => {
      clearTimeout(lifetime);
      this.clients.delete(socket);
    });
    socket.on("error", (err) => this.log.debug({ err }, "websocket error"));
    socket.on("message", (raw) => {
      // The only client message is an application-level ping, used by the load
      // test to measure round-trip latency through CloudFront and the ALB.
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; t?: number };
        if (msg.type === "ping") this.send(socket, { type: "pong", t: Number(msg.t) || 0 });
      } catch {
        // ignore malformed input
      }
    });
    this.send(socket, { type: "hello", clients: this.clients.size });
  }

  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const socket of this.clients) {
      if (socket.readyState === socket.OPEN) socket.send(data);
    }
    this.log.info({ type: message.type, clients: this.clients.size }, "broadcast");
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  }

  private sweep(): void {
    for (const socket of this.clients) {
      if (!this.alive.get(socket)) {
        socket.terminate();
        this.clients.delete(socket);
        continue;
      }
      this.alive.set(socket, false);
      socket.ping();
    }
  }

  close(): void {
    clearInterval(this.heartbeat);
    for (const socket of this.clients) socket.close(1001, "server shutting down");
    this.clients.clear();
  }
}
