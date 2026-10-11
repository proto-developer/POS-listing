/**
 * The upload flow's business logic: walk the rows, post each to Square, ask the
 * user about rows that can't be posted, and tally the result. UI-free: it reports
 * through the callbacks it is given, so it can be driven by a hook or a test.
 */

import { api, ApiClientError } from "./api-client";
import { rowToast } from "./row-toasts";
import { FIELD_LABEL, missingFields, REQUIRED, shortName, type FeedToast, type Field, type Item, type PushResult, type Upload } from "./types";

export type RowStatus = "pending" | "active" | "fixing" | "created" | "exists" | "skipped";
export type Issue = { item: Item; error: string; fields: Field[] };
export type Resolution = { action: "retry"; item: Item } | { action: "skip" };

export type RunnerCallbacks = {
  /** A row changed state. */
  onStatus: (index: number, status: RowStatus) => void;
  /** The user fixed a row's data; keep the new item. */
  onItem: (index: number, item: Item) => void;
  /** Show or update a toast. */
  toast: (t: FeedToast) => void;
  /** Ask the user to fix or skip a row. Resolves when they answer. */
  ask: (issue: Issue) => Promise<Resolution>;
  /** Resolves immediately unless the run is paused, then when it is resumed. */
  waitIfPaused: () => Promise<void>;
};

/** Post one item. Never throws: every failure is a PushResult the row loop can act on. */
export async function pushItem(item: Item): Promise<PushResult> {
  try {
    return await api<PushResult>("/api/push", { body: item });
  } catch (e) {
    return { ok: false, error: e instanceof ApiClientError ? e.message : "Network error. Check your connection." };
  }
}

export async function runUpload(
  input: { items: Item[]; file: string; currency: string; mode: string },
  cb: RunnerCallbacks,
  push: (item: Item) => Promise<PushResult> = pushItem
): Promise<Upload> {
  const list = [...input.items];
  const t0 = Date.now();
  const tally = { created: 0, exists: 0, value: 0, skipped: [] as Upload["skipped"] };
  cb.toast(rowToast.start(list.length, input.file));

  for (let i = 0; i < list.length; i++) {
    await cb.waitIfPaused();
    let item = list[i];
    cb.onStatus(i, "active");

    // Loop until the row is posted, found, or skipped; each pass may be a retry after a fix.
    for (;;) {
      const missing = missingFields(item);
      cb.toast(missing.length ? rowToast.needs(item, missing) : rowToast.checking(item, input.currency));
      const res: PushResult = missing.length ? { ok: false, error: "", fields: missing } : await push(item);

      if (res.ok) {
        cb.onStatus(i, res.status);
        if (res.status === "created") {
          tally.created++;
          tally.value += Number(item.price) || 0;
          cb.toast(rowToast.created(item, input.currency));
        } else {
          tally.exists++;
          cb.toast(rowToast.exists(item));
        }
        break;
      }

      cb.onStatus(i, "fixing");
      if (res.error) cb.toast(rowToast.error(item, res.error));
      const answer = await cb.ask({ item, error: res.error, fields: res.fields?.length ? res.fields : REQUIRED });
      if (answer.action === "skip") {
        const reason = res.error || `Missing ${missing.map((m) => FIELD_LABEL[m].toLowerCase()).join(", ")}`;
        cb.onStatus(i, "skipped");
        tally.skipped.push({ row: item.row, sku: item.sku, name: shortName(item), reason });
        cb.toast(rowToast.skipped(item, reason));
        break;
      }
      item = answer.item;
      list[i] = item;
      cb.onItem(i, item);
      cb.onStatus(i, "active");
    }
  }

  return {
    id: "",
    at: new Date().toISOString(),
    file: input.file,
    mode: input.mode,
    seconds: Math.round((Date.now() - t0) / 1000),
    total: list.length,
    ...tally,
  };
}

/** Save the stats of a finished upload. Throws ApiClientError with a message fit to show. */
export function saveUpload(upload: Upload) {
  return api<Upload[]>("/api/history", { body: upload });
}
