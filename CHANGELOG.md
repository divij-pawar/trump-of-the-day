# Changelog

All notable changes to the site, API and infrastructure. The pipeline keeps its own [changelog](trump-of-the-day-server/CHANGELOG.md). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Hosting
- **Production at about $0/month: Netlify + Cloud Run + Upstash Redis.** Netlify keeps serving the site and proxies `/api/*` to the API on Cloud Run (scales to zero, request-based billing, at most 2 instances); `netlify.toml` and `scripts/netlify-redirects.mjs` generate the proxy rule from `API_ORIGIN`, and the build fails without it so a site with no API behind it can't be published. Terraform is in `infra/gcp/`:
  - Cloud Run with WebSocket-friendly settings (1 h request timeout, 250 concurrent requests per instance);
  - Upstash Redis (free plan, `auto_scale` off) for the shared cache, rate limits and live-update pub/sub, with its URL written to Secret Manager;
  - Artifact Registry with a cleanup policy;
  - Secret Manager with placeholder versions for the secrets Terraform doesn't create;
  - least-privilege runtime and deploy service accounts;
  - Workload Identity Federation for keyless GitHub deploys;
  - a billing budget alert and a 15-minute uptime check with an alert.
- `deploy-gcp.yml` deploys the API after CI on `main` and smoke-tests `/healthz` and `/readyz`; Netlify deploys the site on push.
- The submodule URL is HTTPS (it was SSH), so Netlify and CI can clone it without a key; Netlify's builds were failing at "Host key verification failed".
- The AWS Terraform moved from `infra/terraform/` to `infra/aws/` and is now an on-demand reference stack. `deploy.yml` became `deploy-aws.yml` and is manual only.
- CI validates both Terraform stacks.
- [docs/costs.md](docs/costs.md) breaks down each service's cost and why it was chosen.

### Security
- **The browser no longer connects to the database.** The frontend used to query Neon directly with `VITE_NEON_NEWS_URL`, which Vite compiled into the public JavaScript bundle, so anyone could extract a working read-only connection string and run arbitrary `SELECT`s. All reads now go through the API. **Rotate the `news_readonly` password**: every previously deployed bundle contains it.
- The ALB only accepts traffic from CloudFront (managed prefix list plus a secret origin header), and the API checks the header too.
- Per-IP rate limiting (300/min by default), with counters in Redis shared across tasks and spoof-resistant client IPs behind the proxies.

### Added
- Live updates at scale through Redis pub/sub: the pipeline announces each processed day through Upstash's REST API, and every API instance subscribes and pushes to its own WebSocket clients (`LIVE_UPDATES=redis`, `RedisNewsSubscriber`). Postgres `LISTEN` stays as an option for the AWS stack. Tested locally with two API replicas receiving one announcement.
- WebSocket limits for Cloud Run billing: `WS_MAX_SECONDS` closes connections after a maximum lifetime (code 4000) and `WS_ALLOWED_ORIGINS` refuses other sites' pages; the frontend connects only while the tab is visible, disconnects a minute after it's hidden, and reconnects at once after a lifetime close. `VITE_WS_URL` points the socket at Cloud Run, since Netlify can't proxy WebSockets.
- `docker-compose.yml` mirrors production: API on Redis pub/sub, plus `redis-rest`, an Upstash-compatible REST endpoint for the pipeline.
- Sentence-level citations in the daily brief. Each sentence ends with numbered links ([1], [2]…) to the stories it's based on; clicking one scrolls to that story's card and highlights it, and cited cards show "Cited in brief [n]". The API's digest gained `paragraphs` (sentences with the story ids they cite); the news cache key moved to `v2` so cached responses pick it up. Briefs without citations still render as plain paragraphs.
- `api/`: a Fastify API with:
  - `GET /api/news`, `/api/dates/latest`, `/api/news/:id/similar` and `/api/search`;
  - `/healthz` (liveness) and `/readyz` (readiness);
  - a `/ws` WebSocket for live updates.
  See [docs/api.md](docs/api.md).
