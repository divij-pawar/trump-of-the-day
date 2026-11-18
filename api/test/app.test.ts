import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp, cacheKeys, handleNewsUpdated, newsTtlSeconds } from "../src/app.js";
import type { Cache } from "../src/cache.js";
import type { Digest, NewsItem, NewsRepository, SimilarItem } from "../src/db.js";

const item = (id: number, date = "2025-03-01"): NewsItem => ({
  id,
  date,
  title: `Story ${id}`,
  description: "desc",
  link: `https://example.com/${id}`,
  news_source: "example.com",
  image_url: null,
  relevance_score: 1,
});

function fakeRepo(overrides: Partial<NewsRepository> = {}): NewsRepository {
  return {
    ping: vi.fn(async () => {}),
    newsByDate: vi.fn(async (date: string) => [item(1, date), item(2, date)]),
    digestByDate: vi.fn(async (date: string): Promise<Digest | null> => ({
      date,
      summary: "A busy day.",
      paragraphs: [[{ text: "A busy day.", story_ids: [1, 2] }]],
      top_story_ids: [1],
      model: "claude-opus-5-5",
    })),
    latestDate: vi.fn(async () => "2025-03-01"),
    similarTo: vi.fn(async (): Promise<SimilarItem[] | null> => [{ ...item(3), distance: 0.1 }]),
    searchByEmbedding: vi.fn(async (): Promise<SimilarItem[]> => [{ ...item(4), distance: 0.2 }]),
    close: vi.fn(async () => {}),
    ...overrides,
  };
}

/** In-memory Cache with the same single-flight contract as RedisCache. */
class MemoryCache implements Cache {
  store = new Map<string, unknown>();
  ttls = new Map<string, number>();
  private inflight = new Map<string, Promise<unknown>>();
  async getOrSet<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    if (this.store.has(key)) return this.store.get(key) as T;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;
    const p = load().then((v) => {
      this.store.set(key, v);
      this.ttls.set(key, ttl);
      this.inflight.delete(key);
      return v;
    });
    this.inflight.set(key, p);
    return p;
  }
  async del(...keys: string[]) {
    keys.forEach((k) => this.store.delete(k));
  }
  async ping() {
    return true;
  }
  async close() {}
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function setup(deps: Partial<Parameters<typeof buildApp>[0]> = {}) {
  const repo = deps.repo ?? fakeRepo();
  const cache = deps.cache ?? new MemoryCache();
  const built = await buildApp({ repo, cache, now: () => new Date("2025-03-10T12:00:00Z"), ...deps });
  app = built.app;
  return { app: built.app, hub: built.hub, repo, cache };
}

describe("newsTtlSeconds", () => {
  const now = new Date("2025-03-10T01:00:00Z");
  it("uses a short TTL for today and yesterday (UTC)", () => {
    expect(newsTtlSeconds("2025-03-10", now)).toBe(60);
    expect(newsTtlSeconds("2025-03-09", now)).toBe(60);
  });
  it("caches older days for a day", () => {
    expect(newsTtlSeconds("2025-03-08", now)).toBe(86_400);
  });
});

describe("health", () => {
  it("/healthz has no dependencies", async () => {
    const repo = fakeRepo({ ping: vi.fn(async () => Promise.reject(new Error("down"))) });
    const { app } = await setup({ repo });
    const res = await app.inject("/healthz");
    expect(res.statusCode).toBe(200);
  });

  it("/readyz fails when the database is down", async () => {
    const repo = fakeRepo({ ping: vi.fn(async () => Promise.reject(new Error("down"))) });
    const { app } = await setup({ repo });
    const res = await app.inject("/readyz");
    expect(res.statusCode).toBe(503);
    expect(res.json().checks.db).toBe(false);
  });

  it("/readyz passes when the database is up", async () => {
    const { app } = await setup();
    const res = await app.inject("/readyz");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ready", checks: { db: true, redis: true } });
  });
});

