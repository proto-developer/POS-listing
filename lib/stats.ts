/** Small aggregation helpers used by the dashboard. Pure. */

import type { Upload } from "./types";

export const DAY_MS = 86_400_000;

export const sumBy = (list: Upload[], pick: (u: Upload) => number) => list.reduce((n, u) => n + pick(u), 0);

/** Midnight (local time) of the given date, as a timestamp. */
export const dayKey = (d: Date | string) => new Date(d).setHours(0, 0, 0, 0);

/** True if the upload happened in the month `offset` months from now (0 = this month, -1 = last month). */
export function inMonth(u: Upload, offset = 0) {
  const d = new Date(u.at);
  const m = new Date();
  m.setMonth(m.getMonth() + offset);
  return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
}