- An in-process cache (`MemoryCache`, bounded, single-flight) used when `REDIS_URL` isn't set, as on Cloud Run.
- `VITE_LIVE_UPDATES=false` build setting that leaves the WebSocket code out of the bundle entirely (used for the GCP build).
- `optional()` config parsing in the API: an empty value or the literal `unset` (GCP's placeholder secret) means "not configured".
- Redis caching with date-aware TTLs, single-flight loading for concurrent misses, and invalidation driven by the pipeline's Postgres `NOTIFY`.
- Daily brief card at the top of each day, with its top stories highlighted. It's written in the pipeline by a free model picked by OpenRouter's Free Router (`openrouter/free`), or by Claude. The card credits the model that wrote it ("Summarized by `upstage/solar-pro-3` (free model via OpenRouter)").
- Semantic search across the archive, and "Related coverage" under each story (pgvector, Voyage embeddings). The pipeline embeds each day's top 50 stories by relevance (`EMBED_TOP_PER_DAY`), because the vector and its HNSW index entry take about 12 KB per story, most of the database, which was growing by about 2 MB a day at the current volume. Lower-ranked stories stay in the feed; their "Related coverage" shows "No related coverage yet" and they don't appear in search.
- Live updates: open pages refetch when the pipeline publishes the day they're showing.
- Terraform for AWS in `infra/terraform/`: VPC, ECS Fargate with autoscaling and circuit-breaker rollback, ALB, ElastiCache Redis, private S3 with CloudFront, Secrets Manager, least-privilege IAM with a GitHub OIDC deploy role, and CloudWatch alarms. See [docs/infrastructure.md](docs/infrastructure.md).
- GitHub Actions:
  - `ci.yml`: frontend typecheck, lint, test and build; API typecheck, test and image build; Terraform fmt and validate.
  - `deploy.yml`: OIDC deploy to ECS and S3/CloudFront, inert until configured.
- `docker-compose.yml` for a local stack (Postgres + pgvector seeded with synthetic data, Redis, API).
- k6 load tests for HTTP and 2,000+ concurrent WebSockets, with results in [docs/load-testing.md](docs/load-testing.md).
- Tests:
  - frontend (Vitest + Testing Library): 19 tests;
  - API (Vitest with Fastify `inject`): 19 tests.
- `ARCHITECTURE.md`: a beginner-friendly overview with five Mermaid diagrams (big picture, daily pipeline, a page visit, deploys, GCP vs AWS).
- Docs: `docs/architecture.md`, `api.md`, `infrastructure.md`, `costs.md`, `development.md`, `load-testing.md`; this changelog.
- `.gitattributes` normalizing line endings to LF.

### Changed
- The pipeline repository is now a git submodule at `trump-of-the-day-server/` (it was an untracked nested repository).
- Dates are handled as UTC `YYYY-MM-DD` strings end to end, matching the pipeline's day boundaries. The page opens on the newest day that has stories, rather than an often-empty "today".
- Loading, empty and error states are now distinct. A failed request shows an error with a retry button instead of "No news found … yet".
- Changing the date aborts the previous request, so a slow earlier response can't replace a newer one.
- Stories are ordered by relevance score.
- Calendar days are buttons with ARIA grid semantics and arrow-key navigation.
- Images load lazily and hide themselves if they fail to load.
- `react-helmet` was replaced with `react-helmet-async`. Social-card image URLs are absolute, and the hard-coded publish time was removed.
- `Footer` and `Metadata` were converted to TypeScript.
- `npm run build` now type-checks first.
- The package was renamed from `vite-react-typescript-starter` to `trump-of-the-day`.
- `typescript-eslint` was upgraded to `^8.46` (the old version crashed on the installed ESLint).
- README: the daily brief is described as written by a free OpenRouter model, with the model credited on the card. The diagram now shows the pipeline's outside services. New sections cover the brief's settings and the load-test results.
- Docs: README, ARCHITECTURE.md, architecture, costs and infrastructure describe the cited brief and the retry policy; the first-deploy steps now include migrating Neon and the order to push the two repos; development.md covers running the real pipeline against the local database and a troubleshooting table for the issues hit during local testing.

### Fixed
- The Vite dev server crashed with `ENOSPC` when it ran out of file watches on the pipeline's Python `env/`; it now ignores non-frontend folders.
- The k6 WebSocket test sends an `Origin` header, which the API now requires.
- The calendar computed the last navigable month as `new Date(year, month, 31)`, which rolled over into the next month for 30-day months and February.
- The previous/next month buttons compared a mid-month date against the min/max dates, so they enabled and disabled at the wrong times.
- "Today" was computed in the visitor's local timezone, so the latest day was off by one for visitors west of UTC in the evening.

Found by running the full stack locally (Docker Postgres + pgvector, Redis, API, the real pipeline):
- Story ids came back from the API as strings (node-pg returns `BIGINT` as text) while `top_story_ids` were numbers, so the brief's top stories were never highlighted. The API now returns every id as a number.
- Live updates reached the browser but didn't change the page: the refetch was answered from the browser's HTTP cache (`max-age` up to 5 minutes). A reload (live update or retry) now skips the browser cache for that one request.
- `loadtest/seed.sql` failed on real Postgres (`array_agg` over only outer columns counts as an outer-level aggregate). It now also builds the HNSW index after the load, cutting first boot from about 8 minutes to about 80 seconds.
- When the local API isn't running, the dev server's proxy answered a bare 500 ("Request failed (500)"). It now answers 502 with a message saying the API at :8080 is unreachable and how to start it.
- The local Postgres health check passed during first-boot init, before Postgres accepted TCP connections, so the API started early and failed its first requests. It now checks over TCP.

### Removed
- Firebase Hosting (`firebase.json`, its Terraform resources and deploy roles, the `google-beta` provider): the site stays on Netlify.
- `@neondatabase/serverless`, `src/lib/neon.ts`, the unused `useAllNews` hook, `date-fns`, and the leftover Supabase schema image.
