output "api_url" {
  description = "Cloud Run URL. Set as API_ORIGIN in Netlify, and wss://<host>/ws as VITE_WS_URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "netlify_env" {
  description = "Environment variables for the Netlify site."
  value = {
    API_ORIGIN  = google_cloud_run_v2_service.api.uri
    VITE_WS_URL = "${replace(google_cloud_run_v2_service.api.uri, "https://", "wss://")}/ws"
  }
}

output "upstash_rest_url" {
  description = "Set as the UPSTASH_REDIS_REST_URL secret in the pipeline repo."
  value       = "https://${upstash_redis_database.cache.endpoint}"
}

output "upstash_rest_token" {
  description = "Set as the UPSTASH_REDIS_REST_TOKEN secret in the pipeline repo (terraform output -raw upstash_rest_token)."
  value       = upstash_redis_database.cache.rest_token
  sensitive   = true
}

output "image_repository" {
  description = "Set as the GCP_IMAGE_REPOSITORY repository variable."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}

output "workload_identity_provider" {
  description = "Set as the GCP_WORKLOAD_IDENTITY_PROVIDER repository variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Set as the GCP_DEPLOY_SERVICE_ACCOUNT repository variable."
  value       = google_service_account.deploy.email
}

output "secrets_to_populate" {
  description = "Add real values with: gcloud secrets versions add <name> --data-file=-"
  value       = [for s in google_secret_manager_secret.app : s.secret_id] # redis-url is written by Terraform
}
