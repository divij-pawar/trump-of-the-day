import { pino } from "pino";
import { buildApp, handleNewsUpdated } from "./app.js";
import { MemoryCache, RedisCache, type Cache } from "./cache.js";
import { loadConfig } from "./config.js";
import { PgNewsRepository } from "./db.js";
import { voyageEmbedder } from "./embeddings.js";
import { NewsListener } from "./live.js";

const config = loadConfig();
const log = pino({ level: config.logLevel });

const repo = new PgNewsRepository(config.databaseUrl);
const redisCache = config.redisUrl ? new RedisCache(config.redisUrl, log) : undefined;
const cache: Cache = redisCache ?? new MemoryCache();
if (!redisCache) log.info("REDIS_URL not set; using an in-process cache");

let listener: NewsListener | undefined;

const { app, hub } = await buildApp(
  {
    repo,
    cache,
    embedder: config.voyageApiKey ? voyageEmbedder(config.voyageApiKey) : undefined,
    rateLimitRedis: redisCache?.client,
    rateLimitMax: config.rateLimitMax,
    originVerifySecret: config.originVerifySecret,
    liveStatus: () => listener?.connected ?? false,
  },
  {
    loggerInstance: log,
    // Behind CloudFront -> ALB the real client address is this many hops back in
    // X-Forwarded-For; trusting the leftmost entry would let clients spoof it and
    // dodge the rate limit.
    trustProxy: (_addr: string, hop: number) => hop < config.trustProxyHops,
  },
);

if (config.databaseUrlDirect) {
  listener = new NewsListener(
    config.databaseUrlDirect,
    (date) => handleNewsUpdated(date, cache, hub),
    log,
  );
  await listener.start();
} else {
  log.warn("DATABASE_URL_DIRECT not set; live updates disabled");
}

const shutdown = async (signal: string) => {
  log.info({ signal }, "shutting down");
  await app.close();
  await listener?.stop();
  await cache.close();
  await repo.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: config.port, host: config.host });
