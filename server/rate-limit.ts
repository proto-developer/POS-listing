/**
 * Fixed-window rate limiter kept in process memory. Edge-safe (used by middleware).
 * Each running instance counts separately, so on multi-instance hosting the
 * effective limit is per instance.
 */

const buckets = new Map<string, { n: number; reset: number }>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.n++;
  return b.n > limit ? { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) } : { ok: true, retryAfter: 0 };
}

/**
 * Client IP for rate limiting. x-forwarded-for is only trustworthy behind your own reverse proxy
 * (Vercel, nginx, Cloudflare); on a bare `next start` every client shares one bucket, which is
 * still safe, just stricter.
 */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}
