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

export type Field = "name" | "sku" | "price";

export const REQUIRED: Field[] = ["name", "sku", "price"];

export const FIELD_LABEL: Record<Field, string> = {
  name: "Item name",
  sku: "SKU",
  price: "Price",
};

export function missingFields(item: Item): Field[] {
  return REQUIRED.filter((f) => {
    const v = item[f];
    if (f === "price") return v === null || !(Number(v) > 0);
    return !String(v ?? "").trim();
  });
}

export type PushResult =
  | { ok: true; status: "created" | "exists"; id?: string }
  | { ok: false; error: string; fields?: Field[] };

export type Upload = {
  id: string;
  file: string;
  at: string; // ISO date
  seconds: number;
  total: number;
  created: number;
  exists: number;
  skipped: { row?: number; sku: string; name: string; reason: string }[];
  value: number; // sum of prices listed
  mode: string;
};

/** Short, clean display name: "Frigidaire FDSH4501AS" instead of the full description */
export function shortName(it: Pick<Item, "brand" | "model" | "name">) {
  const s = [it.brand, it.model].filter(Boolean).join(" ");
  return s || it.name;
}
