/**
 * Domain types shared by the browser and the server.
 * Nothing in here touches the network, the database or process.env.
 */

/* ---------- Manifest rows ---------- */

/** One row of the manifest, as read from the sheet. */
export type Item = {
  row: number;
  name: string;
  sku: string;
  price: number | null;
  brand: string;
  model: string;
  category: string;
  subcategory: string;
  msrp: number | null;
  url: string;
};

/** The fields Square cannot do without. */
export type Field = "name" | "sku" | "price";
export const REQUIRED: Field[] = ["name", "sku", "price"];
export const FIELD_LABEL: Record<Field, string> = { name: "Item name", sku: "SKU", price: "Price" };

export function missingFields(item: Item): Field[] {
  return REQUIRED.filter((f) => {
    const v = item[f];
    if (f === "price") return v === null || !(Number(v) > 0);
    return !String(v ?? "").trim();
  });
}

/** Short, clean display name: "Frigidaire FDSH4501AS" instead of the full description. */
export function shortName(it: Pick<Item, "brand" | "model" | "name">) {
  const s = [it.brand, it.model].filter(Boolean).join(" ");
  return s || it.name;
}

/* ---------- Posting to Square ---------- */

export type PushResult =
  | { ok: true; status: "created" | "exists"; id?: string }
  | { ok: false; error: string; fields?: Field[] };

export type SquareMode = "sandbox" | "live";

/** Whether the configured token and location work, with what we learned about them. */
export type SquareStatus = {
  mode: SquareMode;
  ok: boolean;
  /** Location name, e.g. "Main Store" */
  location?: string;
  currency?: string;
  error?: string;
};

/* ---------- Upload history ---------- */

export type SkippedRow = { row?: number; sku: string; name: string; reason: string };

/** The stats of one manifest upload. This is what the database stores; never the sheet itself. */
export type Upload = {
  id: string;
  file: string;
  at: string; // ISO date
  seconds: number;
  total: number;
  created: number;
  exists: number;
  skipped: SkippedRow[];
  value: number; // sum of prices listed
  mode: SquareMode | string;
  user?: string; // who ran the upload
};

export type DbStatus = { ok: boolean; db: string; error?: string };

/* ---------- API responses ---------- */

export type ApiFailure = { ok: false; error: string };

/* ---------- Inline toast feed ---------- */

export type FeedType = "loading" | "success" | "info" | "warning" | "error" | "default";

export type FeedToast = {
  id: string;
  type: FeedType;
  title: string;
  description?: string;
  /** ms before it fades out; omitted keeps it until replaced or dismissed */
  duration?: number;
};
