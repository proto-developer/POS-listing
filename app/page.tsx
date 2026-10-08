"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Check, CircleDashed, Clock, FileSpreadsheet, Loader2, Pause, Play, RotateCcw, SkipForward, Tag, X,
} from "lucide-react";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Pie, PieChart } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { parseFile } from "@/lib/parse";
import { FIELD_LABEL, missingFields, REQUIRED, shortName, type Field, type Item, type PushResult, type Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "reading" | "ready" | "running" | "done";
type Status = "pending" | "active" | "fixing" | "created" | "exists" | "skipped";
type Issue = { item: Item; error: string; fields: Field[] };
type Resolution = { action: "retry"; item: Item } | { action: "skip" };

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [issue, setIssue] = useState<Issue | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("");
  const [history, setHistory] = useState<Upload[]>([]);
  const [last, setLast] = useState<Upload | null>(null);
  const [viewing, setViewing] = useState<Upload | null>(null);

  const resolver = useRef<((r: Resolution) => void) | null>(null);
  const pausedRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch("/api/push").then((r) => r.json()).then((d) => { setMode(d.mode); setCurrency(d.currency || ""); }).catch(() => {});
    fetch("/api/history").then((r) => r.json()).then(setHistory).catch(() => {});
  }, []);

  const setAt = (i: number, s: Status) => setStatus((prev) => prev.map((v, j) => (j === i ? s : v)));

  async function load(f: File) {
    setError("");
    setFile(f);
    setPhase("reading");
    try {
      const [list] = await Promise.all([parseFile(f), new Promise((r) => setTimeout(r, 600))]);
      if (!list.length) throw new Error("No items found in that file");
      setItems(list);
      setStatus(list.map(() => "pending"));
      setNotes({});
      setPhase("ready");
    } catch (e: any) {
      setError(e?.message?.startsWith("No items") ? e.message : "Couldn't read that file. Use .xlsx, .xls or .csv");
      setPhase("idle");
    }
  }

  const ask = (i: Issue) =>
    new Promise<Resolution>((resolve) => {
      resolver.current = resolve;
      setIssue(i);
    });

  const resolve = (r: Resolution) => {
    setIssue(null);
    resolver.current?.(r);
    resolver.current = null;
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!pausedRef.current) resumeRef.current?.();
  };

  async function push(item: Item): Promise<PushResult> {
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      return await res.json();
    } catch {
      return { ok: false, error: "Network error. Check your connection." };
    }
  }

  async function run() {
    setPhase("running");
    setLast(null);
    const list = [...items];
    const t0 = Date.now();
    const tally = { created: 0, exists: 0, value: 0, skipped: [] as Upload["skipped"] };
    for (let i = 0; i < list.length; i++) {
      if (pausedRef.current) await new Promise<void>((r) => (resumeRef.current = r));
      let item = list[i];
      setAt(i, "active");

      while (true) {
        const missing = missingFields(item);
        const res: PushResult = missing.length ? { ok: false, error: "", fields: missing } : await push(item);

        if (res.ok) {
          setAt(i, res.status);
          if (res.status === "created") { tally.created++; tally.value += Number(item.price) || 0; }
          else tally.exists++;
          if (res.status === "exists") setNotes((n) => ({ ...n, [i]: "Already in Square" }));
          break;
        }

        setAt(i, "fixing");
        const r = await ask({ item, error: res.error, fields: res.fields?.length ? res.fields : REQUIRED });
        if (r.action === "skip") {
          setAt(i, "skipped");
          tally.skipped.push({
            row: item.row, sku: item.sku, name: shortName(item),
            reason: res.error || `Missing ${missing.map((m) => FIELD_LABEL[m].toLowerCase()).join(", ")}`,
          });
          setNotes((n) => ({
            ...n,
            [i]: res.error || `Missing ${missing.map((m) => FIELD_LABEL[m].toLowerCase()).join(", ")}`,
          }));
          break;
        }
        item = r.item;
        list[i] = item;
        setItems([...list]);
        setAt(i, "active");
      }
    }
    const upload: Upload = {
      id: "", at: new Date().toISOString(), file: file?.name ?? "Untitled", mode,
      seconds: Math.round((Date.now() - t0) / 1000), total: list.length, ...tally,
    };
    setLast(upload);
    setPhase("done");
    fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upload) })
      .then((r) => r.json()).then(setHistory).catch(() => {});
  }

  const reset = () => {
    pausedRef.current = false;
    setPaused(false);
    setItems([]);
    setStatus([]);
    setFile(null);
    setPhase("idle");
  };

  const count = (s: Status) => status.filter((v) => v === s).length;
  const finished = status.filter((s) => s === "created" || s === "exists" || s === "skipped").length;
  const needsInput = items.filter((it) => missingFields(it).length).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      {(phase === "idle" || phase === "reading") && (
        <>
          <DropZone reading={phase === "reading"} fileName={file?.name} error={error} onFile={load} />
          {phase === "idle" && history.length > 0 && (
            <Dashboard history={history} currency={currency} onOpen={setViewing} />
          )}
        </>
      )}

      {(phase === "ready" || phase === "running" || phase === "done") && (
        <Card className="gap-0 overflow-hidden py-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file?.name}</p>
              <p className="text-xs text-muted-foreground">
                {phase === "ready" && `${items.length} items ready${needsInput ? ` · ${needsInput} ${needsInput === 1 ? "needs" : "need"} a quick fix` : ""}`}
                {phase === "running" && (paused ? "Paused" : issue ? "Waiting for you" : "Adding items to Square…")}
                {phase === "done" && (count("skipped") ? "Done · some items were skipped" : "All done")}
              </p>
            </div>
            </div>

            <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            {phase === "ready" && (
              <>
                <Button variant="outline" onClick={reset}>
                  <X />
                  Cancel
                </Button>
                <Button onClick={run}>
                  Add to Square
                </Button>
              </>
            )}
            {phase === "running" && (
              <Button variant="outline" onClick={togglePause} disabled={!!issue}>
                {paused ? <Play /> : <Pause />}
                {paused ? "Resume" : "Pause"}
              </Button>
            )}
            {phase === "done" && (
              <Button variant="outline"  onClick={reset}>
                <RotateCcw />
                New file
              </Button>
            )}
            </div>
          </div>

          {/* Progress + stats */}
          {phase === "done" && last && (
            <div className="border-b px-4 py-6 sm:px-5">
              <Summary u={last} currency={currency} />
            </div>
          )}

          {phase === "running" && (
            <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="success"><Check />{count("created")} added</Badge>
                  {count("exists") > 0 && <Badge variant="secondary">{count("exists")} already there</Badge>}
                  {count("skipped") > 0 && <Badge variant="warning"><SkipForward />{count("skipped")} skipped</Badge>}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{finished}</span> of {items.length}
                </span>
              </div>
              <Progress value={(finished / items.length) * 100} />
            </div>
          )}

          <ItemList items={items} status={status} notes={notes} currency={currency} />
        </Card>
      )}

      {mode === "demo" && (
        <p className="mt-6 text-center text-xs text-muted-foreground">Demo mode · nothing is posted to Square</p>
      )}

      <FixDrawer issue={issue} onResolve={resolve} />
      <UploadDrawer u={viewing} currency={currency} onClose={() => setViewing(null)} />
    </main>
  );
}

