import { NextResponse } from "next/server";
import { userName } from "@/lib/auth";
import { dbStatus } from "@/lib/db";
import { status as squareStatus } from "@/lib/square";

/** One call to see whether the database and Square are reachable with the configured credentials. */
export async function GET() {
  const [db, square] = await Promise.all([dbStatus(), squareStatus()]);
  return NextResponse.json({ ok: db.ok && square.ok, user: userName, db, square }, { status: db.ok && square.ok ? 200 : 503 });
}
