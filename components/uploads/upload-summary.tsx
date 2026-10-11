"use client";

/** Ring + headline + counts + value/time badges for one upload. */

import { Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { duration, money } from "@/lib/format";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ResultRing } from "./result-ring";

export function UploadSummary({ u, currency, stacked = false }: { u: Upload; currency: string; stacked?: boolean }) {
  const pct = u.total ? Math.round(((u.created + u.exists) / u.total) * 100) : 0;
  const rows = [
    { show: true, dot: "bg-success", text: <><b className="font-semibold">{u.created}</b> {u.created === 1 ? "item" : "items"} added to Square</> },
    { show: u.exists > 0, dot: "bg-primary", text: <><b className="font-semibold">{u.exists}</b> {u.exists === 1 ? "was" : "were"} already there</> },
    { show: u.skipped.length > 0, dot: "bg-warning", text: <><b className="font-semibold">{u.skipped.length}</b> skipped</> },
  ];

  return (
    <div className={cn("flex flex-col items-center gap-6", !stacked && "sm:flex-row sm:gap-8")}>
      <ResultRing u={u} size={148} thickness={14}>
        <span className="text-3xl font-semibold tracking-tight">{pct}%</span>
        <span className="text-xs text-muted-foreground">in Square</span>
      </ResultRing>

      <div className={cn("flex w-full flex-col gap-4 text-center", !stacked && "sm:text-left")}>
        <div>
          <p className="text-lg font-semibold tracking-tight">
            {u.skipped.length === 0 ? "Everything's on Square 🎉" : `${u.created + u.exists} of ${u.total} items are on Square`}
          </p>
          <p className="text-sm text-muted-foreground">
            {u.skipped.length === 0 ? "Nothing needs your attention." : "Skipped items weren't added. You can add them by hand."}
          </p>
        </div>

        <ul className={cn("flex flex-col items-center gap-1.5 text-sm", !stacked && "sm:items-start")}>
          {rows.filter((r) => r.show).map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", r.dot)} />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>

        <div className={cn("flex flex-wrap justify-center gap-2", !stacked && "sm:justify-start")}>
          <Badge variant="secondary" className="py-1">
            <Tag />
            {money(u.value, currency)} of stock added
          </Badge>
          <Badge variant="secondary" className="py-1">
            <Clock />
            Done in {duration(u.seconds)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
