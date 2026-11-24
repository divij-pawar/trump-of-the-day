import { createHash } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { Redis } from "ioredis";
import type { Cache } from "./cache.js";
import type { NewsRepository } from "./db.js";
import type { Embedder } from "./embeddings.js";
import { LiveHub } from "./hub.js";

export interface AppDeps {
  repo: NewsRepository;
  cache: Cache;
  embedder?: Embedder;
  /** Shared Redis connection for rate-limit counters across replicas; omit to keep them in memory. */
  rateLimitRedis?: Redis;
  rateLimitMax?: number;
  originVerifySecret?: string;
  /** Overridable clock so cache-TTL decisions are testable. */
  now?: () => Date;
  /** Reports whether the live-update source (Redis pub/sub or Postgres LISTEN) is connected, for /readyz. */
  liveStatus?: () => boolean;
  /** Close WebSockets after this many seconds (0 or unset = never). */
  wsMaxSeconds?: number;
  /** Origins allowed to open /ws; unset allows any. */
  wsAllowedOrigins?: string[];
}

export const NEWS_PAGE_LIMIT = 100;
const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const cacheKeys = {
  // v2: the digest gained `paragraphs` (sentence citations).
  news: (date: string) => `news:v2:${date}`,
  latestDate: () => "latest-date:v1",
  similar: (id: number) => `similar:v1:${id}`,
  search: (q: string, limit: number) =>
    `search:v1:${limit}:${createHash("sha256").update(q).digest("hex").slice(0, 32)}`,
};

/** YYYY-MM-DD for a Date in UTC, the day boundary the pipeline scrapes by. */
export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Days that may still receive inserts (today and yesterday, UTC) get a short TTL;
 * anything older is effectively immutable, so cache it for a day. Pipeline NOTIFYs
 * also invalidate a date's key directly, so the short TTL is only a backstop.
 */
export function newsTtlSeconds(date: string, now: Date): number {
  const yesterday = utcDate(new Date(now.getTime() - 86_400_000));
  return date >= yesterday ? 60 : 86_400;
}

export async function buildApp(
  deps: AppDeps,
  opts: FastifyServerOptions = {},
): Promise<{ app: FastifyInstance; hub: LiveHub }> {
  const app = Fastify(opts);
  const now = deps.now ?? (() => new Date());
  const hub = new LiveHub(app.log, (deps.wsMaxSeconds ?? 0) * 1_000);

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err.validation) {
      return reply.status(400).send({ error: "bad_request", message: err.message });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({ error: "rate_limited", message: err.message });
    }
    req.log.error({ err }, "request failed");
    return reply.status(503).send({ error: "unavailable", message: "Upstream data source is unavailable" });
  });

  // CloudFront adds this header on its way to the ALB; anything without it came
  // around CloudFront (straight at the ALB) and is refused. Health checks are
  // exempt because the ALB itself sends them.
  if (deps.originVerifySecret) {
    const secret = deps.originVerifySecret;
    app.addHook("onRequest", async (req, reply) => {
      if (req.url === "/healthz" || req.url === "/livez" || req.url === "/readyz") return;
      if (req.headers["x-origin-verify"] !== secret) {
        return reply.status(403).send({ error: "forbidden" });
      }
    });
  }

  await app.register(rateLimit, {
    max: deps.rateLimitMax ?? 300,
    timeWindow: "1 minute",
    redis: deps.rateLimitRedis,
    nameSpace: "ratelimit:",
    // A Redis outage shouldn't turn into an API outage.
    skipOnError: true,
  });
  await app.register(websocket, { options: { maxPayload: 1024 } });

  // Cloud Run's front end answers /healthz itself with a 404 for outside requests (only
  // its own probes reach the container), so /livez is the same check for the uptime
  // check and the deploy smoke test.
  const live = async () => ({ status: "ok" });
  app.get("/healthz", { config: { rateLimit: false } }, live);
  app.get("/livez", { config: { rateLimit: false } }, live);

  app.get("/readyz", { config: { rateLimit: false } }, async (_req, reply) => {
    const [db, redis] = await Promise.all([
      deps.repo.ping().then(
        () => true,
        () => false,
      ),
      deps.cache.ping(),
    ]);
    const body = {
      status: db ? "ready" : "not_ready",
      checks: { db, redis, live: deps.liveStatus?.() ?? false },
      websocketClients: hub.size,
    };
    // Only the database is required to serve traffic; Redis and LISTEN degrade gracefully.
    return reply.status(db ? 200 : 503).send(body);
  });

  app.get<{ Querystring: { date: string } }>(
    "/api/news",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["date"],
          properties: { date: { type: "string", pattern: DATE_PATTERN } },
        },
      },
    },
    async (req, reply) => {
      const { date } = req.query;
      const ttl = newsTtlSeconds(date, now());
      const body = await deps.cache.getOrSet(cacheKeys.news(date), ttl, async () => {
        const [items, digest] = await Promise.all([
          deps.repo.newsByDate(date, NEWS_PAGE_LIMIT),
          deps.repo.digestByDate(date),
        ]);
        return { date, digest, items };
      });
      reply.header("Cache-Control", `public, max-age=${Math.min(ttl, 300)}`);
      return body;
    },
  );

  app.get("/api/dates/latest", async (_req, reply) => {
    const date = await deps.cache.getOrSet(cacheKeys.latestDate(), 60, () => deps.repo.latestDate());
    reply.header("Cache-Control", "public, max-age=60");
    return { date };
  });

  app.get<{ Params: { id: number } }>(
    "/api/news/:id/similar",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "integer", minimum: 1 } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const items = await deps.cache.getOrSet(cacheKeys.similar(id), 3_600, () =>
        deps.repo.similarTo(id, 5),
      );
      if (items === null) return reply.status(404).send({ error: "not_found" });
      return { id, items };
    },
  );

  app.get<{ Querystring: { q: string; limit?: number } }>(
    "/api/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 2, maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!deps.embedder) {
        return reply.status(503).send({ error: "search_disabled", message: "Semantic search is not configured" });
      }
      const embed = deps.embedder;
      const q = req.query.q.trim().toLowerCase();
      const limit = req.query.limit ?? 10;
      const items = await deps.cache.getOrSet(cacheKeys.search(q, limit), 600, async () =>
        deps.repo.searchByEmbedding(await embed(q), limit),
      );
      return { q, items };
    },
  );

  // Browsers connect to /ws cross-origin (the site's host has no WebSocket proxy),
  // so check Origin: browsers always send it, and it stops other sites' pages from
  // holding connections open on this API's bill.
  const allowedOrigins = deps.wsAllowedOrigins && new Set(deps.wsAllowedOrigins);
  app.get(
    "/ws",
    {
      websocket: true,
      preValidation: async (req, reply) => {
        if (allowedOrigins && !allowedOrigins.has(req.headers.origin ?? "")) {
          return reply.status(403).send({ error: "forbidden_origin" });
        }
      },
    },
    (socket) => hub.add(socket),
  );

  app.addHook("onClose", async () => hub.close());

  return { app, hub };
}

/** Called for each pipeline update (Redis message or Postgres NOTIFY): drop stale cache entries, then tell connected browsers. */
export async function handleNewsUpdated(date: string, cache: Cache, hub: LiveHub): Promise<void> {
  await cache.del(cacheKeys.news(date), cacheKeys.latestDate());
  hub.broadcast({ type: "news_updated", date });
}
