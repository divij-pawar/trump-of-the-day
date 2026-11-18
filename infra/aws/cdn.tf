resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "${var.project}-frontend-"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project}-frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The bucket is private; only this distribution can read it.
data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

# AWS managed cache/origin-request policies.
locals {
  cache_policy_caching_optimized    = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled     = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  cache_policy_origin_cache_ctrl_q  = "4cc15a8a-d715-48a4-82b8-cc0b614ced06" # UseOriginCacheControlHeaders-QueryStrings
  origin_request_all_viewer_no_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
  s3_origin_id                      = "frontend-s3"
  api_origin_id                     = "api-alb"
}

# One origin for the browser: the SPA from S3, /api/* and /ws from the ALB.
# Same-origin means no CORS, and the visitor only ever sees CloudFront.
resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = var.project
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = var.domain_names

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = aws_lb.api.dns_name

    custom_origin_config {
      http_port  = 80
      https_port = 443
      # CloudFront -> ALB is HTTP inside AWS's network; the viewer leg is HTTPS.
      # For end-to-end TLS, add an ACM cert + 443 listener on the ALB and switch
      # this to https-only.
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 30
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.cache_policy_caching_optimized
  }

  # Edge-caches API responses for as long as the API's Cache-Control allows
  # (60s for recent days, up to 5 min for older ones), keyed on the query string.
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = local.cache_policy_origin_cache_ctrl_q
    origin_request_policy_id = local.origin_request_all_viewer_no_host
  }

  ordered_cache_behavior {
    path_pattern             = "/ws"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = local.cache_policy_caching_disabled
    origin_request_policy_id = local.origin_request_all_viewer_no_host
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == ""
    acm_certificate_arn            = var.acm_certificate_arn == "" ? null : var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn == "" ? null : "sni-only"
    minimum_protocol_version       = var.acm_certificate_arn == "" ? "TLSv1" : "TLSv1.2_2021"
  }
}
