variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "trump-of-the-day"
}

variable "aws_region" {
  description = "Region for everything except the CloudFront certificate (which must be us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "github_repository" {
  description = "owner/name of the repo allowed to assume the deploy role via OIDC."
  type        = string
  default     = "divij-pawar/trump-of-the-day"
}

variable "github_deploy_ref" {
  description = "Git ref allowed to deploy."
  type        = string
  default     = "refs/heads/main"
}

variable "create_github_oidc_provider" {
  description = "Set false if the account already has the token.actions.githubusercontent.com OIDC provider (one per account)."
  type        = bool
  default     = true
}

variable "api_image_tag" {
  description = "Tag of the API image in ECR for the initial task definition. CI registers new revisions after this."
  type        = string
  default     = "latest"
}

variable "api_cpu" {
  type    = number
  default = 256
}

variable "api_memory" {
  type    = number
  default = 512
}

variable "api_min_tasks" {
  description = "At least 2 so a task replacement or AZ loss doesn't take the API down."
  type        = number
  default     = 2
}

variable "api_max_tasks" {
  type    = number
  default = 6
}

variable "api_rate_limit_per_minute" {
  type    = number
  default = 300
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "domain_names" {
  description = "Optional custom domains (e.g. [\"trumpoftheday.com\"]). Requires acm_certificate_arn."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate in us-east-1 covering domain_names. Leave empty to use the *.cloudfront.net domain."
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Optional address subscribed to the alarm SNS topic."
  type        = string
  default     = ""
}
