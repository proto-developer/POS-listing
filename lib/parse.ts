import * as XLSX from "xlsx";
import type { Item } from "./types";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<string, string[]> = {
  name: ["item description", "description", "item name", "name", "title", "product name"],
  brand: ["manufacturer", "brand", "make"],
  model: ["model number", "model", "model no", "mpn"],
  category: ["product category", "category", "department"],
  subcategory: ["sub category", "subcategory"],
  msrp: ["msrp", "rrp", "retail"],
  price: ["price", "sale price", "selling price", "our price"],
  sku: ["sku", "item code", "lot", "lot number", "tag", "stock code"],
  url: ["url", "link", "product url"],
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function parseFile(file: File): Promise<Item[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  if (!rows.length) return [];

  const header = (rows[0] as unknown[]).map(norm);
  const body = rows.slice(1) as unknown[][];
  const col: Record<string, number> = {};

  for (const [key, names] of Object.entries(ALIASES)) {
    const i = names.map((n) => header.indexOf(n)).find((i) => i >= 0);
    if (i !== undefined) col[key] = i;
  }

  // Unnamed columns: detect SKU (e.g. A1369) and URL by their values
  const width = Math.max(...rows.map((r) => (r as unknown[]).length));
  for (let c = 0; c < width; c++) {
    if (header[c] || Object.values(col).includes(c)) continue;
    const vals = body.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
    if (!vals.length) continue;
    const share = (re: RegExp) => vals.filter((v) => re.test(v)).length / vals.length;
    if (col.url === undefined && share(/^https?:\/\//i) > 0.6) col.url = c;
    else if (col.sku === undefined && share(/^[A-Z]{1,4}-?\d{2,}$/i) > 0.6) col.sku = c;
  }

  const get = (r: unknown[], k: string) => (col[k] === undefined ? null : r[col[k]]);
  const str = (v: unknown) => String(v ?? "").trim();

  return body
    .map((r, i) => ({
      row: i + 2,
      name: str(get(r, "name")),
      sku: str(get(r, "sku")),
      price: num(get(r, "price")),
      brand: str(get(r, "brand")),
      model: str(get(r, "model")),
      category: str(get(r, "category")),
      subcategory: str(get(r, "subcategory")),
      msrp: num(get(r, "msrp")),
      url: str(get(r, "url")),
    }))
    // drop totals / empty rows
    .filter((it) => it.name || it.sku || it.brand || it.model);
}
