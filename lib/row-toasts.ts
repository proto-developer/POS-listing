/**
 * Builds the toast shown for one sheet row at each step of posting.
 * Toasts are keyed by row number, so each step replaces the previous one in place.
 */

import { money } from "./format";
import { FIELD_LABEL, shortName, type FeedToast, type Field, type Item } from "./types";

const id = (it: Item) => `row-${it.row}`;
const title = (it: Item) => `Row ${it.row} · ${shortName(it) || "No name"}`;
const meta = (it: Item, currency: string) =>
  [it.sku, it.price != null ? money(it.price, currency) : "no price"].filter(Boolean).join(" · ");

export const missingText = (fields: Field[]) => fields.map((f) => FIELD_LABEL[f].toLowerCase()).join(" & ");

export const rowToast = {
  checking: (it: Item, currency: string): FeedToast => ({
    id: id(it), type: "loading", title: title(it), description: `${meta(it, currency)} · Checking Square…`,
  }),
  needs: (it: Item, fields: Field[]): FeedToast => ({
    id: id(it), type: "warning", title: title(it), description: `Needs a ${missingText(fields)} · waiting for you`,
  }),
  error: (it: Item, error: string): FeedToast => ({ id: id(it), type: "error", title: title(it), description: error }),
  created: (it: Item, currency: string): FeedToast => ({
    id: id(it), type: "success", title: title(it), description: `Added to Square · ${meta(it, currency)}`, duration: 4000,
  }),
  exists: (it: Item): FeedToast => ({
    id: id(it), type: "info", title: title(it), description: `Already in Square · ${it.sku}`, duration: 4000,
  }),
  skipped: (it: Item, reason: string): FeedToast => ({
    id: id(it), type: "warning", title: title(it), description: `Skipped · ${reason}`, duration: 6000,
  }),
  start: (count: number, file: string): FeedToast => ({
    id: "run", type: "default", title: `Listing ${count} rows on Square`, description: file, duration: 3000,
  }),
  paused: (): FeedToast => ({ id: "pause", type: "default", title: "Paused", description: "Nothing is posted until you resume" }),
};
