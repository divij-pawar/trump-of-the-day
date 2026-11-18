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
docker compose up --build           # Postgres+pgvector (seeded ~25k synthetic stories, ~80 s on first boot), Redis, API on :8080
npm install && npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to `http://localhost:8080`, mirroring the CloudFront routing in production. Point it elsewhere with `API_PROXY_TARGET=http://host:port npm run dev`, or build against a remote API with `VITE_API_URL`.

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
python -m venv env && source env/bin/activate
pip install -r requirements-dev.txt
python insert_news.py yesterday today      # needs DATABASE_URL (owner role) in .env
```

See its [README](../trump-of-the-day-server/README.md) for the subcommands (`enrich`, `rescore`, `backfill-embeddings`, ...).

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
| Frontend | `npm test` | Date helpers (UTC handling, month math), calendar (range limits, the month-rollover bug, keyboard), `useNews` (states, abort-on-change race, reload) |
| API | `cd api && npm test` | Health and readiness, validation, caching and TTLs, the in-process cache, single-flight under concurrent misses, 503 without leaking errors, search, origin header, rate limiting, NOTIFY handling |
| Pipeline | `cd trump-of-the-day-server && python -m pytest` | Relevance scoring, digest prompt and JSON validation for both providers (OpenRouter fallback and retry, Claude request shape), embeddings batching, scraper helpers, `enrich_day` ordering and failure isolation |
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
