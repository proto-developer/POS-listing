import { NextResponse } from "next/server";
import { currency, mode, pushItem } from "@/lib/square";
import { missingFields, type Item } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ mode, currency: await currency() });
}

export async function POST(req: Request) {
  const item = (await req.json()) as Item;
  const missing = missingFields(item);
  if (missing.length) return NextResponse.json({ ok: false, error: "Missing data", fields: missing });
  return NextResponse.json(await pushItem(item));
}
