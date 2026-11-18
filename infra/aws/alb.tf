resource "aws_lb" "api" {
  name               = "${var.project}-api"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  # WebSocket connections are kept alive by 30s server pings (api/src/hub.ts);
  # this only has to outlast the gap between them.
  idle_timeout               = 120
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "api" {
  name                 = "${var.project}-api"
  port                 = 8080
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  # Readiness, not liveness: a task that can't reach Postgres is taken out of
  # rotation. If every task fails (e.g. a Neon outage), the ALB fails open and
  # keeps routing to all of them, and the API answers 503s with a clear message
  # rather than the ALB returning its own errors. Container liveness is the
  # Docker HEALTHCHECK on /healthz (ecs.tf), which doesn't depend on the DB, so
  # a DB outage doesn't make ECS restart-loop healthy tasks.
  health_check {
    path                = "/readyz"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "from_cloudfront" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [random_password.origin_verify.result]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
