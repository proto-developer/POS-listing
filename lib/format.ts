/** Display formatting. Pure functions, safe in the browser and on the server. */

import type { SquareMode } from "./types";

/** Always the full figure with thousands separators ("$30,929"), never abbreviated ("30.9K"). */
export const money = (n: number, currency: string) =>
  n.toLocaleString(undefined, {
    ...(currency ? { style: "currency", currency } : {}),
    maximumFractionDigits: 0,
  });

export const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** "Today, 3:12 PM", "Yesterday, 9:04 AM", or "Mon, 6 Oct". */
export function when(iso: string) {
  const d = new Date(iso);
  const day = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (day === today) return `Today, ${time}`;
  if (today - day === 86_400_000) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export const duration = (s: number) =>
  s < 60 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? "" : "s"}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

export const MODE_LABEL: Record<SquareMode | string, string> = { sandbox: "Square sandbox", live: "Square live" };
export const modeLabel = (mode: string) => MODE_LABEL[mode] ?? mode;
