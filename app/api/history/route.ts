import type { Upload } from "@/lib/types";
import { userName } from "@/server/auth/session";
import { createUpload, deleteUpload, listUploads } from "@/server/db/uploads";
import { env } from "@/server/env";
import { ApiError, handler, json, readJson } from "@/server/http";
import { count, int, isObject, num, str, UUID } from "@/server/validate";

const MAX_SKIPPED = 2000;

/** GET → uploads, newest first. */
export const GET = handler(async () => json(await listUploads()));

/** Only the stats of the upload are stored, never the sheet itself. Everything is re-typed and capped here. */
function parseUpload(b: unknown): Upload {
  if (!isObject(b)) throw new ApiError(400, "Bad upload record");
  const file = str(b.file, 200);
  if (!file) throw new ApiError(400, "Bad upload record");
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    file,
    mode: env.square.mode, // from the server config, not the client
    user: userName,
    seconds: count(b.seconds),
    total: count(b.total),
    created: count(b.created),
    exists: count(b.exists),
    value: num(b.value, 1e12) ?? 0,
    skipped: Array.isArray(b.skipped)
      ? b.skipped.slice(0, MAX_SKIPPED).map((s) => ({
          row: isObject(s) ? int(s.row, 10_000_000) : undefined,
          sku: isObject(s) ? str(s.sku, 255) : "",
          name: isObject(s) ? str(s.name, 300) : "",
          reason: isObject(s) ? str(s.reason, 300) : "",
        }))
      : [],
  };
}

/** POST an Upload → the updated list. */
export const POST = handler(async (req) => {
  const upload = parseUpload(await readJson(req));
  try {
    return json(await createUpload(upload));
  } catch (e) {
    console.error("[history] save failed:", e);
    throw new ApiError(500, "Could not save the upload to the database");
  }
});

/** DELETE ?id=<uuid> → the updated list. */
export const DELETE = handler(async (req) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new ApiError(400, "Bad id");
  try {
    return json(await deleteUpload(id));
  } catch (e) {
    console.error("[history] remove failed:", e);
    throw new ApiError(500, "Could not remove the upload");
  }
});
