/**
 * Signed session cookies. Edge-safe (used by middleware): Web Crypto only.
 * Password checking lives in ./credentials.ts (Node only).
 *
 * Token = expiry . random nonce . HMAC(user, expiry, nonce).
 * Changing the user or the secret ends every session.
 */

import { env, SETUP } from "@/server/env";

export const COOKIE = "lister_session";

const { user: USER, secret: SECRET, minSecretLength, sessionDays } = env.auth;
const HAS_PASSWORD = !!(env.auth.passwordHash || env.auth.password);

/** Everything needed to sign in is configured. Nobody can sign in, and no session verifies, until it is. */
export const authConfigured = !!USER && HAS_PASSWORD && SECRET.length >= minSecretLength;
export const userName = USER;
export const AUTH_SETUP_MESSAGE = !USER || !HAS_PASSWORD ? SETUP.authAccount : SECRET.length < minSecretLength ? SETUP.authSecret : "";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

let keyPromise: Promise<CryptoKey> | null = null;
const key = () =>
  (keyPromise ??= crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));

const sign = async (data: string) => hex(await crypto.subtle.sign("HMAC", await key(), enc.encode(data)));

/** Constant-time string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<string> {
  const exp = String(Date.now() + sessionDays * 86_400_000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `${exp}.${nonce}.${await sign(`${USER}\n${exp}\n${nonce}`)}`;
}

export async function verifySession(token?: string | null): Promise<boolean> {
  if (!authConfigured || !token || token.length > 200) return false;
  const [exp, nonce, sig] = token.split(".");
  if (!exp || !nonce || !sig || !/^\d{1,16}$/.test(exp) || !/^[0-9a-f]{32}$/.test(nonce) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(`${USER}\n${exp}\n${nonce}`));
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.isProduction,
  path: "/",
  maxAge: sessionDays * 86_400,
};
