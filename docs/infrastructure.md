# Infrastructure

There are two Terraform stacks for the same app, each picked for a different job:

| | [`infra/gcp/`](../infra/gcp/): **production** | [`infra/aws/`](../infra/aws/): **on-demand reference** |
|---|---|---|
| Shape | Serverless: Netlify serves the site and proxies `/api/*` to Cloud Run (scales to zero); Upstash Redis | Always-on: ECS Fargate ×2 behind an ALB and CloudFront, ElastiCache Redis |
| Cost | **~$0/month** inside the free tiers ([costs.md](costs.md)) | ~$70/month while running, about $2.30/day |
| Live updates (WebSockets) | On: browsers connect to Cloud Run directly; the pipeline publishes through Upstash Redis pub/sub | On: Postgres `LISTEN` (the pipeline can't reach the VPC's Redis) |
| Deploys | API: `deploy-gcp.yml` after CI on `main`. Site: Netlify builds on push | `deploy-aws.yml`, manual only |
| When to use | All the time | Demos and load tests: `apply`, test, `destroy` |

Neon stays the database for both, and the pipeline keeps running on GitHub Actions for both.

---

## GCP + Netlify + Upstash (production)

| File | Contents |
|---|---|
| `main.tf` | API enablement; Artifact Registry with a cleanup policy (stays under the 0.5 GB free storage); Secret Manager secrets; the Upstash Redis database and the secret holding its URL; the Cloud Run service and its runtime service account |
| `iam.tf` | Workload Identity Federation for GitHub Actions; the deploy service account and its narrowly scoped roles |
| `monitoring.tf` | Email channel, billing budget alert, 15-minute uptime check and alert policy |
| `variables.tf`, `outputs.tf`, `versions.tf` | Inputs; values for Netlify, GitHub and the pipeline's secrets; the google and upstash providers and the GCS state backend |
| [`netlify.toml`](../netlify.toml), [`scripts/netlify-redirects.mjs`](../scripts/netlify-redirects.mjs) | The site's build, cache headers, and the generated `/api/*` proxy rule |

### Request path

- **Static files:** Netlify's CDN serves the built site.
- **`/api/*`:** Netlify proxies it to the Cloud Run URL (`API_ORIGIN`, written into `dist/_redirects` at build time). The browser only ever talks to the site's own origin, so there's no CORS.
- **`/ws`:** Netlify can't proxy WebSockets, so the browser connects to `wss://<cloud run host>/ws` directly (`VITE_WS_URL`). The API accepts only the site's origins (`WS_ALLOWED_ORIGINS`) and closes each connection after 10 minutes (`WS_MAX_SECONDS`); the page reconnects while the tab is visible and disconnects a minute after it's hidden.
- **Cloud Run** starts an instance on demand and scales back to zero after a period of no traffic. Billing is request-based (`cpu_idle = true`): CPU is charged only while a request is in flight. An open WebSocket counts as an in-flight request, which is why connections are capped and tied to tab visibility.
- **Upstash Redis** holds the response cache (shared by all instances and surviving scale-to-zero), the rate-limit counters, and the `news_updated` pub/sub channel.

### Live updates

After each processed day the pipeline calls Upstash's REST API: it deletes that day's cached response and `PUBLISH`es `news_updated <date>`. Every running Cloud Run instance is subscribed; each one drops its cache entry and pushes `{"type":"news_updated"}` to the browsers connected to it. That's the standard pattern for fanning WebSocket messages out across horizontally scaled servers, and unlike Postgres `LISTEN` it holds no database connection, so Neon can still scale to zero. With no instance running, the pipeline's own cache delete still makes the next visit fresh.

### Security and IAM design

- **Runtime service account (`api-runtime`):** can read exactly its three secrets (database URL, Voyage key, Redis URL). It has no other roles; the API makes no Google Cloud calls.
- **Deploy service account (`github-deploy`):** used by GitHub Actions through **Workload Identity Federation**. GitHub's OIDC token is exchanged for short-lived credentials, so no service account key exists anywhere. The pool provider only accepts tokens from `divij-pawar/trump-of-the-day` on `refs/heads/main`. Its permissions:
  - push to the one Artifact Registry repository;
  - `run.developer` on the one Cloud Run service;
  - project-level `run.viewer`, to poll deploy operations;
  - act as `api-runtime` and no other service account.
