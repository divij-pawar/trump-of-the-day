output "site_url" {
  value = "https://${google_firebase_hosting_site.site.site_id}.web.app"
}

output "cloud_run_url" {
  description = "Direct service URL (bypasses the Firebase CDN; useful for debugging)."
  value       = google_cloud_run_v2_service.api.uri
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
  value       = [for s in google_secret_manager_secret.app : s.secret_id]
}
