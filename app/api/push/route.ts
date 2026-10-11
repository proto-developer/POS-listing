import { NextResponse } from "next/server";
import { pushItem, status } from "@/lib/square";
import { missingFields, type Item } from "@/lib/types";

/** Square connection status: mode, location, currency, or the error. */
export async function GET() {
  return NextResponse.json(await status());
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

/** Accept only the fields we post to Square, with sane types and lengths. */
function parseItem(b: unknown): Item | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const row = typeof o.row === "number" && Number.isInteger(o.row) && o.row >= 0 && o.row <= 1_000_000 ? o.row : 0;
  return {
    row,
    name: str(o.name, 512),
    sku: str(o.sku, 255),
    price: num(o.price, 10_000_000),
    brand: str(o.brand, 255),
    model: str(o.model, 255),
    category: str(o.category, 255),
    subcategory: str(o.subcategory, 255),
    msrp: num(o.msrp, 10_000_000),
    url: str(o.url, 2048),
  };
}

/** List one item on Square. */
export async function POST(req: Request) {
  const item = parseItem(await req.json().catch(() => null));
  if (!item) return NextResponse.json({ ok: false, error: "Bad item" }, { status: 400 });
  const missing = missingFields(item);
  if (missing.length) return NextResponse.json({ ok: false, error: "Missing data", fields: missing });
  return NextResponse.json(await pushItem(item));
}
