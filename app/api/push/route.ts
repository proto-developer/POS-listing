import { missingFields, type Item } from "@/lib/types";
import { ApiError, handler, json, readJson } from "@/server/http";
import { pushItem } from "@/server/square/catalog";
import { squareStatus } from "@/server/square/status";
import { int, isObject, num, str } from "@/server/validate";

/** GET → Square connection status: mode, location, currency, or the error. */
export const GET = handler(async () => json(await squareStatus()));

/** Accept only the fields we post to Square, with sane types and lengths. */
function parseItem(b: unknown): Item {
  if (!isObject(b)) throw new ApiError(400, "Bad item");
  return {
    row: int(b.row, 1_000_000, 0)!,
    name: str(b.name, 512),
    sku: str(b.sku, 255),
    price: num(b.price, 10_000_000),
    brand: str(b.brand, 255),
    model: str(b.model, 255),
    category: str(b.category, 255),
    subcategory: str(b.subcategory, 255),
    msrp: num(b.msrp, 10_000_000),
    url: str(b.url, 2048),
  };
}

/** POST an Item → PushResult. Rows missing a name, SKU or price are refused with the field list. */
export const POST = handler(async (req) => {
  const item = parseItem(await readJson(req));
  const missing = missingFields(item);
  if (missing.length) return json({ ok: false, error: "Missing data", fields: missing });
  return json(await pushItem(item));
});
