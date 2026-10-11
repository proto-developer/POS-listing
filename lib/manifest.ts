/**
 * Reads a manifest spreadsheet (.xlsx / .xls / .csv) in the browser.
 * Finds the columns we need by their header names (or by their values for
 * unnamed columns) and turns each row into an Item. The sheet never leaves the browser.
 */

import * as XLSX from "xlsx";
import type { Item } from "./types";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES = {
  name: ["item description", "description", "item name", "name", "title", "product name"],
  brand: ["manufacturer", "brand", "make"],
  model: ["model number", "model", "model no", "mpn"],
  category: ["product category", "category", "department"],
  subcategory: ["sub category", "subcategory"],
  msrp: ["msrp", "rrp", "retail"],
  price: ["price", "sale price", "selling price", "our price"],
  sku: ["sku", "item code", "lot", "lot number", "tag", "stock code"],
  url: ["url", "link", "product url"],
} satisfies Record<string, string[]>;

export type ColumnKey = keyof typeof ALIASES;
export type Cell = string | number | null;

/** One sheet row that will be posted: its raw cells plus the item we read from it. */
export type SheetRow = { row: number; cells: Cell[]; item: Item };

/** The uploaded sheet as the user sees it, plus which column we read each field from. */
export type Manifest = {
  header: string[];
  columns: Partial<Record<ColumnKey, number>>;
  rows: SheetRow[];
};

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  name: "Item name",
  sku: "SKU",
  price: "Price",
  brand: "Brand",
  model: "Model",
  category: "Category",
  subcategory: "Type",
  msrp: "RRP",
  url: "URL",
};

export class ManifestError extends Error {}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown) => String(v ?? "").trim();
const cell = (v: unknown): Cell => (v === null || v === undefined ? null : typeof v === "number" ? v : str(v));

/** Throws ManifestError with a message fit for the user. */
export async function readManifest(file: File): Promise<Manifest> {
  let rows: unknown[][];
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
  } catch {
    throw new ManifestError("Couldn't read that file. Use .xlsx, .xls or .csv");
  }
  if (!rows.length) throw new ManifestError("No items found in that file");

  const width = Math.max(...rows.map((r) => r.length));
  const rawHeader = Array.from({ length: width }, (_, c) => str(rows[0][c]));
  const header = rawHeader.map(norm);
  const body = rows.slice(1);
  const col: Partial<Record<ColumnKey, number>> = {};

  for (const [key, names] of Object.entries(ALIASES) as [ColumnKey, string[]][]) {
    const i = names.map((n) => header.indexOf(n)).find((i) => i >= 0);
    if (i !== undefined) col[key] = i;
  }

  // Unnamed columns: detect SKU (e.g. A1369) and URL by their values
  for (let c = 0; c < width; c++) {
    if (header[c] || Object.values(col).includes(c)) continue;
    const vals = body.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
    if (!vals.length) continue;
    const share = (re: RegExp) => vals.filter((v) => re.test(v)).length / vals.length;
    if (col.url === undefined && share(/^https?:\/\//i) > 0.6) col.url = c;
    else if (col.sku === undefined && share(/^[A-Z]{1,4}-?\d{2,}$/i) > 0.6) col.sku = c;
  }

  const get = (r: unknown[], k: ColumnKey) => (col[k] === undefined ? null : r[col[k]!]);

  const out: SheetRow[] = [];
  body.forEach((r, i) => {
    const item: Item = {
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
    };
    // drop totals / empty rows
    if (item.name || item.sku || item.brand || item.model) {
      out.push({ row: i + 2, cells: Array.from({ length: width }, (_, c) => cell(r[c])), item });
    }
  });

  if (!out.length) throw new ManifestError("No items found in that file");
  return { header: rawHeader, columns: col, rows: out };
}