- **Secrets:** the database URL and Voyage key never enter Terraform state; Terraform creates each with a placeholder version and you add the real value. The Redis URL is the exception: Terraform creates the Upstash database, so it writes that secret itself, and the password is in state. That's why the state bucket is private and versioned.
- **Upstash credentials** for Terraform come from `UPSTASH_EMAIL` / `UPSTASH_API_KEY` in the environment, never from files. `auto_scale = false` keeps the database on the free plan.
- **The Cloud Run URL is public:** Netlify's proxy and browsers' WebSockets call it anonymously. Someone could call it directly and skip Netlify's CDN; the rate limit and `max_instances` bound what that costs, and `/ws` refuses other origins.

### Spending limits

The free tier is **not a cap**. If traffic exceeds it, the extra is billed. These keep it bounded:
- `max_instances` (default **2**): the hard ceiling on concurrent compute;
- the per-IP rate limit in the API (300/min);
- the WebSocket lifetime cap and visibility-based disconnects;
- Upstash with `auto_scale = false`: at its quota it errors instead of upgrading, and the API falls back to the database;
- the **budget alert** (default $5): emails at 50%, at 100%, and when the month is forecast to exceed it. It alerts but doesn't stop anything.

### Health checks

| Check | Endpoint | On failure |
|---|---|---|
| Cloud Run startup probe | `/healthz` | The new revision never takes traffic; the previous one keeps serving |
| Cloud Run liveness probe | `/healthz` | The instance is restarted |
| Deploy smoke test (`deploy-gcp.yml`) | `/livez`, `/readyz` | The workflow fails, so a broken deploy is visible |
| Uptime check (every 15 min, Cloud Run URL) | `/livez` | Email alert after about 20 minutes of failures |

The recurring checks use `/livez` because it doesn't touch the database. A probe on `/readyz` every few seconds would keep Neon awake around the clock and use up its free compute hours. `/livez` is the same check as `/healthz`; the public checks can't use `/healthz` because Cloud Run's front end answers that path itself with a 404 (only its own probes, which go straight to the container, reach it).

### Client IPs on Cloud Run

The per-IP rate limit needs the visitor's real address. Requests through the site reach the container via Netlify's proxy and Google's front end, each of which appends to `X-Forwarded-For`, so the service sets `TRUST_PROXY_HOPS=2`. To confirm it picks the visitor rather than a proxy, check `remoteAddress` in the API's request logs (Cloud Run → Logs) after visiting the site, and compare it with your own public IP. If it shows a Netlify or Google address, adjust the variable in `main.tf`.

### First deploy

1. **Database.** Bring Neon up to the current schema: run `db/migrations/002_dedupe_vector_digest.sql` from the pipeline repo with the owner connection string (take a Neon branch first; it deletes duplicate links), then `python insert_news.py rescore`, `backfill-embeddings` (if you have a Voyage key) and `enrich <start> <end>` for briefs on past days. See the pipeline's [docs/db.md](../trump-of-the-day-server/docs/db.md). Rotate the `news_readonly` password if it was ever in the old frontend bundle (`VITE_NEON_NEWS_URL`).
2. **Accounts and tools.** Create a GCP project and link a billing account (Cloud Run requires one even inside the free tier). Create an Upstash account and a Management API key (console.upstash.com → Account → Management API). Install `gcloud` and `terraform`, then run `gcloud auth application-default login`.
3. **State bucket.** Create a GCS bucket with versioning on, then copy `backend.hcl.example` to `backend.hcl` and fill it in.
4. **Variables.** Create `terraform.tfvars`:
   ```hcl
   project_id         = "my-project"
   site_origins       = ["https://your-site.netlify.app"]   # plus any custom domain
   billing_account_id = "XXXXXX-XXXXXX-XXXXXX"              # for the budget alert
   alert_email        = "you@example.com"
   ```
5. **Apply.** The service starts on Google's hello-world image until CI pushes the real one.
   ```bash
   cd infra/gcp
   export UPSTASH_EMAIL=you@example.com UPSTASH_API_KEY=…
   terraform init -backend-config=backend.hcl
   terraform apply
   ```
