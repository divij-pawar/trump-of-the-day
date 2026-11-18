# Infrastructure

There are two Terraform stacks for the same app, each picked for a different job:

| | [`infra/gcp/`](../infra/gcp/): **the live site** | [`infra/aws/`](../infra/aws/): **on-demand reference** |
|---|---|---|
| Shape | Serverless: Cloud Run (scales to zero) behind Firebase Hosting's CDN | Always-on: ECS Fargate ×2 behind an ALB and CloudFront, ElastiCache Redis |
| Cost | **~$0/month** inside the free tiers ([costs.md](costs.md)) | ~$70/month while running, about $2.30/day |
| Live updates (WebSockets) | Off (Firebase can't proxy them; Neon is allowed to sleep) | On |
| Deploys | `deploy-gcp.yml`, automatically after CI on `main` | `deploy-aws.yml`, manual only |
| When to use | All the time | Demos and load tests: `apply`, test, `destroy` |

Neon stays the database for both, and the pipeline keeps running on GitHub Actions for both.

---

## GCP (live)

| File | Contents |
|---|---|
| `main.tf` | API enablement; Artifact Registry with a cleanup policy (stays under the 0.5 GB free storage); Secret Manager secrets; the Cloud Run service and its runtime service account; Firebase project and Hosting site |
| `iam.tf` | Workload Identity Federation for GitHub Actions; the deploy service account and its narrowly scoped roles |
| `monitoring.tf` | Email channel, billing budget alert, 15-minute uptime check and alert policy |
| `variables.tf`, `outputs.tf`, `versions.tf` | Inputs, values for the GitHub repository variables, providers and the GCS state backend |

### Request path

The browser goes to `https://<site>.web.app` on Firebase Hosting:

- **Static files** are served from Google's CDN.
- **`/api/**` and `/healthz`** are rewritten to the Cloud Run service (`firebase.json`). Firebase caches API responses at the edge according to the API's `Cache-Control` header: 60 s for recent days and 5 min for older ones. Most traffic never reaches Cloud Run.
- **Cloud Run** starts an instance on demand, serves the request, and scales back to zero after a period of no traffic. Billing is request-based (`cpu_idle = true`): CPU is charged only while a request is in flight, which is what keeps it inside the free tier.
- **Caching:** the API runs without Redis here and uses its in-process cache (`MemoryCache` in `api/src/cache.ts`). A cold instance simply reloads from Postgres.

### Security and IAM design

- **Runtime service account (`api-runtime`):** can read exactly its two secrets. It has no other roles; the API makes no Google Cloud calls.
- **Deploy service account (`github-deploy`):** used by GitHub Actions through **Workload Identity Federation**. GitHub's OIDC token is exchanged for short-lived credentials, so no service account key exists anywhere. The pool provider only accepts tokens from `divij-pawar/trump-of-the-day` on `refs/heads/main`. Its permissions:
  - push to the one Artifact Registry repository;
  - `run.developer` on the one Cloud Run service;
  - project-level `run.viewer`, to poll deploy operations;
  - act as `api-runtime` and no other service account;
  - publish Firebase Hosting (project-level, because Hosting has no per-site IAM).
- **Secrets** never enter Terraform state. Terraform creates each secret with a placeholder version, and you add the real value as a new version.
- **The Cloud Run URL is public.** Firebase's rewrites call it anonymously, so that's required. Someone could call the `*.run.app` URL directly and skip the CDN. The rate limit and `max_instances` bound what that costs.

### Spending limits

The free tier is **not a cap**. If traffic exceeds it, the extra is billed. Three limits keep that bounded:
- `max_instances` (default **2**): the hard ceiling on concurrent compute;
- the per-IP rate limit in the API (300/min);
- the **budget alert** (default $5): emails at 50%, at 100%, and when the month is forecast to exceed it. It alerts but doesn't stop anything.

### Health checks

| Check | Endpoint | On failure |
|---|---|---|
| Cloud Run startup probe | `/healthz` | The new revision never takes traffic; the previous one keeps serving |
| Cloud Run liveness probe | `/healthz` | The instance is restarted |
| Uptime check (every 15 min, via Firebase) | `/healthz` | Email alert after about 20 minutes of failures |

All three use `/healthz` because it doesn't touch the database. A probe on `/readyz` every few seconds would keep Neon awake around the clock and use up its free compute hours.

### Client IPs on Cloud Run

The per-IP rate limit needs the visitor's real address. Requests reach the container through Firebase Hosting and Google's front end, each of which appends to `X-Forwarded-For`. The service sets `TRUST_PROXY_HOPS=2`. To confirm it picks the visitor rather than a Google proxy, check `remoteAddress` in the API's request logs (Cloud Run → Logs) after visiting the site, and compare it with your own public IP. If it shows a Google address, adjust the variable in `main.tf`.

### First deploy

1. **Project and tools.** Create a GCP project, link a billing account, and install `gcloud` and `terraform`. Then run `gcloud auth application-default login`.
2. **State bucket.** Create a GCS bucket with versioning on, then copy `backend.hcl.example` to `backend.hcl` and fill it in.
3. **Variables.** Create `terraform.tfvars`:
   ```hcl
   project_id         = "my-project"
   hosting_site_id    = "trump-of-the-day-xyz"   # globally unique
   billing_account_id = "XXXXXX-XXXXXX-XXXXXX"   # for the budget alert
   alert_email        = "you@example.com"
   ```
4. **Apply.** The service starts on Google's hello-world image until CI pushes the real one.
   ```bash
   cd infra/gcp
   terraform init -backend-config=backend.hcl
   terraform apply
   ```
5. **Database.** Bring Neon up to the current schema before anything reads it: run `db/migrations/002_dedupe_vector_digest.sql` from the pipeline repo with the owner connection string (take a Neon branch first; it deletes duplicate links), then `python insert_news.py rescore`, `backfill-embeddings` (if you have a Voyage key) and `enrich <start> <end>` for briefs on past days. See the pipeline's [docs/db.md](../trump-of-the-day-server/docs/db.md). Rotate the `news_readonly` password if it was ever in the old frontend bundle (`VITE_NEON_NEWS_URL`).
6. **Secrets.** Add the real values; they become the `latest` version.
   ```bash
   printf '%s' 'postgresql://news_readonly:…@ep-…-pooler.….neon.tech/neondb?sslmode=require' \
     | gcloud secrets versions add trump-of-the-day-api-database-url --data-file=-
   printf '%s' 'pa-…' | gcloud secrets versions add trump-of-the-day-api-voyage-api-key --data-file=-
   ```
   Leave the Voyage one as is if you don't want search; the API treats the placeholder as "not configured". Don't add `DATABASE_URL_DIRECT`. Without it, Neon can sleep and live updates are off.
7. **GitHub variables.** Set `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `GCP_IMAGE_REPOSITORY` and `FIREBASE_SITE_ID` from `terraform output`. Then run **Deploy (GCP)**, or push to `main`.
8. **Pipeline secrets.** In the pipeline repo (Settings → Secrets and variables → Actions), add `DATABASE_URL` (owner role), `OPENROUTER_API_KEY` (free daily brief) and optionally `VOYAGE_API_KEY`. Push the pipeline repo before this one, since this repo's submodule pointer must exist there for CI to check it out.
9. **Custom domain (optional).** Add it in the Firebase console under Hosting → Add custom domain. Firebase issues the certificate.

`firebase.json` hard-codes the Cloud Run service name and region. If you change `service_name` or `region` in Terraform, change them there too.

### Known limits

- **Cold starts:** the first request after an idle period takes about 1–2 s longer while Cloud Run starts an instance, plus about 0.5 s if Neon was asleep. Setting `min_instance_count = 1` removes this, but it costs money.
- **No WebSockets** on this stack (see above). Pages pick up new stories on the next load or refresh.
- **The cache is per instance** and is lost on scale-to-zero. The Firebase CDN does most of the caching. For a shared cache, set `REDIS_URL` to an Upstash free-tier database; the API uses it automatically.

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
