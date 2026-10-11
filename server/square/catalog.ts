/**
 * Listing items on Square: duplicate check by SKU, category lookup/creation,
 * item + variation creation, and the stock count.
 */

import "server-only";
import type { Item, PushResult } from "@/lib/types";
import { env } from "@/server/env";
import { context, NOT_CONFIGURED, sq, SquareError } from "./client";

let categories: Map<string, string> | null = null;

/** Id of the category with this name, creating it if needed. Names are cached per process. */
async function categoryId(name: string): Promise<string | undefined> {
  if (!name) return;
  if (!categories) {
    const found = new Map<string, string>();
    let cursor: string | undefined;
    do {
      const r = await sq("/v2/catalog/search", { body: { object_types: ["CATEGORY"], cursor } });
      for (const o of r.objects ?? []) found.set(String(o.category_data?.name ?? "").toLowerCase(), o.id);
      cursor = r.cursor;
    } while (cursor);
    categories = found;
  }
  const key = name.toLowerCase();
  const known = categories.get(key);
  if (known) return known;
  const r = await sq("/v2/catalog/object", {
    body: { idempotency_key: crypto.randomUUID(), object: { type: "CATEGORY", id: "#cat", category_data: { name } } },
  });
  categories.set(key, r.catalog_object.id);
  return r.catalog_object.id;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/&-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

/** Post one item. Never throws: every failure is a PushResult with Square's message. */
export async function pushItem(item: Item): Promise<PushResult> {
  if (!env.square.configured) return { ok: false, error: NOT_CONFIGURED };

  try {
    const { locationId, currency } = await context();

    // Skip if the SKU is already in the catalog (safe to re-upload the same sheet)
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
                  track_inventory: env.square.setStock,
                },
              },
            ],
          },
        },
      },
    });

    const varId = r.id_mappings?.find((m: { client_object_id: string }) => m.client_object_id === "#var")?.object_id;
    if (env.square.setStock && varId) {
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
  } catch (e) {
    if (e instanceof SquareError) return { ok: false, error: e.message, fields: e.fields };
    console.error("[square] push failed:", e);
    return { ok: false, error: "Unexpected error while talking to Square" };
  }
}
