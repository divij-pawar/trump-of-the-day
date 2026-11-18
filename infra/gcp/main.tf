data "google_project" "this" {}

locals {
  services = [
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
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
  description  = "Identity of the running API. Can read its own two secrets and nothing else."
}

resource "google_secret_manager_secret_iam_member" "api_reads_secret" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.api.email
    max_instance_request_concurrency = 80
    timeout                          = "30s"

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
      # Firebase Hosting -> Google Front End -> container. See docs/infrastructure.md
      # ("Client IPs on Cloud Run") for how to confirm this from the request logs.
      env {
        name  = "TRUST_PROXY_HOPS"
        value = "2"
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
    google_secret_manager_secret_version.placeholder,
  ]
}

# Public: Firebase Hosting's rewrites call the service as an anonymous client.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Firebase Hosting ----------------------------------------------------------

resource "google_firebase_project" "this" {
  provider   = google-beta
  project    = var.project_id
  depends_on = [google_project_service.enabled]
}

resource "google_firebase_hosting_site" "site" {
  provider   = google-beta
  project    = var.project_id
  site_id    = var.hosting_site_id
  depends_on = [google_firebase_project.this]
}
