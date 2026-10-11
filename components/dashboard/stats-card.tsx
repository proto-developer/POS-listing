"use client";

// Widget 1: this month's items added, the Square mode, a breakdown panel and
// an all-time footnote, so every stat lives in one quiet place.

import { Card } from "@/components/ui/card";
import { money, num } from "@/components/uploads";
import type { SquareStatus } from "@/lib/square";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

const sum = (list: Upload[], pick: (u: Upload) => number) => list.reduce((n, u) => n + pick(u), 0);

export function StatsCard({ history, currency, square }: { history: Upload[]; currency: string; square: SquareStatus }) {
  const now = new Date();
  const month = history.filter((u) => {
    const d = new Date(u.at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const status = !square.ok
    ? { label: "Square not connected", dot: "bg-destructive" }
    : square.mode === "sandbox"
      ? { label: `Square sandbox${square.location ? ` · ${square.location}` : ""}`, dot: "bg-warning" }
      : { label: `Square live${square.location ? ` · ${square.location}` : ""}`, dot: "bg-success" };

  const added = sum(month, (u) => u.created);
  const skipped = sum(month, (u) => u.skipped.length);
  const rowsOut = [
    { k: "Already in Square", v: num(sum(month, (u) => u.exists)) },
    { k: "Skipped", v: skipped ? `-${num(skipped)}` : "0", warn: skipped > 0 },
    { k: "Stock value added", v: money(sum(month, (u) => u.value), currency) },
  ];

  return (
    <Card className="flex h-full flex-col gap-0 rounded-xl py-0 shadow-none">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Items added · {monthName}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{num(added)}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-0.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
        </div>

        <dl className="mt-4 rounded-xl bg-secondary/50 px-4 py-2.5 text-sm">
          {rowsOut.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 py-1">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className={cn("font-medium tabular-nums", r.warn && "text-warning")}>{r.v}</dd>
            </div>
          ))}
          <div className="my-1 border-t" />
          <div className="flex items-center justify-between gap-4 py-1">
            <dt className="font-medium">Rows uploaded</dt>
            <dd className="font-medium tabular-nums">
              {num(sum(month, (u) => u.total))}{" "}
              <span className="font-normal text-muted-foreground">in {num(month.length)} {month.length === 1 ? "upload" : "uploads"}</span>
            </dd>
          </div>
        </dl>

        <p className="mt-auto pt-4 text-xs leading-relaxed text-muted-foreground">
          All time: {num(sum(history, (u) => u.created))} items added across {num(history.length)} {history.length === 1 ? "upload" : "uploads"},{" "}
          {money(sum(history, (u) => u.value), currency)} of stock
          {sum(history, (u) => u.skipped.length) > 0 && `, ${num(sum(history, (u) => u.skipped.length))} rows skipped`}.
        </p>
      </div>
    </Card>
  );
}
