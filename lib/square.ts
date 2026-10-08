import "server-only";
import type { Field, Item, PushResult } from "./types";

const TOKEN = process.env.SQUARE_ACCESS_TOKEN?.trim();
const BASE =
  process.env.SQUARE_ENV === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
const SET_STOCK = (process.env.SQUARE_SET_STOCK ?? "true") !== "false";

export const mode = TOKEN ? (process.env.SQUARE_ENV === "sandbox" ? "sandbox" : "live") : "demo";

class SquareError extends Error {
  fields?: Field[];
  constructor(msg: string, fields?: Field[]) {
    super(msg);
    this.fields = fields;
  }
}

async function sq<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(BASE + path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": "2025-01-23",
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errs: any[] = json.errors ?? [];
    const msg = errs.map((e) => e.detail || e.code).join("; ") || `Square returned ${res.status}`;
    const fields = new Set<Field>();
    for (const e of errs) {
      const f = String(e.field ?? "").toLowerCase();
      if (f.includes("price") || f.includes("amount")) fields.add("price");
      if (f.includes("sku")) fields.add("sku");
      if (f.endsWith("name")) fields.add("name");
    }
    throw new SquareError(msg, fields.size ? [...fields] : undefined);
  }
  return json;
}

// ---- cached account context ----
let ctx: Promise<{ locationId: string; currency: string }> | null = null;
function context() {
  ctx ??= (async () => {
    const id = process.env.SQUARE_LOCATION_ID?.trim() || "main";
    const { location } = await sq(`/v2/locations/${id}`);
    return { locationId: location.id as string, currency: location.currency as string };
  })().catch((e) => {
    ctx = null;
    throw e;
  });
  return ctx;
}

let categories: Map<string, string> | null = null;
async function categoryId(name: string): Promise<string | undefined> {
  if (!name) return;
  if (!categories) {
    categories = new Map();
    let cursor: string | undefined;
    do {
      const r = await sq("/v2/catalog/search", { body: { object_types: ["CATEGORY"], cursor } });
      for (const o of r.objects ?? []) categories.set(o.category_data.name.toLowerCase(), o.id);
      cursor = r.cursor;
    } while (cursor);
  }
  const key = name.toLowerCase();
  if (categories.has(key)) return categories.get(key);
  const r = await sq("/v2/catalog/object", {
    body: {
      idempotency_key: crypto.randomUUID(),
      object: { type: "CATEGORY", id: "#cat", category_data: { name } },
    },
  });
  categories.set(key, r.catalog_object.id);
  return r.catalog_object.id;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

export async function currency(): Promise<string> {
  if (mode === "demo") return "";
  try {
    return (await context()).currency;
  } catch {
    return "";
  }
}

export async function pushItem(item: Item): Promise<PushResult> {
  if (mode === "demo") {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 320));
    return { ok: true, status: "created" };
  }

  try {
    const { locationId, currency } = await context();

    // Skip if SKU already in catalog (safe to re-upload the same sheet)
    const existing = await sq("/v2/catalog/search", {
      body: {
        object_types: ["ITEM_VARIATION"],
        query: { exact_query: { attribute_name: "sku", attribute_value: item.sku } },
        limit: 1,
      },
    });
    if (existing.objects?.length) return { ok: true, status: "exists", id: existing.objects[0].id };

    const catId = await categoryId(titleCase(item.category));
    const description = [
      item.brand && `Brand: ${item.brand}`,
      item.model && `Model: ${item.model}`,
      item.subcategory && `Type: ${item.subcategory}`,
      item.msrp && `RRP: ${item.msrp}`,
    ]
      .filter(Boolean)
      .join("\n");

    const r = await sq("/v2/catalog/object", {
      body: {
        idempotency_key: `${item.sku}-${crypto.randomUUID()}`,
        object: {
          type: "ITEM",
          id: "#item",
          present_at_all_locations: true,
          item_data: {
            name: item.name.slice(0, 512),
            description: description || undefined,
            ...(catId ? { categories: [{ id: catId }], reporting_category: { id: catId } } : {}),
            variations: [
              {
                type: "ITEM_VARIATION",
                id: "#var",
                present_at_all_locations: true,
                item_variation_data: {
                  name: item.model || "Regular",
                  sku: item.sku,
                  pricing_type: "FIXED_PRICING",
                  price_money: { amount: Math.round(Number(item.price) * 100), currency },
                  track_inventory: SET_STOCK,
                },
              },
            ],
          },
        },
      },
    });

    const varId = r.id_mappings?.find((m: any) => m.client_object_id === "#var")?.object_id;
    if (SET_STOCK && varId) {
      await sq("/v2/inventory/changes/batch-create", {
        body: {
          idempotency_key: crypto.randomUUID(),
          changes: [
            {
              type: "PHYSICAL_COUNT",
              physical_count: {
                catalog_object_id: varId,
                state: "IN_STOCK",
                location_id: locationId,
                quantity: "1",
                occurred_at: new Date().toISOString(),
              },
            },
          ],
        },
      });
    }
    return { ok: true, status: "created", id: r.catalog_object.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error", fields: e?.fields };
  }
}
