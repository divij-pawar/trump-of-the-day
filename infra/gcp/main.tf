data "google_project" "this" {}

locals {
  services = [
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# --- Container images ----------------------------------------------------------

# 0.5 GB of Artifact Registry storage is free; the cleanup policy keeps it there.
resource "google_artifact_registry_repository" "api" {
  location               = var.region
  repository_id          = "api"
  format                 = "DOCKER"
  description            = "API images pushed by deploy-gcp.yml"
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-older-than-a-week"
    action = "DELETE"
    condition {
      tag_state  = "ANY"
      older_than = "604800s"
    }
  }

  depends_on = [google_project_service.enabled]
}

# --- Secrets -------------------------------------------------------------------

# Cloud Run refuses to start a revision whose secret has no version, so each
# secret gets a placeholder version here. Real values are added out of band
# (`gcloud secrets versions add`, see docs/infrastructure.md) and become
# "latest"; Terraform never sees or stores them.
locals {
  secrets = {
    database-url   = "postgresql://placeholder.invalid/none"
    voyage-api-key = ""
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "${var.service_name}-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "placeholder" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value == "" ? "unset" : each.value

  lifecycle {
    ignore_changes = [secret_data, enabled]
  }
}

# --- Cloud Run -----------------------------------------------------------------

resource "google_service_account" "api" {
  account_id   = "api-runtime"
  display_name = "API runtime (Cloud Run)"
  description  = "Identity of the running API. Can read its own three secrets and nothing else."
}

resource "google_secret_manager_secret_iam_member" "api_reads_secret" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# --- Redis (Upstash) --------------------------------------------------------------

# Serverless Redis on Upstash's free plan (256 MB, 500k commands/month): the
# response cache, rate-limit counters shared across instances, and the pub/sub
# channel the pipeline announces new stories on. Upstash runs on AWS; us-east-1
# is the closest region to us-central1 (~20 ms).
resource "upstash_redis_database" "cache" {
  database_name  = var.service_name
  region         = "global"
  primary_region = var.upstash_primary_region
  tls            = true
  # It's a cache: evict old keys instead of erroring when full.
  eviction = true
  # Never move to a paid plan on its own when a quota is hit.
  auto_scale = false
}

locals {
  redis_url = "rediss://default:${upstash_redis_database.cache.password}@${upstash_redis_database.cache.endpoint}:${upstash_redis_database.cache.port}"
}

# Unlike the other secrets, Terraform writes this one, since it creates the
# database the value comes from. That puts the password in Terraform state,
# which is why the state bucket is private and versioned.
resource "google_secret_manager_secret" "redis_url" {
  secret_id = "${var.service_name}-redis-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = local.redis_url
}

resource "google_secret_manager_secret_iam_member" "api_reads_redis_url" {
  secret_id = google_secret_manager_secret.redis_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.api.email
    # Each open WebSocket counts as one in-flight request, so allow plenty per
    # instance; Node handles thousands of idle sockets.
    max_instance_request_concurrency = 250
    # The request timeout also caps WebSocket connections. The API closes them
    # itself after WS_MAX_SECONDS, well before this.
    timeout = "3600s"

    # Scale to zero when idle (that's what keeps this in the free tier) and never
    # above max_instances, which bounds the worst-case bill.
    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # Request-based billing: CPU is only charged while a request is in flight.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "RATE_LIMIT_MAX"
        value = tostring(var.rate_limit_per_minute)
      }
      # Netlify proxy -> Google Front End -> container. See docs/infrastructure.md
      # ("Client IPs on Cloud Run") for how to confirm this from the request logs.
      env {
        name  = "TRUST_PROXY_HOPS"
        value = "2"
      }
      # Live updates: the pipeline PUBLISHes to Redis, every instance subscribes.
      env {
        name  = "LIVE_UPDATES"
        value = "redis"
      }
      # An open WebSocket is billed for its whole duration; close after 10 minutes
      # and let visible tabs reconnect.
      env {
        name  = "WS_MAX_SECONDS"
        value = tostring(var.ws_max_seconds)
      }
      env {
        name  = "WS_ALLOWED_ORIGINS"
        value = join(",", var.site_origins)
      }
      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "VOYAGE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["voyage-api-key"].secret_id
            version = "latest"
          }
        }
      }

      # /healthz has no dependencies, so a sleeping Neon database doesn't fail it.
      startup_probe {
        period_seconds    = 3
        timeout_seconds   = 2
        failure_threshold = 10
        http_get {
          path = "/healthz"
        }
      }
      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 3
        failure_threshold = 3
        http_get {
          path = "/healthz"
        }
      }
    }
  }

  lifecycle {
    # deploy-gcp.yml rolls out new images; don't revert them on the next apply.
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }

  depends_on = [
    google_project_service.enabled,
    google_secret_manager_secret_iam_member.api_reads_secret,
    google_secret_manager_secret_iam_member.api_reads_redis_url,
    google_secret_manager_secret_version.placeholder,
    google_secret_manager_secret_version.redis_url,
  ]
}

# Public: Netlify's /api proxy and browsers' WebSocket connections call it anonymously.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
