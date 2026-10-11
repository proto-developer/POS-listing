import { COOKIE, cookieOptions } from "@/server/auth/session";
import { handler, json } from "@/server/http";

/** POST → clears the session cookie. */
export const POST = handler(async () => {
  const res = json({ ok: true });
  res.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
});
