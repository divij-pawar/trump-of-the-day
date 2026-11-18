output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.api.name
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub."
  value       = aws_iam_role.github_deploy.arn
}

output "secret_ids_to_populate" {
  description = "Secrets Manager entries that need values (aws secretsmanager put-secret-value)."
  value       = [for s in aws_secretsmanager_secret.app : s.name]
}
