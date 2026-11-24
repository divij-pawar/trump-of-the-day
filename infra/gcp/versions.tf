terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5"
    }
  }

  # Remote state in a GCS bucket (versioned; GCS backends lock natively):
  #   terraform init -backend-config=backend.hcl
  # (see backend.hcl.example). CI runs `init -backend=false` for validation only.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
  # The Billing Budgets API needs a quota project when called with user credentials.
  user_project_override = true
  billing_project       = var.project_id
}

# Credentials come from the environment, so they never land in tfvars:
#   export UPSTASH_EMAIL=you@example.com UPSTASH_API_KEY=…   (console.upstash.com → Account → Management API)
provider "upstash" {}
