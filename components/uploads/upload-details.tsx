"use client";

/** Everything about one upload: result ring, facts grid and the skipped rows. */

import { duration, modeLabel, money, num } from "@/lib/format";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RowNumber } from "./row-number";
import { UploadSummary } from "./upload-summary";

export function UploadDetails({ u, currency, stacked = false }: { u: Upload; currency: string; stacked?: boolean }) {
  const facts = [
    { k: "Date", v: new Date(u.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) },
    { k: "Mode", v: modeLabel(u.mode) },
    { k: "Took", v: duration(u.seconds) },
    { k: "Rows in sheet", v: num(u.total) },
    { k: "Added", v: num(u.created) },
    { k: "Already in Square", v: num(u.exists) },
    { k: "Skipped", v: num(u.skipped.length), warn: u.skipped.length > 0 },
    { k: "Stock value", v: money(u.value, currency) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <UploadSummary u={u} currency={currency} stacked={stacked} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-secondary/60 p-4 text-sm sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{f.k}</dt>
            <dd className={cn("truncate font-medium tabular-nums", f.warn && "text-warning")} title={f.v}>{f.v}</dd>
          </div>
        ))}
      </dl>
      {u.skipped.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Items that weren't added</p>
          <ul className="divide-y overflow-hidden rounded-xl border">
            {u.skipped.map((s, i) => (
              <li key={i} className="flex items-stretch text-sm">
                <RowNumber n={s.row} />
                <span className="min-w-0 flex-1 px-4 py-2.5">
                  <span className="block truncate font-medium">{s.name || "Untitled"}</span>
                  <span className="block truncate text-xs text-warning">{s.sku ? `${s.sku} · ` : ""}{s.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
