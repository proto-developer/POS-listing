import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { authConfigured, safeEqual, userName } from "./auth";

// Password checking (Node only). Prefer LISTER_PASSWORD_HASH (scrypt, made with `npm run hash-password`);
// LISTER_PASSWORD (plain text) is accepted so a first setup is easy, but the hash is what to keep.

const HASH = process.env.LISTER_PASSWORD_HASH?.trim() ?? "";
const PLAIN = process.env.LISTER_PASSWORD?.trim() ?? "";

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

// Format: scrypt:<salt hex>:<hash hex>. Colons, not "$", because .env files expand "$VAR".
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex || !/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Both checks always run, so a wrong username takes as long as a wrong password. */
export function checkCredentials(username: string, password: string): boolean {
  if (!authConfigured) return false;
  const userOk = safeEqual(username.trim(), userName);
  const passOk = HASH ? verifyPassword(password, HASH) : safeEqual(password, PLAIN);
  return userOk && passOk;
}