6. **Secrets.** Add the real values; they become the `latest` version. (The Redis URL is already set.)
   ```bash
   printf '%s' 'postgresql://news_readonly:…@ep-…-pooler.….neon.tech/neondb?sslmode=require' \
     | gcloud secrets versions add trump-of-the-day-api-database-url --data-file=-
   printf '%s' 'pa-…' | gcloud secrets versions add trump-of-the-day-api-voyage-api-key --data-file=-
   ```
   Leave the Voyage one as is if you don't want search; the API treats the placeholder as "not configured".
7. **GitHub variables (this repo).** Set `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT` and `GCP_IMAGE_REPOSITORY` from `terraform output`, then run **Deploy (GCP)**. Check `curl $(terraform output -raw api_url)/readyz` returns `"status":"ready"`.
8. **Pipeline secrets.** In the pipeline repo (Settings → Secrets and variables → Actions): `DATABASE_URL` (owner role), `OPENROUTER_API_KEY`, optionally `VOYAGE_API_KEY`, and for live updates `UPSTASH_REDIS_REST_URL` (`terraform output upstash_rest_url`) and `UPSTASH_REDIS_REST_TOKEN` (`terraform output -raw upstash_rest_token`).
9. **Netlify.** In the site's environment variables set `API_ORIGIN` and `VITE_WS_URL` from `terraform output netlify_env`, and delete `VITE_NEON_NEWS_URL`. Only then push this repo: Netlify's build fails without `API_ORIGIN`, so it can't publish a site with no API behind it. The submodule URL is HTTPS, so Netlify can clone it without a key.
10. **Order of pushes.** Push the pipeline repo before this one, since this repo's submodule pointer must exist there for Netlify and CI to check it out.

### Known limits

- **Cold starts:** the first request after an idle period takes about 1–2 s longer while Cloud Run starts an instance, plus about 0.5 s if Neon was asleep. Netlify's CDN and the Redis cache absorb most of them. Setting `min_instance_count = 1` removes this, but it costs money.
- **Netlify deploys the site on push, independently of CI.** The site and the API can be briefly out of step during a deploy; keep API changes backward compatible.
- **Upstash free plan:** 500k commands a month. Each API request uses about three (cache read, rate limit), so roughly 150k requests a month before it starts erroring; the API then serves from the database without the shared cache.

---

## AWS (on demand)

Same app, the always-on, horizontally scaled design. It's kept as a working reference and brought up for demos and load tests. Cost is about $70/month, or about $2.30/day, so a weekend demo costs about $5.

| File | Contents |
|---|---|
| `network.tf` | VPC across 2 AZs: public subnets (ALB, tasks) and private subnets (Redis); security groups |
| `alb.tf` | ALB, target group with readiness check, listener that only forwards requests with CloudFront's secret header |
| `ecs.tf` | ECR, ECS cluster, task definition, service (2+ tasks, circuit-breaker rollback), CPU and request-count autoscaling |
| `redis.tf` | ElastiCache Redis 7 with TLS |
| `cdn.tf` | Private S3 bucket and CloudFront with S3 (OAC) and ALB origins |
| `secrets.tf` | Secrets Manager entries |
| `iam.tf` | Task execution role, empty task role, GitHub OIDC deploy role |
| `monitoring.tf` | SNS topic and alarms (unhealthy targets, 5xx, p95 latency) |

**IAM.** The execution role can read exactly four secrets. The task role has no permissions. The GitHub deploy role is assumable only via OIDC from `main` of this repo, and is scoped to the one ECR repo, ECS service, S3 bucket and CloudFront distribution.

**Health checks.** The container `HEALTHCHECK` uses `/healthz`, so ECS replaces tasks that stop responding. The ALB target group uses `/readyz`, so tasks that can't reach the database are taken out of rotation, and it fails open if all of them fail. Liveness and readiness are split so a database outage doesn't make ECS kill healthy tasks in a loop.

**Bring it up and down:**

```bash
cd infra/aws
cp backend.hcl.example backend.hcl                    # fill in an S3 state bucket
terraform init -backend-config=backend.hcl
terraform apply
aws secretsmanager put-secret-value --secret-id trump-of-the-day/database-url --secret-string '…'
# also database-url-direct (for live updates) and voyage-api-key
# set the AWS_* repository variables from `terraform output`, then run "Deploy (AWS)"
terraform destroy                                     # when you're done
```

Known limits: CloudFront to ALB traffic is plain HTTP inside AWS (add an ACM certificate and a 443 listener for end-to-end TLS), and Redis is a single node.
