/**
 * Building blocks for API route handlers: one error shape, one place that
 * catches and logs, and a JSON body reader. Every route is `handler(async (req) => ...)`.
 *
 * Response shape: success returns whatever the route returns; failure is
 * `{ ok: false, error: string, ...extra }` with a matching HTTP status.
 */

import { NextResponse } from "next/server";

/** Throw this from a route to answer with a specific status and message. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
  }
}

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) =>
  NextResponse.json({ ok: false, error, ...extra }, { status, headers });

type RouteContext = { params: Promise<Record<string, string | string[]>> };
type Route = (req: Request, ctx: RouteContext) => Promise<Response> | Response;

/** Wraps a route: ApiError becomes its status, anything else is logged and becomes a generic 500. */
export function handler(route: Route): Route {
  return async (req, ctx) => {
    try {
      return await route(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message, e.extra);
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}:`, e);
      return fail(500, "Something went wrong on the server");
    }
  };
}

/** The JSON body, or a 400. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
}
