# Secret *containers* only. Values are written out of band so they never land in
# Terraform state or the repo:
#
#   aws secretsmanager put-secret-value --secret-id trump-of-the-day/database-url \
#     --secret-string 'postgresql://news_readonly:...@ep-xxx-pooler.../neondb?sslmode=require'
#
# See docs/infrastructure.md for the full list.
locals {
  app_secrets = {
    database_url        = "Read-only pooled Neon connection string (role news_readonly)"
    database_url_direct = "Read-only direct (non-pooler) Neon connection string, used for LISTEN"
    voyage_api_key      = "Voyage AI key for query embeddings (/api/search)"
  }
}

resource "aws_secretsmanager_secret" "app" {
  for_each                = local.app_secrets
  name                    = "${var.project}/${replace(each.key, "_", "-")}"
  description             = each.value
  recovery_window_in_days = 7
}

# CloudFront sends this header to the ALB, which drops requests without it. It's
# generated here (so it is in state) because the CloudFront origin config needs
# the literal value.
resource "random_password" "origin_verify" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "origin_verify" {
  name                    = "${var.project}/origin-verify"
  description             = "Shared secret between CloudFront and the API (X-Origin-Verify header)"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "origin_verify" {
  secret_id     = aws_secretsmanager_secret.origin_verify.id
  secret_string = random_password.origin_verify.result
}
