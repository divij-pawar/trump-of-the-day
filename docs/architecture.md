# Architecture

> **Two deployments.** The live site runs on **GCP**: Firebase Hosting in front of Cloud Run, no Redis, no WebSockets, about $0/month. The request path below describes the **AWS** stack, which is kept in Terraform and brought up on demand. The application code is the same for both; only the hosting differs ([infrastructure.md](infrastructure.md), [costs.md](costs.md)).

## Request path

1. The browser loads the SPA from **CloudFront**, which reads it from a private **S3** bucket (origin access control; the bucket has no public access).
2. `/api/*` and `/ws` on the same CloudFront distribution go to an **Application Load Balancer**. CloudFront adds a secret `X-Origin-Verify` header, and the ALB only forwards requests that carry it. Its security group only admits CloudFront's origin-facing IP ranges. The API checks the header too, so the ALB can't be used to get around CloudFront's caching or the rate limit.
3. The ALB spreads requests over two or more **Fastify** tasks on **ECS Fargate**, across two availability zones.
4. Each task serves from **Redis** where it can and reads **Neon Postgres** through a pooled, read-only connection (`news_readonly`, `SELECT` on `news` and `daily_digest` only) where it can't.

Same-origin routing means the frontend needs no CORS configuration and no API URL at build time, and the visitor only ever sees CloudFront.

## Data path

The pipeline (the `trump-of-the-day-server` submodule) runs daily on GitHub Actions at 14:00 UTC and processes yesterday and today:

1. Scrape GDELT and Google News RSS. Deduplicate, drop non-Latin-script headlines, and fetch descriptions and thumbnails from the article pages.
2. Score each article for relevance (`lib/relevance.py`) and insert. A `UNIQUE (link)` constraint with `ON CONFLICT DO NOTHING` makes re-running a day add only new stories.
3. For each day: embed new rows with Voyage (`voyage-3.5`, 1024 dimensions, stored in pgvector), have an LLM write the daily brief from the top 40 stories (OpenRouter's Free Router `openrouter/free` by default, which picks an available free model; Claude via `DIGEST_PROVIDER=anthropic`). The brief comes back sentence by sentence, each sentence with the ids of the stories it cites (`daily_digest.paragraphs`), which the site turns into numbered links to the story cards. The model that wrote it is stored with the brief and shown on the site. Then `NOTIFY news_updated, '<date>'`.

## Caching

There are three layers, from the browser inward:

| Layer | What | TTL |
|---|---|---|
| CloudFront | `/api/*` responses, keyed on the query string, honoring the API's `Cache-Control` | 60 s for today and yesterday (UTC), 5 min for older days |
| Redis | Full `/api/news` response per date; latest date; related stories; search results | 60 s for today and yesterday, 24 h for older days (they don't change) |
| Single-flight | Concurrent cache misses for the same key in one task share one database query | per request |

The API invalidates instead of only waiting for TTLs. Each task holds one direct (non-pooled) Postgres connection that `LISTEN`s on `news_updated`. When the pipeline notifies, every task deletes that date's Redis key and the latest-date key, then pushes `{"type":"news_updated","date":...}` to its WebSocket clients. Open pages showing that date refetch with `cache: "no-cache"`, so the browser's own HTTP cache (the API sends `max-age` up to 5 minutes) can't answer with the old copy. CloudFront can still serve the previous response for up to 60 s.

The listener has to use a direct connection: Neon's `-pooler` endpoint runs PgBouncer in transaction mode, which doesn't support `LISTEN`.

The load test shows why the cache matters. Against a stub database that models the real 10-connection pool, p95 latency at 800 req/s goes from 2.9 s with no cache to 1.1 ms with one ([load-testing.md](load-testing.md)).

## Degradation

| If this fails | What happens |
|---|---|
| Redis | Reads fall through to Postgres (commands time out after 500 ms and aren't queued); rate limiting is skipped. `/readyz` reports `redis: false` but stays 200. |
| `LISTEN` connection | Reconnects with exponential backoff (1 s to 60 s). Until then, updates appear when the 60 s TTL expires. |
| Postgres | `/readyz` returns 503 and the ALB takes tasks out of rotation. If every task fails, the ALB fails open and the API answers `503 {"error":"unavailable"}`, which the frontend shows as an error with a retry button rather than as "no news". |
| Voyage | `/api/search` returns 503; the frontend says search is unavailable. Related coverage still works, since it only uses stored embeddings. |
| Daily-brief LLM (pipeline) | Up to three attempts, each re-routed by the Free Router (two with structured output, the last without). Reasoning is capped because some free models otherwise think until `max_tokens` and return nothing. If all three fail, the day has no brief, the feed is unaffected, and the next day's run tries again. With Claude, refusals are retried on a fallback model server-side. |
| GDELT | The day falls back to Google News only, and the daily job exits non-zero so the failure is visible. |

## Decisions

- **Two clouds, one app.** GCP's scale-to-zero free tier makes the live site essentially free; the AWS stack shows the always-on, horizontally scaled version. Both are Terraform, so either can be rebuilt from scratch.
- **On AWS, the API is a container, not Lambda.** WebSockets, a persistent `LISTEN` connection and an in-process single-flight map all want long-lived processes. Fargate also makes the load test meaningful, because concurrency per task is something you can measure and tune.
- **No NAT gateway.** Tasks run in public subnets with public IPs for egress (Neon, Voyage, ECR). Inbound is limited to the ALB security group. A NAT gateway would cost more than the rest of the stack.
- **Neon stays the database.** Moving to RDS would add cost and migration risk for no functional gain. The API is the only reader, through a role that can't write.
- **Relevance is a heuristic, not a model.** It's cheap, deterministic and testable, and it only orders the feed; nothing is dropped. The brief is where the LLM adds value.
- **The brief costs nothing by default.** One request a day fits OpenRouter's free models. Because free models can't be trusted to return valid JSON, the pipeline parses leniently, validates the result against the stories it sent, and falls back to the next model. Claude stays available as a paid, more predictable option.
- **The brief is neutral and cited.** The site's branding is tongue-in-cheek, but the summary is factual and attributed. It's generated from headlines and publisher descriptions only, labeled as AI-generated, and every sentence links to the stories it's based on, so a reader can check it. Citations to stories the model wasn't shown are dropped before saving.
- **Submodule, not monorepo.** The pipeline is a separate repository with its own owner and history. The submodule pins the exact pipeline commit this frontend and API expect, including the schema.
