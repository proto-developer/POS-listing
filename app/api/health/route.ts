import { userName } from "@/server/auth/session";
import { dbStatus } from "@/server/db/client";
import { handler, json } from "@/server/http";
import { squareStatus } from "@/server/square/status";

/** GET → whether the database and Square are reachable with the configured credentials. 503 if either isn't. */
export const GET = handler(async () => {
  const [db, square] = await Promise.all([dbStatus(), squareStatus()]);
  const ok = db.ok && square.ok;
  return json({ ok, user: userName, db, square }, { status: ok ? 200 : 503 });
});
