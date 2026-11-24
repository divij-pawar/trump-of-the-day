# Load testing

Two [k6](https://k6.io) scenarios live in [`loadtest/`](../loadtest/):

- **`http.js`** is a ramping arrival rate (default 300 req/s; set `RATE`) against `/api/news` and `/api/dates/latest`. 80% of requests (`HOT_SHARE`) hit today or yesterday, and the rest spread over the whole archive (~650 days). That spread is what exercises cache misses. Thresholds: under 1% errors, news p95 under 250 ms and p99 under 500 ms.
- **`websocket.js`** ramps to `CONNECTIONS` (default 1,000) concurrent WebSocket clients over 30 s and holds them for `HOLD_SECONDS`. Each client sends an application-level ping every 5 s to measure round-trip time while all of them are connected. Thresholds: p95 connect under 1 s, p95 ping RTT under 100 ms.

```bash
# Local stack
docker compose up --build
k6 run -e RATE=800 loadtest/http.js
k6 run -e CONNECTIONS=2000 loadtest/websocket.js   # -e ORIGIN=… must be in the API's WS_ALLOWED_ORIGINS (default http://localhost:5173)
# while it runs, measure fan-out to every client:
docker compose exec redis redis-cli PUBLISH news_updated 2025-03-01

# Deployed stack (through CloudFront). Raise RATE_LIMIT_MAX first or every request after the first 300/min is a 429.
k6 run -e BASE_URL=https://dxxxx.cloudfront.net loadtest/http.js
```

## Results

### 2026-11-10: API layer against a stub database

**Setup.** This run used the real API app: Fastify routes, validation, rate limiter and WebSocket hub, from [`api/test/stub-server.ts`](../api/test/stub-server.ts). The database was replaced by a stub that models the production pg pool: at most **10 queries in flight, 15 ms each**. Each `/api/news` miss costs two queries (stories and brief). The cache was an in-process cache with the same single-flight contract as the Redis one. Everything ran on one Linux workstation with Node 22 and k6 v1.0.0.

**What this covers.** Concurrency behavior of the API process, the effect of caching and single-flight against a pool-limited database, and WebSocket fan-out. **What it doesn't cover:** real Postgres query plans, the Redis network hop, and the ALB/CloudFront path. Rerun against `docker compose` and against the deployed stack to get those numbers.

#### HTTP, 800 req/s target for 45 s (after a 30 s ramp)

| Cache | Requests served | Throughput reached | Dropped iterations | News p50 | News p95 | News p99 | Errors | DB queries |
|---|---|---|---|---|---|---|---|---|
| none | 27,441 | 320 req/s (capped) | 24,709 | 2,882 ms | 2,927 ms | 2,935 ms | 0% | ~48,000 |
| single-flight cache | 52,150 | 800 req/s (full plateau) | 0 | 0.6 ms | 1.1 ms | 15.9 ms | 0% | 1,326 |

Without a cache, throughput is capped at what the pool allows: 10 connections ÷ 15 ms ÷ 2 queries per request ≈ 333 req/s. Every request beyond that queues, and latency climbs to the length of the queue, about 2.9 s. k6 couldn't start more than half the planned iterations. With the cache, 97% fewer queries reach the database. They're the first request for each date, plus one per date per TTL. p99 stays at about one query's latency, because single-flight means concurrent misses for a date wait on one query instead of each issuing their own.

#### WebSockets, 2,000 concurrent connections held for 45 s, a broadcast every 10 s

| Metric | Result |
|---|---|
| Concurrent clients on the one API process | 2,000 (server-side count) |
| Sessions | 2,000, 0 failed checks |
| Connect time | p50 1.2 ms, p95 1.6 ms, p99 6.8 ms |
| Ping round trip with all 2,000 connected | p50 < 1 ms, p95 1 ms, p99 2 ms, max 80 ms |
| `news_updated` broadcasts delivered | 13,912 (about 7 broadcasts × 2,000 clients; fewer during ramp-up and ramp-down) |

### Sizing notes

- The ALB scales tasks out at 1,000 requests per target per minute (`ecs.tf`), well below what one task handled above. Redis adds a sub-millisecond hop per request.
- WebSocket clients are per task and each task broadcasts only to its own clients, so capacity grows linearly with task count. The ALB keeps connections alive with the server's 30 s pings (idle timeout 120 s).
