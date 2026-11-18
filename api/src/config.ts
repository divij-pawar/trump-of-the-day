export interface Config {
  port: number;
  host: string;
  /** Read-only, pooled connection string (role news_readonly). */
  databaseUrl: string;
  /**
   * Optional non-pooled connection string used only for LISTEN. Neon's pgbouncer
   * endpoint (`-pooler` host) runs in transaction mode, which doesn't support
   * LISTEN/NOTIFY, so live updates need the direct host.
   */
  databaseUrlDirect: string | undefined;
  redisUrl: string | undefined;
  voyageApiKey: string | undefined;
  /** Requests per minute per client IP. */
  rateLimitMax: number;
  /** Shared secret CloudFront adds as X-Origin-Verify; requests without it are rejected. */
  originVerifySecret: string | undefined;
  /** Proxies in front of the API (CloudFront + ALB = 2) whose X-Forwarded-For entries to trust. */
  trustProxyHops: number;
  logLevel: string;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`${name} must be an integer, got "${raw}"`);
  return value;
}

/**
 * Optional setting; empty and "unset" both mean absent. "unset" is the placeholder
 * secret version infra/gcp creates so Cloud Run can start before a real value exists.
 */
function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value !== "unset" ? value : undefined;
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  return {
    port: int("PORT", 8080),
    host: process.env.HOST ?? "0.0.0.0",
    databaseUrl,
    databaseUrlDirect: optional("DATABASE_URL_DIRECT"),
    redisUrl: optional("REDIS_URL"),
    voyageApiKey: optional("VOYAGE_API_KEY"),
    rateLimitMax: int("RATE_LIMIT_MAX", 300),
    originVerifySecret: optional("ORIGIN_VERIFY_SECRET"),
    trustProxyHops: int("TRUST_PROXY_HOPS", 0),
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
}
