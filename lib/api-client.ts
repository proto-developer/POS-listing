/**
 * The browser's one way to call our API. Every failure becomes an ApiClientError
 * with a message fit to show, whether it came from the server or the network.
 */

export class ApiClientError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

const DEFAULT_ERROR: Record<number, string> = {
  401: "Your session has expired. Sign in again.",
  403: "That request was blocked.",
  413: "That request was too large.",
  429: "Too many requests. Wait a moment and try again.",
};

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiClientError("Network error. Check your connection.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && typeof data.error === "string" && data.error) || DEFAULT_ERROR[res.status] || `Server returned ${res.status}`;
    throw new ApiClientError(message, res.status);
  }
  return data as T;
}

/** Message for any thrown value, for places that show errors to the user. */
export const errorMessage = (e: unknown, fallback = "Something went wrong") =>
  e instanceof Error && e.message ? e.message : fallback;
