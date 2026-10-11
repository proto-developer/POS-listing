"use client";

/**
 * Widget 2: one bar per weekday for the last 7 days. Click a bar to pick that
 * day, choose one of the files uploaded that day, then "View full report" opens its details.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadDrawer } from "@/components/uploads/upload-drawer";
import { num, plural } from "@/lib/format";
import { DAY_MS, dayKey } from "@/lib/stats";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = 7;

export function ActivityCard({ history, currency }: { history: Upload[]; currency: string }) {
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);
  const [fileId, setFileId] = useState("");
  const [viewing, setViewing] = useState<Upload | null>(null);

  const days = Array.from({ length: DAYS }, (_, i) => {
    const t = today - (DAYS - 1 - i) * DAY_MS;
    const uploads = history.filter((u) => dayKey(u.at) === t);
    return {
      t,
      label: new Date(t).toLocaleDateString(undefined, { weekday: "short" }),
      uploads,
      items: uploads.reduce((n, u) => n + u.created, 0),
    };
  });
  const max = Math.max(1, ...days.map((d) => d.items));
  const picked = days.find((d) => d.t === day) ?? days[DAYS - 1];
  const files = picked.uploads;

  // When the day changes, default to the first file uploaded that day
  useEffect(() => { setFileId(files[0]?.id ?? ""); }, [day, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = files.find((u) => u.id === fileId) ?? files[0] ?? null;
  const dayTitle = new Date(picked.t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  return (
    <Card className="flex h-full flex-col gap-0 rounded-xl py-0 shadow-none">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-sm font-medium">Daily uploads</p>
        <p className="text-xs text-muted-foreground">Last 7 days · click a day to see its files</p>

        {/* Bars: one per weekday */}
        <div className="mt-4 flex min-h-40 flex-1 items-end gap-2 sm:gap-2.5">
          {days.map((d) => {
            const h = d.items ? Math.max(10, (d.items / max) * 100) : 4;
            const active = d.t === picked.t;
            return (
              <button
                key={d.t}
                type="button"
                onClick={() => setDay(d.t)}
                aria-pressed={active}
                aria-label={`${d.label}: ${d.items} items added in ${d.uploads.length} uploads`}
                title={`${num(d.items)} items added · ${plural(d.uploads.length, "upload")}`}
                className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2 self-stretch outline-none"
              >
                <span
                  className={cn(
                    "w-full rounded-lg transition-[height,background-color] duration-300 ease-out group-hover:bg-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring/50",
                    active ? "bg-primary/80" : d.items ? "bg-primary/30" : "bg-foreground/8"
                  )}
                  style={{ height: `${h}%` }}
                />
                <span className={cn("truncate text-[11px]", active ? "font-medium text-foreground" : "text-muted-foreground")}>{d.label}</span>
              </button>
            );
          })}
        </div>

        {/* Picked day: choose a file uploaded that day */}
        <div className="mt-4 rounded-xl bg-secondary/50 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{dayTitle}</p>
          {files.length ? (
            <Select value={chosen?.id ?? ""} onValueChange={setFileId}>
              <SelectTrigger className="mt-2 w-full rounded-lg bg-background" aria-label="File uploaded on this day">
                <SelectValue placeholder="Choose a file" />
              </SelectTrigger>
              <SelectContent>
                {files.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="truncate">{u.file}</span>
                    <span className="text-muted-foreground"> · {num(u.created)} added</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <p className="mt-1.5 text-sm font-medium">No uploads</p>
              <p className="text-xs text-muted-foreground">Nothing was listed on this day</p>
            </>
          )}
        </div>

        <Button variant="outline" className="mt-3 h-10 w-full" onClick={() => chosen && setViewing(chosen)} disabled={!chosen}>
          View full report
        </Button>
      </div>

      <UploadDrawer u={viewing} currency={currency} onClose={() => setViewing(null)} />
    </Card>
  );
}
