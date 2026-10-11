/**
 * Low-level Square API access: one authenticated request helper and the cached
 * account context (location, currency). Everything else in server/square builds on this.
 */

import "server-only";
import type { Field } from "@/lib/types";
import { env, SETUP } from "@/server/env";

export class SquareError extends Error {
  constructor(message: string, public fields?: Field[], public status?: number) {
    super(message);
    this.name = "SquareError";
  }
}

export const NOT_CONFIGURED = SETUP.square;

type SquareApiError = { category?: string; code?: string; detail?: string; field?: string };

/** Call the Square API. Throws SquareError with Square's own message and the fields it complained about. */
export async function sq<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!env.square.configured) throw new SquareError(NOT_CONFIGURED);
  let res: Response;
  try {
    res = await fetch(env.square.baseUrl + path, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${env.square.accessToken}`,
        "Square-Version": env.square.apiVersion,
        "Content-Type": "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new SquareError("Could not reach Square. Check the server's internet connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errs: SquareApiError[] = json.errors ?? [];
    const msg = errs.map((e) => e.detail || e.code).filter(Boolean).join("; ") || `Square returned ${res.status}`;
    const fields = new Set<Field>();
    for (const e of errs) {
      const f = String(e.field ?? "").toLowerCase();
      if (f.includes("price") || f.includes("amount")) fields.add("price");
      if (f.includes("sku")) fields.add("sku");
      if (f.endsWith("name")) fields.add("name");
    }
    throw new SquareError(msg, fields.size ? [...fields] : undefined, res.status);
  }
  return json as T;
}

export type SquareContext = { locationId: string; currency: string; name: string };

let ctx: Promise<SquareContext> | null = null;
/** The configured location, fetched once per process (retried after a failure). */
export function context(): Promise<SquareContext> {
  ctx ??= (async () => {
    const id = env.square.locationId || "main";
    const { location } = await sq(`/v2/locations/${id}`);
    return { locationId: location.id as string, currency: location.currency as string, name: (location.name as string) || "" };
  })().catch((e) => {
    ctx = null;
    throw e;
  });
  return ctx;
}
