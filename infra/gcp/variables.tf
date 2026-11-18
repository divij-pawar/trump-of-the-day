variable "project_id" {
  description = "GCP project to deploy into (billing must be enabled for Cloud Run, even inside the free tier)."
  type        = string
}

variable "region" {
  description = "Cloud Run and Artifact Registry region. us-central1, us-east1 and us-west1 are Tier 1 (cheapest) regions."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  type    = string
  default = "trump-of-the-day-api"
}

variable "hosting_site_id" {
  description = "Firebase Hosting site id; the site is served at https://<id>.web.app. Must be globally unique."
  type        = string
}

variable "github_repository" {
  description = "owner/name of the repo allowed to deploy via Workload Identity Federation."
  type        = string
  default     = "divij-pawar/trump-of-the-day"
}

variable "github_deploy_ref" {
  type    = string
  default = "refs/heads/main"
}

variable "api_image" {
  description = "Image for the first apply. Google's public hello-world image lets the service be created before CI has pushed one; CI deploys the real image after that (Terraform ignores later image changes)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "max_instances" {
  description = "Hard cap on concurrent Cloud Run instances. This is the real spending limit: the free tier isn't one."
  type        = number
  default     = 2
}

variable "rate_limit_per_minute" {
  type    = number
  default = 300
}

variable "billing_account_id" {
  description = "Billing account id (XXXXXX-XXXXXX-XXXXXX) for the budget alert. Leave empty to skip the budget."
  type        = string
  default     = ""
}

variable "budget_usd" {
  description = "Monthly budget; alerts at 50%, 100% and forecast 100%. Alerts only, it doesn't stop spending."
  type        = number
  default     = 5
}

variable "alert_email" {
  description = "Address for budget and uptime alerts. Leave empty to skip the notification channel and alert policy."
  type        = string
  default     = ""
}
