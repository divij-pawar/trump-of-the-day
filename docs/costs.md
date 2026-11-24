# Costs

Estimates as of 2026-11. Free tiers and prices change, so check each provider's pricing page before relying on these.

## Production (Netlify + GCP + Upstash): about $0/month

| Service | Provider | What it does here | Free allowance (approx.) | Expected use | Cost |
|---|---|---|---|---|---|
| API | Cloud Run | Runs the Fastify container, scales to zero | ~2M requests, 180k vCPU-seconds and 360k GiB-seconds per month | Short HTTP requests plus open WebSockets, which are billed while connected; capped at 10 minutes and dropped a minute after a tab is hidden | $0 |
| Frontend and CDN | Netlify | Serves the SPA; proxies `/api/*` to Cloud Run | 100 GB/month bandwidth, 300 build minutes | ~250 KB per visit; ~1 min per build | $0 |
| Cache, rate limits, live-update channel | Upstash Redis | Shared response cache, rate-limit counters, `news_updated` pub/sub | 256 MB, 500k commands/month | ~3 commands per API request (~150k requests/month) | $0 |
| Database | Neon | Postgres + pgvector | Free plan | Can sleep: live updates go through Redis, not a held `LISTEN` connection, and health checks skip the database | $0 |
| Secrets | Secret Manager | 3 secrets | A few active versions and ~10k accesses/month free | | $0 |
| Images | Artifact Registry | API images | 0.5 GB | 5 images × ~60 MB, kept there by the cleanup policy | $0 |
| Monitoring | Cloud Monitoring / Logging | Uptime check, alert, logs | Basic uptime checks; 50 GB logs/month | | $0 |
| CI/CD and daily scraper | GitHub Actions | Tests, deploys, 14:00 UTC cron | Free for public repos; 2,000 min/month for private ones | ~5 min/day plus CI | $0 |
| Daily brief | OpenRouter Free Router (`openrouter/free`) | One to three requests per brief (retries when a model runs out of tokens); the site shows which free model wrote it | Free models are rate-limited per day (about 50 requests without credits); a daily job needs at most 6 (yesterday and today) | | $0 |
| Embeddings | Voyage `voyage-3.5` | Search and related coverage, for each day's top 50 stories | Voyage's pricing page lists `voyage-3.5` with no free tokens ($0.06 per million) | ~70K tokens/month (under a cent); embedding a whole archive once costs a few cents at most | ~$0 |
| Domain | Netlify `*.netlify.app` | | | | $0 (a custom domain is ~$10–12/year) |

**Worst case.** Cloud Run can't run more than `max_instances` (2) instances. If a bot kept both fully busy all month, compute would come to tens of dollars. The budget alert emails you well before that.

## On-demand reference (AWS): about $70/month while running

| Resource | ~$/month |
|---|---|
| Application Load Balancer | 22 |
| Fargate, 2 × (0.25 vCPU, 0.5 GB) | 18 |
| Public IPv4 addresses (4 × $0.005/h) | 15 |
| ElastiCache `cache.t4g.micro` | 12 |
| CloudWatch (logs, alarms, Container Insights) | 2–5 |
| Secrets Manager (4) | 1.60 |
| ECR, S3, CloudFront (inside the free tier) | <1 |
| **Total** | **≈ 70**, about $2.30/day |

If you want it running longer, `api_min_tasks = 1`, Fargate Spot, turning off Container Insights, and replacing ElastiCache with Upstash bring it to about $30–35/month.

## Daily-brief options

Per brief: about 5.5k tokens in and up to 8k out (the answer plus capped reasoning), with up to three attempts on OpenRouter. The daily job writes two briefs (yesterday and today).

| Provider (`DIGEST_PROVIDER`) | Model | ~$/month | Notes |
|---|---|---|---|
| `openrouter` (default when its key is set) | Free Router `openrouter/free` (or pinned ids in `OPENROUTER_MODELS`) | **$0** | Picks an available free model; free models are rate-limited; JSON output is validated and retried |
| `anthropic` | `claude-haiku-5-5` (`ANTHROPIC_MODEL`) | ~$0.05 | Guaranteed structured output |
| `anthropic` | `claude-opus-5-5` (default for this provider) | ~$1.90 | Server-side refusal fallback enabled |
