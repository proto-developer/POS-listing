/**
 * Every request passes through here (see `config.matcher`): cross-site write
 * protection, body-size cap, rate limits, the login wall, and a per-request
 * Content-Security-Policy nonce. Edge runtime: only edge-safe modules are imported.
 */

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/server/auth/session";
import { env } from "@/server/env";
import { clientIp, rateLimit } from "@/server/rate-limit";

const PUBLIC = ["/login", "/api/auth/login"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BODY = 2 * 1024 * 1024; // 2 MB — history records are a few KB, items a few hundred bytes
const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  api: { limit: 300, windowMs: 60_000 },
};

const deny = (status: number, error: string, headers?: Record<string, string>) =>
  NextResponse.json({ ok: false, error }, { status, headers });

function hostOf(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

/** Build the CSP with a fresh nonce; Next.js reads it from the request headers and tags its own scripts. */
function withCsp(req: NextRequest) {
  const dev = !env.isProduction;
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // Radix, Recharts and Vaul set inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`, // dev: hot reload socket
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // 1. Writes must come from this site (defence in depth on top of the SameSite cookie)
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host") ?? "";
    if ((origin && hostOf(origin) !== host) || req.headers.get("sec-fetch-site") === "cross-site") {
      return deny(403, "Cross-site requests are not allowed");
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return deny(413, "Request body too large");
  }

  // 2. Rate limits
  const ip = clientIp(req.headers);
  if (pathname === "/api/auth/login" && req.method === "POST") {
    const r = rateLimit(`login:${ip}`, LIMITS.login.limit, LIMITS.login.windowMs);
    if (!r.ok) return deny(429, "Too many sign-in attempts. Try again later.", { "Retry-After": String(r.retryAfter) });
  } else if (isApi) {
    const r = rateLimit(`api:${ip}`, LIMITS.api.limit, LIMITS.api.windowMs);
    if (!r.ok) return deny(429, "Too many requests", { "Retry-After": String(r.retryAfter) });
  }

  // 3. Login wall
  const signedIn = await verifySession(req.cookies.get(COOKIE)?.value);
  if (PUBLIC.includes(pathname)) {
    if (signedIn && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return withCsp(req);
  }
  if (!signedIn) {
    if (isApi) return deny(401, "Please sign in");
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return withCsp(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
