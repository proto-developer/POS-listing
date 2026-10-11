/** Is Square configured, is the token valid, and which location are we posting to? */

import "server-only";
import type { SquareStatus } from "@/lib/types";
import { env } from "@/server/env";
import { context, NOT_CONFIGURED } from "./client";

let cache: { at: number; value: SquareStatus } | null = null;

/** Cached for a minute so every page doesn't call Square. */
export async function squareStatus(): Promise<SquareStatus> {
  const mode = env.square.mode;
  if (!env.square.configured) return { mode, ok: false, error: NOT_CONFIGURED };
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  let value: SquareStatus;
  try {
    const { name, currency } = await context();
    value = { mode, ok: true, location: name, currency };
  } catch (e) {
    value = { mode, ok: false, error: e instanceof Error ? e.message : "Cannot reach Square" };
  }
  cache = { at: Date.now(), value };
  return value;
}
