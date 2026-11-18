resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project}-redis"
  subnet_ids = aws_subnet.private[*].id
}

# Single node: Redis is a cache and rate-limit store here, not a system of record.
# The API serves straight from Postgres if Redis is unavailable (api/src/cache.ts).
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project}-redis"
  description                = "API response cache and rate-limit counters"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 1
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = false
  apply_immediately          = true
  snapshot_retention_limit   = 0
}

locals {
  redis_url = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
}