/* ---------------- Drop zone ---------------- */

function DropZone({
  reading, fileName, error, onFile,
}: { reading: boolean; fileName?: string; error: string; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!reading) setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !reading) onFile(f);
      }}
      className={cn(
        "relative flex min-h-[22rem] flex-col items-center justify-center gap-7 rounded-3xl border-2 border-dashed bg-drop px-6 text-center transition-all duration-300",
        "border-foreground/20",
        over && "scale-[1.01] border-primary bg-primary/8",
        "animate-in fade-in zoom-in-[0.98] duration-500"
      )}
    >
      <CloudArt active={over || reading} />

      {reading ? (
        <div className="flex flex-col items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" /> Reading {fileName}
          </p>
          <p className="text-xs text-muted-foreground">Finding items, SKUs and prices</p>
        </div>
      ) : over ? (
        <p className="text-base font-medium text-primary">Drop to upload</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Button size="lg" className="h-12 px-8 text-base shadow-md" onClick={() => input.current?.click()}>
            Browse
          </Button>
          <p className="text-[15px] text-foreground/80">
            or drag a manifest here to list it on <span className="font-semibold text-foreground">Square</span>
          </p>
        </div>
      )}

      {error && (
        <p className="absolute bottom-6 flex items-center gap-1.5 text-sm text-destructive animate-in fade-in slide-in-from-bottom-1">
          <AlertTriangle className="size-4" /> {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CloudArt({ active }: { active: boolean }) {
  return (
    <div className={cn("transition-transform duration-300", active ? "scale-110" : "animate-floaty")}>
      <svg width="210" height="130" viewBox="0 0 210 130" fill="none" aria-hidden className="text-foreground">
        <defs>
          <linearGradient id="cg" x1="40" y1="120" x2="175" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="0.5" stopColor="#5eead4" />
            <stop offset="1" stopColor="#bae6fd" />
          </linearGradient>
          <linearGradient id="cg2" x1="30" y1="120" x2="95" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#4ade80" />
          </linearGradient>
          <clipPath id="cloud">
            <circle cx="62" cy="88" r="34" />
            <circle cx="114" cy="62" r="44" />
            <circle cx="166" cy="90" r="32" />
            <rect x="62" y="80" width="104" height="42" />
          </clipPath>
        </defs>
        {/* outline: stroked union, then fill over it */}
        <g stroke="currentColor" strokeOpacity=".75" strokeWidth="2.2">
          <circle cx="62" cy="88" r="34" />
          <circle cx="114" cy="62" r="44" />
          <circle cx="166" cy="90" r="32" />
          <rect x="62" y="80" width="104" height="42" />
        </g>
        <g fill="url(#cg)">
          <circle cx="62" cy="88" r="34" />
          <circle cx="114" cy="62" r="44" />
          <circle cx="166" cy="90" r="32" />
          <rect x="62" y="80" width="104" height="42" />
        </g>
        {/* front puff, clipped to the cloud */}
        <g clipPath="url(#cloud)">
          <path d="M20 88A42 42 0 0 1 96 82C99 104 92 122 70 124H20Z" fill="url(#cg2)" />
          <path d="M96 82C99 104 92 122 70 122" stroke="currentColor" strokeOpacity=".75" strokeWidth="1.2" />
        </g>
        {/* arrow */}
        <g className={cn(active && "animate-arrow-up")} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 98V58" />
          <path d="M104 74l16-16 16 16" />
        </g>
      </svg>
    </div>
  );
}

/* ---------------- Item list ---------------- */

function ItemList({ items, status, notes, currency }: { items: Item[]; status: Status[]; notes: Record<number, string>; currency: string }) {
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const active = status.findIndex((s) => s === "active" || s === "fixing");

  useEffect(() => {
    if (active >= 0) refs.current[active]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <ScrollArea className="h-[min(26rem,55vh)]">
      <ul className="divide-y">
        {items.map((it, i) => {
          const s = status[i];
          const missing = s === "pending" ? missingFields(it) : [];
          return (
            <li
              key={it.row}
              ref={(el) => { refs.current[i] = el; }}
              className={cn(
                "flex items-stretch text-sm transition-colors duration-300",
                s === "active" && "bg-primary/6",
                s === "fixing" && "bg-warning/8",
                (s === "created" || s === "exists") && "text-muted-foreground"
              )}
            >
              <RowNo n={it.row} />
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:px-4">
                <StatusIcon s={s} />
                <span className="min-w-0 flex-1" title={it.name}>
                  <span className={cn("block truncate font-medium", s === "skipped" && "line-through decoration-foreground/30")}>
                    {shortName(it) || <em className="font-normal text-muted-foreground">No name</em>}
                  </span>
                  <span className={cn("block truncate text-xs", s === "skipped" || missing.length ? "text-warning" : "text-muted-foreground")}>
                    {notes[i] ||
                      (missing.length
                        ? `Needs a ${missing.map((m) => FIELD_LABEL[m].toLowerCase()).join(" & ")} · we'll ask you`
                        : [it.sku, it.subcategory].filter(Boolean).join(" · "))}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {it.price != null ? money(it.price, currency) : <span className="text-warning">No price</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

function RowNo({ n }: { n?: number }) {
  return (
    <span className="flex w-10 shrink-0 items-center justify-center border-r bg-secondary/60 font-mono text-[11px] tabular-nums text-muted-foreground sm:w-12">
      {n ?? "—"}
    </span>
  );
}

function StatusIcon({ s }: { s: Status }) {
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full";
  switch (s) {
    case "active":
      return <Loader2 className="size-5 shrink-0 animate-spin text-primary" />;
    case "fixing":
      return <span className={cn(base, "bg-warning/15 text-warning animate-pulse")}><AlertTriangle className="size-3" /></span>;
    case "created":
      return <span className={cn(base, "bg-success text-white animate-in zoom-in-50 duration-300")}><Check className="size-3" strokeWidth={3} /></span>;
    case "exists":
      return <span className={cn(base, "bg-secondary text-muted-foreground")}><Check className="size-3" strokeWidth={3} /></span>;
    case "skipped":
      return <span className={cn(base, "bg-warning/15 text-warning")}><SkipForward className="size-3" /></span>;
    default:
      return <CircleDashed className="size-5 shrink-0 text-muted-foreground/40" />;
  }
}

/* ---------------- Fix drawer ---------------- */

function FixDrawer({ issue, onResolve }: { issue: Issue | null; onResolve: (r: Resolution) => void }) {
  const [vals, setVals] = useState<Record<Field, string>>({ name: "", sku: "", price: "" });

  useEffect(() => {
    if (issue)
      setVals({
        name: issue.item.name,
        sku: issue.item.sku,
        price: issue.item.price != null ? String(issue.item.price) : "",
      });
  }, [issue]);

  const item = issue?.item;
  const fields = issue?.fields ?? [];
  const err = issue?.error && issue.error !== "Missing data" ? issue.error : "";
  const valid = fields.every((f) => (f === "price" ? Number(vals.price) > 0 : vals[f].trim()));

  const submit = () => {
    if (!valid || !item) return;
    onResolve({
      action: "retry",
      item: { ...item, name: vals.name.trim(), sku: vals.sku.trim(), price: vals.price ? Number(vals.price) : null },
    });
  };

  return (
    <Drawer open={!!issue} dismissible={false}>
      <DrawerContent>
        {item && (
          <form className="mx-auto w-full max-w-md" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <DrawerHeader className="pt-6">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <AlertTriangle className="size-3.5" />
                </span>
                <DrawerTitle>
                  {err ? "Square couldn't list this item" : `This item needs a ${fields.map((f) => FIELD_LABEL[f].toLowerCase()).join(" & ")}`}
                </DrawerTitle>
              </div>
              <DrawerDescription className="line-clamp-2">
                Row {item.row}
                {` · ${shortName(item)}`}
                {item.sku && ` · ${item.sku}`}
              </DrawerDescription>
              {err && <p className="mt-2 rounded-2xl bg-destructive/8 px-4 py-2 text-sm text-destructive">{err}</p>}
            </DrawerHeader>

            <div className="flex flex-col gap-4 px-4">
              {fields.map((f, i) => (
                <div key={f} className="flex flex-col gap-2">
                  <Label htmlFor={f} className="pl-4 font-normal text-muted-foreground">{FIELD_LABEL[f]}</Label>
                  <Input
                    id={f}
                    autoFocus={i === 0}
                    inputMode={f === "price" ? "decimal" : undefined}
                    type={f === "price" ? "number" : "text"}
                    step={f === "price" ? "0.01" : undefined}
                    min={f === "price" ? "0" : undefined}
                    className="h-11"
                    placeholder={f === "price" && item.msrp ? `RRP ${item.msrp}` : undefined}
                    value={vals[f]}
                    onChange={(e) => setVals((v) => ({ ...v, [f]: e.target.value }))}
                  />
                  {f === "price" && item.msrp && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {[0.5, 0.6, 0.7].map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer hover:bg-secondary")}
                          onClick={() => setVals((v) => ({ ...v, price: String(Math.round(item.msrp! * p)) }))}
                        >
                          {p * 100}% of RRP · {Math.round(item.msrp! * p)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DrawerFooter className="pb-8 pt-6">
              <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => onResolve({ action: "skip" })}>
                Skip
              </Button>
              <Button type="submit" className="h-11 flex-1" disabled={!valid}>
                Continue
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/* ---------------- Summary & history ---------------- */

/** Always the full figure with thousands separators ("$30,929"), never abbreviated ("30.9K"). */
const money = (n: number, currency: string) =>
  n.toLocaleString(undefined, {
    ...(currency ? { style: "currency", currency } : {}),
    maximumFractionDigits: 0,
  });

const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function when(iso: string) {
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

const duration = (s: number) =>
  s < 60 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? "" : "s"}`;

const ringConfig = {
  added: { label: "Added", color: "var(--success)" },
  there: { label: "Already there", color: "var(--primary)" },
  skipped: { label: "Skipped", color: "var(--warning)" },
} satisfies ChartConfig;

function Ring({ u, size, thickness, animate = true, children }: { u: Upload; size: number; thickness: number; animate?: boolean; children?: React.ReactNode }) {
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

function Summary({ u, currency }: { u: Upload; currency: string }) {
  const pct = u.total ? Math.round(((u.created + u.exists) / u.total) * 100) : 0;
  const rows = [
    { show: true, dot: "bg-success", text: <><b className="font-semibold">{u.created}</b> {u.created === 1 ? "item" : "items"} added to Square</> },
    { show: u.exists > 0, dot: "bg-primary", text: <><b className="font-semibold">{u.exists}</b> {u.exists === 1 ? "was" : "were"} already there</> },
    { show: u.skipped.length > 0, dot: "bg-warning", text: <><b className="font-semibold">{u.skipped.length}</b> skipped</> },
  ];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <Ring u={u} size={148} thickness={14}>
        <span className="text-3xl font-semibold tracking-tight">{pct}%</span>
        <span className="text-xs text-muted-foreground">in Square</span>
      </Ring>

      <div className="flex w-full flex-col gap-4 text-center sm:text-left">
        <div>
          <p className="text-lg font-semibold tracking-tight">
            {u.skipped.length === 0 ? "Everything's on Square 🎉" : `${u.created + u.exists} of ${u.total} items are on Square`}
          </p>
          <p className="text-sm text-muted-foreground">
            {u.skipped.length === 0 ? "Nothing needs your attention." : "Skipped items weren't added. You can add them by hand."}
          </p>
        </div>

        <ul className="flex flex-col items-center gap-1.5 text-sm sm:items-start">
          {rows.filter((r) => r.show).map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", r.dot)} />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
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

const RECENT_ROWS = 8;

function Dashboard({ history, currency, onOpen }: { history: Upload[]; currency: string; onOpen: (u: Upload) => void }) {
  const now = new Date();
  const month = history.filter((u) => {
    const d = new Date(u.at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const sum = (list: Upload[], pick: (u: Upload) => number) => list.reduce((n, u) => n + pick(u), 0);
  const added = (u: Upload) => u.created;
  const value = (u: Upload) => u.value;
  const skipped = (u: Upload) => u.skipped.length;
  const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const tiles = [
    { label: "Items added", value: num(sum(month, added)), note: `${num(sum(history, added))} all time` },
    { label: "Stock value added", value: money(sum(month, value), currency), note: `${money(sum(history, value), currency)} all time` },
    { label: "Uploads", value: num(month.length), note: `${num(history.length)} all time` },
    { label: "Items skipped", value: num(sum(month, skipped)), note: `${num(sum(history, skipped))} all time`, warn: sum(month, skipped) > 0 },
  ];

  const rows = history.slice(0, RECENT_ROWS);

  return (
    <div className="mt-10 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-medium">This month</h2>
          <span className="text-xs text-muted-foreground">{monthName}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label} className="gap-1 rounded-xl px-4 py-3.5 shadow-none">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className={cn("truncate text-2xl font-semibold tracking-tight", t.warn && "text-warning")} title={t.value}>
                {t.value}
              </dd>
              <dd className="text-xs text-muted-foreground">{t.note}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-medium">Recent uploads</h2>
          <span className="text-xs text-muted-foreground">Click a row for details</span>
        </div>
        <Card className="gap-0 overflow-hidden rounded-xl py-0 shadow-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-xs text-muted-foreground [&>th]:py-2 [&>th]:font-medium">
                <th className="w-full pl-4 sm:pl-5">File</th>
                <th className="hidden whitespace-nowrap px-3 text-right sm:table-cell">Items</th>
                <th className="whitespace-nowrap px-3 text-right">Added</th>
                <th className="hidden whitespace-nowrap px-3 text-right sm:table-cell">Skipped</th>
                <th className="whitespace-nowrap pr-4 text-right sm:pr-5">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((u) => (
                <tr
                  key={u.id}
                  tabIndex={0}
                  onClick={() => onOpen(u)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(u); } }}
                  className="cursor-pointer transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none [&>td]:py-3 [&>td]:align-middle"
                >
                  <td className="max-w-0 pl-4 sm:pl-5">
                    <span className="block truncate font-medium">{u.file}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {when(u.at)}
                      <span className="sm:hidden">{u.skipped.length > 0 && <span className="text-warning"> · {num(u.skipped.length)} skipped</span>}</span>
                    </span>
                  </td>
                  <td className="hidden px-3 text-right tabular-nums text-muted-foreground sm:table-cell">{num(u.total)}</td>
                  <td className="px-3 text-right tabular-nums">{num(u.created)}</td>
                  <td className={cn("hidden px-3 text-right tabular-nums sm:table-cell", u.skipped.length > 0 ? "text-warning" : "text-muted-foreground")}>
                    {num(u.skipped.length)}
                  </td>
                  <td className="whitespace-nowrap pr-4 text-right font-medium tabular-nums sm:pr-5">{money(u.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length > RECENT_ROWS && (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">
              Showing the last {RECENT_ROWS} of {num(history.length)} uploads
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

function UploadDrawer({ u, currency, onClose }: { u: Upload | null; currency: string; onClose: () => void }) {
  return (
    <Drawer open={!!u} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        {u && (
          <div className="mx-auto flex w-full max-w-xl flex-col">
            <DrawerHeader className="pt-6">
              <DrawerTitle className="truncate">{u.file}</DrawerTitle>
              <DrawerDescription>{new Date(u.at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Summary u={u} currency={currency} />
            </div>
            {u.skipped.length > 0 && (
              <div className="mt-6 px-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Items that weren't added</p>
                <ul className="divide-y overflow-hidden rounded-2xl border">
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
            <DrawerFooter className="pb-8 pt-6">
              <Button variant="outline" className="h-11 flex-1" onClick={onClose}>Close</Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
