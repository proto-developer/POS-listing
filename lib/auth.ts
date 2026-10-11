// Session handling. Edge-safe (used by middleware): Web Crypto only, no Node imports.
// Password checking lives in lib/credentials.ts (Node only).

export const COOKIE = "lister_session";
export const SESSION_DAYS = 7;
const MIN_SECRET = 32;

const USER = process.env.LISTER_USER?.trim() ?? "";
const HAS_PASSWORD = !!(process.env.LISTER_PASSWORD_HASH?.trim() || process.env.LISTER_PASSWORD?.trim());
const SECRET = process.env.LISTER_SECRET?.trim() ?? "";

/** Everything needed to sign in is configured. Nobody can sign in, and no session verifies, until it is. */
export const authConfigured = !!USER && HAS_PASSWORD && SECRET.length >= MIN_SECRET;
export const userName = USER;
export const AUTH_SETUP_MESSAGE = !USER || !HAS_PASSWORD
  ? "Set LISTER_USER and LISTER_PASSWORD_HASH (npm run hash-password) in .env.local, then restart the app"
  : SECRET.length < MIN_SECRET
    ? `Set LISTER_SECRET in .env.local to a random string of at least ${MIN_SECRET} characters, then restart the app`
    : "";

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

/** Token = expiry . random nonce . HMAC(user, expiry, nonce). Changing the user or the secret ends every session. */
export async function createSession(): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
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
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
