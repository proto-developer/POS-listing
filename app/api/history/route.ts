import { NextResponse } from "next/server";
import { addUpload, readHistory } from "@/lib/history";
import type { Upload } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await readHistory());
}

export async function POST(req: Request) {
  const u = (await req.json()) as Upload;
  return NextResponse.json(await addUpload({ ...u, id: crypto.randomUUID(), at: new Date().toISOString() }));
}