describe("GET /api/news", () => {
  it("returns items and the digest for a date", async () => {
    const { app } = await setup();
    const res = await app.inject("/api/news?date=2025-03-01");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.digest.summary).toBe("A busy day.");
    expect(body.digest.paragraphs).toEqual([[{ text: "A busy day.", story_ids: [1, 2] }]]);
  });

  it("rejects malformed dates", async () => {
    const { app } = await setup();
    expect((await app.inject("/api/news?date=03-01-2025")).statusCode).toBe(400);
    expect((await app.inject("/api/news")).statusCode).toBe(400);
  });

  it("serves repeat requests from cache", async () => {
    const { app, repo, cache } = await setup();
    await app.inject("/api/news?date=2025-03-01");
    await app.inject("/api/news?date=2025-03-01");
    expect(repo.newsByDate).toHaveBeenCalledTimes(1);
    expect((cache as MemoryCache).ttls.get(cacheKeys.news("2025-03-01"))).toBe(86_400);
  });

  it("collapses concurrent cold misses into one query", async () => {
    const { app, repo } = await setup();
    await Promise.all(Array.from({ length: 20 }, () => app.inject("/api/news?date=2025-03-02")));
    expect(repo.newsByDate).toHaveBeenCalledTimes(1);
  });

  it("returns 503 rather than leaking errors when the database fails", async () => {
    const repo = fakeRepo({ newsByDate: vi.fn(async () => Promise.reject(new Error("secret detail"))) });
    const { app } = await setup({ repo });
    const res = await app.inject("/api/news?date=2025-03-01");
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain("secret detail");
  });
});

describe("similar and search", () => {
  it("404s for an unknown article", async () => {
    const repo = fakeRepo({ similarTo: vi.fn(async () => null) });
    const { app } = await setup({ repo });
    expect((await app.inject("/api/news/999/similar")).statusCode).toBe(404);
  });

  it("returns similar articles", async () => {
    const { app } = await setup();
    const res = await app.inject("/api/news/1/similar");
    expect(res.json().items[0].id).toBe(3);
  });

  it("503s when no embedder is configured", async () => {
    const { app } = await setup();
    expect((await app.inject("/api/search?q=tariffs")).statusCode).toBe(503);
  });

  it("embeds the normalized query and searches", async () => {
    const embedder = vi.fn(async () => [0.1, 0.2]);
    const { app, repo } = await setup({ embedder });
    const res = await app.inject("/api/search?q=%20Tariffs%20");
    expect(res.statusCode).toBe(200);
    expect(embedder).toHaveBeenCalledWith("tariffs");
    expect(repo.searchByEmbedding).toHaveBeenCalledWith([0.1, 0.2], 10);
  });
});

describe("origin verification", () => {
  it("rejects API requests without the CloudFront header but allows health checks", async () => {
    const { app } = await setup({ originVerifySecret: "s3cret" });
    expect((await app.inject("/api/dates/latest")).statusCode).toBe(403);
    expect((await app.inject("/healthz")).statusCode).toBe(200);
    const ok = await app.inject({ url: "/api/dates/latest", headers: { "x-origin-verify": "s3cret" } });
    expect(ok.statusCode).toBe(200);
  });
});

describe("rate limiting", () => {
  it("returns 429 past the per-minute limit", async () => {
    const { app } = await setup({ rateLimitMax: 2 });
    await app.inject("/api/dates/latest");
    await app.inject("/api/dates/latest");
    const res = await app.inject("/api/dates/latest");
    expect(res.statusCode).toBe(429);
  });
});

describe("handleNewsUpdated", () => {
  it("invalidates the date and broadcasts", async () => {
    const { hub, cache } = await setup();
    const mem = cache as MemoryCache;
    mem.store.set(cacheKeys.news("2025-03-10"), {});
    mem.store.set(cacheKeys.latestDate(), "2025-03-09");
    const broadcast = vi.spyOn(hub, "broadcast");
    await handleNewsUpdated("2025-03-10", cache, hub);
    expect(mem.store.size).toBe(0);
    expect(broadcast).toHaveBeenCalledWith({ type: "news_updated", date: "2025-03-10" });
  });
});

describe("MemoryCache", () => {
  it("caches until the TTL expires and shares concurrent loads", async () => {
    const { MemoryCache } = await import("../src/cache.js");
    const cache = new MemoryCache();
    const load = vi.fn(async () => "v");
    await Promise.all([cache.getOrSet("k", 60, load), cache.getOrSet("k", 60, load)]);
    expect(await cache.getOrSet("k", 60, load)).toBe("v");
    expect(load).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    await cache.getOrSet("k", 60, load);
    vi.useRealTimers();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entry past its size bound", async () => {
    const { MemoryCache } = await import("../src/cache.js");
    const cache = new MemoryCache(2);
    const load = vi.fn(async () => 1);
    await cache.getOrSet("a", 60, load);
    await cache.getOrSet("b", 60, load);
    await cache.getOrSet("c", 60, load);
    await cache.getOrSet("a", 60, load);
    expect(load).toHaveBeenCalledTimes(4);
  });
});
