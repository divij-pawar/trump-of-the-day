/**
 * The real API app (routes, validation, rate limiter, WebSocket hub) on top of a
 * stub repository, for exercising the k6 scripts without Postgres or Redis.
 *
 * The stub models a pg pool: at most POOL_SIZE queries in flight, each taking
 * QUERY_MS. CACHE=memory adds an in-process cache with the same single-flight
 * contract as RedisCache (src/cache.ts MemoryCache); CACHE=none sends every request to the "database".
 *
 *   CACHE=memory npx tsx test/stub-server.ts
 *   NOTIFY_EVERY_MS=10000 ... broadcasts a news_updated to all clients periodically.
 */
import { buildApp, handleNewsUpdated } from "../src/app.js";
import { MemoryCache, NoCache, type Cache } from "../src/cache.js";
import type { NewsItem, NewsRepository } from "../src/db.js";

const POOL_SIZE = Number(process.env.POOL_SIZE ?? 10);
const QUERY_MS = Number(process.env.QUERY_MS ?? 15);
let active = 0;
const waiting: (() => void)[] = [];
let queries = 0;

async function query<T>(result: () => T): Promise<T> {
  if (active >= POOL_SIZE) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  queries++;
  try {
    await new Promise((r) => setTimeout(r, QUERY_MS));
    return result();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const items = (date: string): NewsItem[] =>
  Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    date,
    title: `Stub headline ${i + 1} for ${date}`,
    description: "Stub description ".repeat(8),
    link: `https://example.com/${date}/${i + 1}`,
    news_source: "example.com",
    image_url: null,
    relevance_score: 40 - i,
  }));

const repo: NewsRepository = {
  ping: () => query(() => undefined),
  newsByDate: (date) => query(() => items(date)),
  digestByDate: (date) => query(() => ({
    date,
    summary: "Stub digest.",
    paragraphs: [[{ text: "Stub digest.", story_ids: [1, 2] }]],
    top_story_ids: [1, 2],
    model: "stub",
  })),
  latestDate: () => query(() => new Date().toISOString().slice(0, 10)),
  similarTo: () => query(() => []),
  searchByEmbedding: () => query(() => []),
  close: async () => {},
};

const cache: Cache = process.env.CACHE === "memory" ? new MemoryCache() : new NoCache();
const { app, hub } = await buildApp(
  { repo, cache, rateLimitMax: 1_000_000_000, liveStatus: () => true },
  { logger: { level: "warn" } },
);

const notifyEvery = Number(process.env.NOTIFY_EVERY_MS ?? 0);
if (notifyEvery > 0) {
  setInterval(() => void handleNewsUpdated(new Date().toISOString().slice(0, 10), cache, hub), notifyEvery);
}

setInterval(() => {
  console.log(JSON.stringify({ wsClients: hub.size, dbQueries: queries, poolWaiting: waiting.length }));
}, 10_000).unref();

await app.listen({ port: Number(process.env.PORT ?? 8080), host: "127.0.0.1" });
console.log(`stub API on :${process.env.PORT ?? 8080} (cache=${process.env.CACHE ?? "none"}, pool=${POOL_SIZE}, query=${QUERY_MS}ms)`);
