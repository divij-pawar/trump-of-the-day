resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 20 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project}-api"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "main" {
  name = var.project

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential = true
    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]
    environment = [
      { name = "PORT", value = "8080" },
      { name = "REDIS_URL", value = local.redis_url },
      { name = "RATE_LIMIT_MAX", value = tostring(var.api_rate_limit_per_minute) },
      # CloudFront -> ALB -> task: the client address is two X-Forwarded-For hops back.
      { name = "TRUST_PROXY_HOPS", value = "2" },
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.app["database_url"].arn },
      { name = "DATABASE_URL_DIRECT", valueFrom = aws_secretsmanager_secret.app["database_url_direct"].arn },
      { name = "VOYAGE_API_KEY", valueFrom = aws_secretsmanager_secret.app["voyage_api_key"].arn },
      { name = "ORIGIN_VERIFY_SECRET", valueFrom = aws_secretsmanager_secret.origin_verify.arn },
    ]
    # Liveness only (no dependencies), so a Postgres outage doesn't make ECS
    # kill and replace otherwise healthy tasks. Readiness is the ALB check.
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1"]
      interval    = 15
      timeout     = 3
      retries     = 3
      startPeriod = 10
    }
    readonlyRootFilesystem = true
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name                              = "${var.project}-api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = var.api_min_tasks
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 30
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }

  # Roll back automatically if new tasks never pass health checks.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    # CI registers new task definition revisions and autoscaling owns the count.
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener_rule.from_cloudfront]
}

# --- Autoscaling -----------------------------------------------------------

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_min_tasks
  max_capacity       = var.api_max_tasks
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project}-api-cpu"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "api_requests" {
  name               = "${var.project}-api-requests"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    # Sized from the k6 run in docs/load-testing.md; revisit after re-running it.
    target_value       = 1000
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.api.arn_suffix}/${aws_lb_target_group.api.arn_suffix}"
    }
  }
}
