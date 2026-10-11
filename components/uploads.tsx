"use client";

// Pieces shared by the upload page, the dashboard and the sidebar: formatting
// helpers, the result ring, the per-upload summary and the upload detail drawer.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Tag, Trash2 } from "lucide-react";
import { Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Always the full figure with thousands separators ("$30,929"), never abbreviated ("30.9K"). */
export const money = (n: number, currency: string) =>
  n.toLocaleString(undefined, {
    ...(currency ? { style: "currency", currency } : {}),
    maximumFractionDigits: 0,
  });

export const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function when(iso: string) {
  const d = new Date(iso);
  const day = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (day === today) return `Today, ${time}`;
  if (today - day === 86400000) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export const duration = (s: number) =>
  s < 60 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? "" : "s"}`;

export const MODE_LABEL: Record<string, string> = { sandbox: "Square sandbox", live: "Square live" };

export function RowNo({ n }: { n?: number }) {
  return (
    <span className="flex w-10 shrink-0 items-center justify-center border-r bg-secondary/60 font-mono text-[11px] tabular-nums text-muted-foreground sm:w-12">
      {n ?? "—"}
    </span>
  );
}

const ringConfig = {
  added: { label: "Added", color: "var(--success)" },
  there: { label: "Already there", color: "var(--primary)" },
  skipped: { label: "Skipped", color: "var(--warning)" },
} satisfies ChartConfig;

export function Ring({ u, size, thickness, animate = true, children }: { u: Upload; size: number; thickness: number; animate?: boolean; children?: React.ReactNode }) {
  const data = [
    { key: "added", value: u.created, fill: "var(--color-added)" },
    { key: "there", value: u.exists, fill: "var(--color-there)" },
    { key: "skipped", value: u.skipped.length, fill: "var(--color-skipped)" },
  ].filter((d) => d.value > 0);
  const r = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ChartContainer config={ringConfig} className="size-full">
        <PieChart>
          <Pie
            data={data.length ? data : [{ key: "none", value: 1, fill: "var(--secondary)" }]}
            dataKey="value"
            nameKey="key"
            innerRadius={r - thickness}
            outerRadius={r}
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={0}
            minAngle={10}
            paddingAngle={data.length > 1 ? 4 : 0}
            cornerRadius={data.length > 1 ? 2 : 0}
            isAnimationActive={animate}
            animationDuration={900}
          />
        </PieChart>
      </ChartContainer>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

export function Summary({ u, currency, stacked = false }: { u: Upload; currency: string; stacked?: boolean }) {
  const pct = u.total ? Math.round(((u.created + u.exists) / u.total) * 100) : 0;
  const rows = [
    { show: true, dot: "bg-success", text: <><b className="font-semibold">{u.created}</b> {u.created === 1 ? "item" : "items"} added to Square</> },
    { show: u.exists > 0, dot: "bg-primary", text: <><b className="font-semibold">{u.exists}</b> {u.exists === 1 ? "was" : "were"} already there</> },
    { show: u.skipped.length > 0, dot: "bg-warning", text: <><b className="font-semibold">{u.skipped.length}</b> skipped</> },
  ];

  return (
    <div className={cn("flex flex-col items-center gap-6", !stacked && "sm:flex-row sm:gap-8")}>
      <Ring u={u} size={148} thickness={14}>
        <span className="text-3xl font-semibold tracking-tight">{pct}%</span>
        <span className="text-xs text-muted-foreground">in Square</span>
      </Ring>

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

/** Everything about one upload: facts grid, result ring and the skipped rows. */
export function UploadDetails({ u, currency, stacked = false }: { u: Upload; currency: string; stacked?: boolean }) {
  const facts = [
    { k: "Date", v: new Date(u.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) },
    { k: "Mode", v: MODE_LABEL[u.mode] ?? u.mode },
    { k: "Took", v: duration(u.seconds) },
    { k: "Rows in sheet", v: num(u.total) },
    { k: "Added", v: num(u.created) },
    { k: "Already in Square", v: num(u.exists) },
    { k: "Skipped", v: num(u.skipped.length), warn: u.skipped.length > 0 },
    { k: "Stock value", v: money(u.value, currency) },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Summary u={u} currency={currency} stacked={stacked} />
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
                <RowNo n={s.row} />
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

export function UploadDrawer({ u, currency, onClose }: { u: Upload | null; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!u || !window.confirm(`Remove "${u.file}" from the history? Items already on Square are not affected.`)) return;
    setRemoving(true);
    const res = await fetch(`/api/history?id=${encodeURIComponent(u.id)}`, { method: "DELETE" }).catch(() => null);
    setRemoving(false);
    if (res?.ok) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Drawer open={!!u} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        {u && (
          <div className="mx-auto flex w-full max-w-xl flex-col overflow-y-auto">
            <DrawerHeader className="pt-6">
              <DrawerTitle className="truncate">{u.file}</DrawerTitle>
              <DrawerDescription>{when(u.at)} · {MODE_LABEL[u.mode] ?? u.mode}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <UploadDetails u={u} currency={currency} />
            </div>
            <DrawerFooter className="flex-row pb-8 pt-6">
              <Button variant="ghost" className="h-11 text-muted-foreground" onClick={remove} disabled={removing}>
                {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Remove from history
              </Button>
              <Button variant="outline" className="h-11 flex-1" onClick={onClose}>Close</Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
