/**
 * Tiny coercion helpers for request bodies. They never throw: a bad value becomes
 * the safe default, so routes decide what is required and what is optional.
 */

export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Trimmed string capped at `max` characters, or "". */
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Finite number within [0, max], or null. */
export const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

/** Non-negative integer count capped at `max`, or 0. */
export const count = (v: unknown, max = 1_000_000_000) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0;

/** Integer within [0, max], or `fallback`. */
export const int = (v: unknown, max: number, fallback: number | undefined = undefined) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : fallback;

export const UUID = /^[0-9a-f-]{36}$/i;
