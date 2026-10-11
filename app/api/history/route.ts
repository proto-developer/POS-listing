import { NextResponse } from "next/server";
import { userName } from "@/lib/auth";
import { addUpload, readHistory, removeUpload } from "@/lib/history";
import { mode as squareMode } from "@/lib/square";
import type { Upload } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await readHistory());
}

const MAX_SKIPPED = 2000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 1_000_000_000) : 0);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Partial<Upload> | null;
  const file = b ? str(b.file, 200) : "";
  if (!b || !file) return NextResponse.json({ ok: false, error: "Bad upload record" }, { status: 400 });

  // Only the stats of the upload are stored, never the sheet itself. Everything is re-typed and capped here.
  const u: Upload = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    file,
    mode: squareMode, // from the server config, not the client
    user: userName,
    seconds: count(b.seconds),
    total: count(b.total),
    created: count(b.created),
    exists: count(b.exists),
    value: typeof b.value === "number" && Number.isFinite(b.value) && b.value >= 0 ? Math.min(b.value, 1e12) : 0,
    skipped: Array.isArray(b.skipped)
      ? b.skipped.slice(0, MAX_SKIPPED).map((s) => ({
          row: typeof s?.row === "number" && Number.isInteger(s.row) ? s.row : undefined,
          sku: str(s?.sku, 255),
          name: str(s?.name, 300),
          reason: str(s?.reason, 300),
        }))
      : [],
  };
  try {
    return NextResponse.json(await addUpload(u));
  } catch (e) {
    console.error("[history] save failed:", e);
    return NextResponse.json({ ok: false, error: "Could not save the upload to the database" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  try {
    return NextResponse.json(await removeUpload(id));
  } catch (e) {
    console.error("[history] remove failed:", e);
    return NextResponse.json({ ok: false, error: "Could not remove the upload" }, { status: 500 });
  }
}
