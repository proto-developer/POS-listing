"use client";

/** Widget 1: this month's items added, the Square connection, a breakdown panel and an all-time footnote. */

import { Card } from "@/components/ui/card";
import { money, num, plural } from "@/lib/format";
import { inMonth, sumBy } from "@/lib/stats";
import type { SquareStatus, Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

function connection(square: SquareStatus) {
  if (!square.ok) return { label: "Square not connected", dot: "bg-destructive" };
  const where = square.location ? ` · ${square.location}` : "";
  return square.mode === "sandbox" ? { label: `Square sandbox${where}`, dot: "bg-warning" } : { label: `Square live${where}`, dot: "bg-success" };
}

export function StatsCard({ history, currency, square }: { history: Upload[]; currency: string; square: SquareStatus }) {
  const month = history.filter((u) => inMonth(u));
  const monthName = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const status = connection(square);

  const added = sumBy(month, (u) => u.created);
  const skipped = sumBy(month, (u) => u.skipped.length);
  const rows = [
    { k: "Already in Square", v: num(sumBy(month, (u) => u.exists)) },
    { k: "Skipped", v: skipped ? `-${num(skipped)}` : "0", warn: skipped > 0 },
    { k: "Stock value added", v: money(sumBy(month, (u) => u.value), currency) },
  ];
  const allSkipped = sumBy(history, (u) => u.skipped.length);

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
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 py-1">
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className={cn("font-medium tabular-nums", r.warn && "text-warning")}>{r.v}</dd>
            </div>
          ))}
          <div className="my-1 border-t" />
          <div className="flex items-center justify-between gap-4 py-1">
            <dt className="font-medium">Rows uploaded</dt>
            <dd className="font-medium tabular-nums">
              {num(sumBy(month, (u) => u.total))} <span className="font-normal text-muted-foreground">in {plural(month.length, "upload")}</span>
            </dd>
          </div>
        </dl>

        <p className="mt-auto pt-4 text-xs leading-relaxed text-muted-foreground">
          All time: {num(sumBy(history, (u) => u.created))} items added across {plural(history.length, "upload")},{" "}
          {money(sumBy(history, (u) => u.value), currency)} of stock{allSkipped > 0 && `, ${num(allSkipped)} rows skipped`}.
        </p>
      </div>
    </Card>
  );
}
