# API

Fastify service in [`api/`](../api/). In production it's served under the site's own origin (`/api/*`, `/ws`) via CloudFront. Locally it runs on `:8080`.

Dates are always `YYYY-MM-DD` strings in UTC calendar days, matching how the pipeline buckets articles. Errors are JSON: `{"error": "<code>", "message": "..."}`.

## Endpoints

### `GET /api/news?date=YYYY-MM-DD`
One day's stories, best relevance first (at most 100), plus that day's brief if there is one.

```json
{
  "date": "2025-03-01",
  "digest": {
    "date": "2025-03-01",
    "summary": "…\n\n…",
    "paragraphs": [[{ "text": "First sentence.", "story_ids": [812, 799] }, { "text": "…", "story_ids": [805] }], [ … ]],
    "top_story_ids": [812, 799],
    "model": "upstage/solar-pro-3:free"
  },
  "items": [
    { "id": 812, "date": "2025-03-01", "title": "…", "description": "…", "link": "https://…",
      "news_source": "apnews.com", "image_url": "https://…", "relevance_score": 6.5 }
  ]
}
```

`digest` is `null` if the brief hasn't been generated. `digest.model` is the model that wrote it (shown on the site as "Summarized by …"). `digest.paragraphs` is the same text as `summary`, one array per paragraph and one entry per sentence, each with the ids of the stories that sentence cites (the site renders them as numbered links to the story cards). It's `null` for briefs written without citations; fall back to `summary`. `400` for a malformed date. `Cache-Control: public, max-age=60` for today and yesterday, `max-age=300` for older days.

### `GET /api/dates/latest`
`{"date": "2025-03-01"}`: the newest date with any stories (`null` on an empty database). The frontend opens on this day.

### `GET /api/news/:id/similar`
Up to 5 nearest stories to `:id` across all dates, by cosine distance between embeddings: `{"id": 812, "items": [{...story, "distance": 0.12}]}`. Empty `items` if the story has no embedding yet; `404` if the id doesn't exist.

### `GET /api/search?q=...&limit=10`
Semantic search across the archive. `q` is 2 to 200 characters and is lowercased and trimmed; `limit` is 1 to 20. The query is embedded with Voyage (`voyage-3.5`, `input_type: query`) and matched against stored document embeddings. Returns `{"q": "...", "items": [...]}` like `/similar`. `503 search_disabled` if `VOYAGE_API_KEY` isn't configured.

### `GET /healthz`
Liveness: `{"status":"ok"}` whenever the process is serving. It has no dependencies, so a database outage doesn't make ECS restart healthy tasks. Used by the container `HEALTHCHECK`.

### `GET /readyz`
Readiness: `200` if Postgres answers, else `503`. Used by the ALB target group.

```json
{ "status": "ready", "checks": { "db": true, "redis": true, "live": true }, "websocketClients": 412 }
```

Redis and the `LISTEN` connection are reported but don't affect the status code, because the API works without them.

Neither health endpoint is rate limited or requires the origin header.

## WebSocket: `GET /ws`

Server to client:

| Message | When |
|---|---|
| `{"type":"hello","clients":N}` | On connect. `N` is the number of clients on that task. |
| `{"type":"news_updated","date":"YYYY-MM-DD"}` | The pipeline published stories (or a new brief) for that date. |
| `{"type":"pong","t":<echo>}` | Reply to a client ping. |

Client to server: `{"type":"ping","t":<number>}`. This is optional and used by the load test to measure round-trip time. Anything else is ignored, and frames over 1 KB close the connection.

The server sends a WebSocket protocol ping every 30 s and drops clients that don't answer. The frontend reconnects with exponential backoff (1 s to 60 s).

## Rate limiting

300 requests per minute per client IP by default (`RATE_LIMIT_MAX`), with counters in Redis so they're shared across tasks. Over the limit returns `429 rate_limited` with `retry-after`. Behind CloudFront and the ALB, the client IP is read from `X-Forwarded-For` with `TRUST_PROXY_HOPS=2`, so clients can't spoof it by sending their own header.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Read-only, pooled Neon connection string |
| `DATABASE_URL_DIRECT` | no | Read-only, direct (non-pooler) connection string for `LISTEN`. Without it, live updates are off. |
| `REDIS_URL` | no | `redis://` or `rediss://`. Without it (the GCP deployment), the API uses a bounded in-process cache and rate limits are per instance. |
| `VOYAGE_API_KEY` | no | Enables `/api/search`. Empty or `unset` (the GCP placeholder secret) means off. |
| `ORIGIN_VERIFY_SECRET` | no | If set, requests without a matching `X-Origin-Verify` header get 403 (except health checks) |
| `RATE_LIMIT_MAX` | no | Requests per minute per IP (default 300) |
| `TRUST_PROXY_HOPS` | no | Proxies in front of the API (2 behind CloudFront and the ALB; default 0) |
| `PORT`, `HOST`, `LOG_LEVEL` | no | Defaults `8080`, `0.0.0.0`, `info` |
