# Development

## Layout

```
.                         frontend (Vite + React), root package.json
api/                      Fastify API, its own package.json
trump-of-the-day-server/  git submodule: Python pipeline + db schema
infra/gcp/                Terraform for the live site (Cloud Run + Firebase)
infra/aws/                Terraform for the on-demand AWS stack
loadtest/                 k6 scripts, seed data for docker compose
```

## Local stack

```bash
git submodule update --init         # if you didn't clone with --recurse-submodules
sudo systemctl start docker         # Linux, if the daemon isn't running (e.g. after a reboot)
docker compose up -d --build        # Postgres+pgvector (seeded ~25k synthetic stories, ~80 s on first boot), Redis, API on :8080
npm ci && npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to `http://localhost:8080`, mirroring the CloudFront routing in production. If nothing answers there, `/api` requests get a `502` whose message (shown in the page's error box) says the API is unreachable and how to start it. Point the proxy elsewhere with `API_PROXY_TARGET=http://host:port npm run dev`, or build against a remote API with `VITE_API_URL`.

The database keeps its data in a Docker volume across restarts. `docker compose down -v` deletes it, and the next `up` re-seeds.

To trigger a live update, run this while the page is open:

```bash
docker compose exec postgres psql -U owner -d news -c "NOTIFY news_updated, '2025-03-01'"
```

### Against a real Neon database

Run the API without Docker:

```bash
cd api
npm install
DATABASE_URL='postgresql://news_readonly:…@…-pooler…/neondb?sslmode=require' \
DATABASE_URL_DIRECT='postgresql://news_readonly:…@…/neondb?sslmode=require' \
REDIS_URL=redis://localhost:6379 \
npm run dev
```

The root `.env` used to hold `VITE_NEON_NEWS_URL`. Nothing reads it any more. Because that connection string was compiled into every deployed bundle, **rotate the `news_readonly` password** and delete the variable.

## Pipeline

```bash
cd trump-of-the-day-server
python -m venv env && source env/bin/activate    # env/ is gitignored
pip install -r requirements-dev.txt
python insert_news.py yesterday today            # needs DATABASE_URL (owner role)
```

See its [README](../trump-of-the-day-server/README.md) for the subcommands (`enrich`, `rescore`, `backfill-embeddings`, ...).

### Pipeline against the local database

The full loop (real scraping, the AI brief with citations, `NOTIFY`, live update in the open page) runs against the Docker database. Put `OPENROUTER_API_KEY` (and optionally `VOYAGE_API_KEY`) in `trump-of-the-day-server/.env`, and pass the local URL on the command line:

```bash
cd trump-of-the-day-server
DATABASE_URL=postgres://owner:owner@127.0.0.1:5432/news python insert_news.py yesterday today
DATABASE_URL=postgres://owner:owner@127.0.0.1:5432/news python insert_news.py enrich 2026-11-13 2026-11-13   # rewrite one day's brief
```

**Always set `DATABASE_URL` explicitly here.** If that `.env` also holds the production Neon URL, an unset variable would make the run write to production. A variable already set in the environment wins over `.env`.

The seed's synthetic stories have random relevance scores, so on seeded days they can rank above the real ones you scrape.

### Working with the submodule

The parent repo pins a specific pipeline commit. After changing the pipeline:

```bash
cd trump-of-the-day-server
git commit -am "…" && git push            # to harshaldafade/trump-of-the-day-server
cd ..
git add trump-of-the-day-server && git commit -m "Bump pipeline"
```

Push the submodule commit before the parent commit that references it. Otherwise other clones (and CI) can't check it out.

## Tests

| What | Command | Covers |
|---|---|---|
| Frontend | `npm test` | Date helpers (UTC handling, month math), calendar (range limits, the month-rollover bug, keyboard), `useNews` (states, abort-on-change race, reload skipping the browser cache), the brief card (model credit, citation numbering and jump-to-story) |
| API | `cd api && npm test` | Health and readiness, validation, caching and TTLs, the in-process cache, single-flight under concurrent misses, 503 without leaking errors, search, origin header, rate limiting, NOTIFY handling, the digest's citations |
| Pipeline | `cd trump-of-the-day-server && python -m pytest` | Relevance scoring, digest prompt and JSON validation including per-sentence citations, both providers (OpenRouter reasoning cap and three attempts, Claude request shape), embeddings batching, scraper helpers, UTC `today`/`yesterday`, `enrich_day` ordering and failure isolation |
| End to end | the local stack plus the pipeline, above | What unit tests can't: real Postgres types (ids come back as `BIGINT` strings), the seed SQL, the HNSW index, `NOTIFY` to the browser, real free-model behavior |
| Types and lint | `npm run typecheck && npm run lint`, `cd api && npm run typecheck` | |
| Terraform | `terraform fmt -check && terraform init -backend=false && terraform validate` in `infra/gcp` and `infra/aws` | |
| Load | see [load-testing.md](load-testing.md) | |

## CI and deploys

- `.github/workflows/ci.yml` runs on every push and PR. It has three jobs:
  - frontend: typecheck, lint, test, build;
  - API: typecheck, test, Docker build;
  - Terraform: fmt and validate, for both `infra/gcp` and `infra/aws`.
- `.github/workflows/deploy-gcp.yml` deploys the live site after CI passes on `main`. It pushes the API image to Artifact Registry, rolls Cloud Run, builds the frontend with `VITE_LIVE_UPDATES=false` and publishes it to Firebase Hosting. It authenticates through Workload Identity Federation and does nothing until the `GCP_*` repository variables exist.
- `.github/workflows/deploy-aws.yml` is manual only, for when the AWS stack is up ([infrastructure.md](infrastructure.md)).
- The pipeline repo has its own `test.yml`, `build-push.yml` and `daily-run.yml`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Page shows "Can't reach the API at http://localhost:8080…" (or `Request failed (500)` from an older dev server) | The Docker stack isn't up. `sudo systemctl start docker`, then `docker compose up -d`. `sudo systemctl enable docker` starts it at boot. |
| `failed to connect to the docker API at unix:///var/run/docker.sock` | Same: the Docker daemon is stopped. |
| API logs `ECONNREFUSED` right after the first `up` | Postgres is still seeding (~80 s). The health check waits for TCP, so this only appears if you start the API by hand. |
| `npm run build` fails with missing `vitest`/`react-helmet-async` types, or Vite can't find `@rollup/rollup-linux-x64-gnu` | `node_modules` is stale or was installed on another OS. Run `npm ci`. On a drive shared with Windows, `npm ci` on one OS removes the other's native binaries; re-run it when you switch. |
| Brief missing for a day; pipeline log says `digest was cut off at max_tokens (<model>: …)` | A free model spent its whole budget reasoning on all three attempts. Re-run `python insert_news.py enrich <date> <date>`; the router will likely pick another model. |
| A brief has no `[n]` links | It was written before citations existed, or by a model that ignored the schema (saved without `paragraphs`). Re-run `enrich` for that day. |
