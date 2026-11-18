terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.10"
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

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}
