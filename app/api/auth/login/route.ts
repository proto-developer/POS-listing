import { AUTH_SETUP_MESSAGE, authConfigured, COOKIE, cookieOptions, createSession } from "@/server/auth/session";
import { checkCredentials } from "@/server/auth/credentials";
import { ApiError, handler, json, readJson } from "@/server/http";
import { isObject, str } from "@/server/validate";

/** POST { username, password } → sets the session cookie. */
export const POST = handler(async (req) => {
  if (!authConfigured) throw new ApiError(503, AUTH_SETUP_MESSAGE);

  const body = await readJson(req);
  const username = isObject(body) ? str(body.username, 100) : "";
  const password = isObject(body) && typeof body.password === "string" ? body.password.slice(0, 200) : "";

  if (!username || !password || !checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 200)); // slow down guessing
    throw new ApiError(401, "Wrong username or password");
  }

  const res = json({ ok: true });
  res.cookies.set(COOKIE, await createSession(), cookieOptions);
  return res;
});
