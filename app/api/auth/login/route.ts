import { NextResponse } from "next/server";
import { AUTH_SETUP_MESSAGE, authConfigured, COOKIE, cookieOptions, createSession } from "@/lib/auth";
import { checkCredentials } from "@/lib/credentials";

export async function POST(req: Request) {
  if (!authConfigured) return NextResponse.json({ ok: false, error: AUTH_SETUP_MESSAGE }, { status: 503 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.slice(0, 100) : "";
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";

  if (!username || !password || !checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 200)); // slow down guessing
    return NextResponse.json({ ok: false, error: "Wrong username or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSession(), cookieOptions);
  return res;
}
