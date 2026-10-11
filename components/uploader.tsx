"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, FileSpreadsheet, LayoutDashboard, Loader2, Pause, Play, RotateCcw, SkipForward, X,
} from "lucide-react";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { ToastFeed, useToastFeed, type FeedToast } from "@/components/toast-feed";
import { money, RowNo, Summary } from "@/components/uploads";
import { readManifest, type ColumnKey, type Manifest } from "@/lib/parse";
import type { SquareStatus } from "@/lib/square";
import { FIELD_LABEL, missingFields, REQUIRED, shortName, type Field, type Item, type PushResult, type Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "reading" | "ready" | "running" | "done";
type Status = "pending" | "active" | "fixing" | "created" | "exists" | "skipped";
type Issue = { item: Item; error: string; fields: Field[] };
type Resolution = { action: "retry"; item: Item } | { action: "skip" };

/* ---------------- Row toasts ----------------
   Every row of the sheet gets its own toast in the feed under the donut, keyed
   by row number, that moves through: checking → added / already there / needs you / skipped. */

const rowId = (it: Item) => `row-${it.row}`;
const rowTitle = (it: Item) => `Row ${it.row} · ${shortName(it) || "No name"}`;
const rowMeta = (it: Item, currency: string) =>
  [it.sku, it.price != null ? money(it.price, currency) : "no price"].filter(Boolean).join(" · ");
const missingText = (fields: Field[]) => fields.map((f) => FIELD_LABEL[f].toLowerCase()).join(" & ");

const rowToast = {
  checking: (it: Item, currency: string): FeedToast =>
    ({ id: rowId(it), type: "loading", title: rowTitle(it), description: `${rowMeta(it, currency)} · Checking Square…` }),
  needs: (it: Item, fields: Field[]): FeedToast =>
    ({ id: rowId(it), type: "warning", title: rowTitle(it), description: `Needs a ${missingText(fields)} · waiting for you` }),
  error: (it: Item, error: string): FeedToast =>
    ({ id: rowId(it), type: "error", title: rowTitle(it), description: error }),
  created: (it: Item, currency: string): FeedToast =>
    ({ id: rowId(it), type: "success", title: rowTitle(it), description: `Added to Square · ${rowMeta(it, currency)}`, duration: 4000 }),
  exists: (it: Item): FeedToast =>
    ({ id: rowId(it), type: "info", title: rowTitle(it), description: `Already in Square · ${it.sku}`, duration: 4000 }),
  skipped: (it: Item, reason: string): FeedToast =>
    ({ id: rowId(it), type: "warning", title: rowTitle(it), description: `Skipped · ${reason}`, duration: 6000 }),
};

/** The upload flow. The Square connection (mode, currency, errors) comes from the server, never fetched client-side. */
export function Uploader({ square }: { square: SquareStatus }) {
  const router = useRouter();
  const mode = square.mode;
  const currency = square.currency ?? "";
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<Manifest | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status[]>([]);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<Upload | null>(null);
  const [saveError, setSaveError] = useState("");
  const feed = useToastFeed();

  const resolver = useRef<((r: Resolution) => void) | null>(null);
  const pausedRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);

  const setAt = (i: number, s: Status) => setStatus((prev) => prev.map((v, j) => (j === i ? s : v)));

  async function load(f: File) {
    setError("");
    setFile(f);
    setPhase("reading");
    try {
      const [m] = await Promise.all([readManifest(f), new Promise((r) => setTimeout(r, 600))]);
      const list = m.rows.map((r) => r.item);
      if (!list.length) throw new Error("No items found in that file");
      setSheet(m);
      setItems(list);
      setStatus(list.map(() => "pending"));
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
    if (pausedRef.current) feed.show({ id: "pause", type: "default", title: "Paused", description: "Nothing is posted until you resume" });
    else {
      feed.dismiss("pause");
      resumeRef.current?.();
    }
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
    feed.dismiss();
    const list = [...items];
    const t0 = Date.now();
    const tally = { created: 0, exists: 0, value: 0, skipped: [] as Upload["skipped"] };
    feed.show({ id: "run", type: "default", title: `Listing ${list.length} rows on Square`, description: file?.name, duration: 3000 });

    for (let i = 0; i < list.length; i++) {
      if (pausedRef.current) await new Promise<void>((r) => (resumeRef.current = r));
      let item = list[i];
      setAt(i, "active");

      while (true) {
        const missing = missingFields(item);
        feed.show(missing.length ? rowToast.needs(item, missing) : rowToast.checking(item, currency));
        const res: PushResult = missing.length ? { ok: false, error: "", fields: missing } : await push(item);

        if (res.ok) {
          setAt(i, res.status);
          if (res.status === "created") {
            tally.created++;
            tally.value += Number(item.price) || 0;
            feed.show(rowToast.created(item, currency));
          } else {
            tally.exists++;
            feed.show(rowToast.exists(item));
          }
          break;
        }

        setAt(i, "fixing");
        if (res.error) feed.show(rowToast.error(item, res.error));
        const r = await ask({ item, error: res.error, fields: res.fields?.length ? res.fields : REQUIRED });
        if (r.action === "skip") {
          const reason = res.error || `Missing ${missing.map((m) => FIELD_LABEL[m].toLowerCase()).join(", ")}`;
          setAt(i, "skipped");
          tally.skipped.push({ row: item.row, sku: item.sku, name: shortName(item), reason });
          feed.show(rowToast.skipped(item, reason));
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

    // Save the stats of this upload, then refresh so the sidebar and dashboard show it
    setSaveError("");
    try {
      const res = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upload) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Server returned ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setSaveError(e?.message || "Network error");
    }
  }

  const reset = () => {
    pausedRef.current = false;
    setPaused(false);
    setItems([]);
    setStatus([]);
    setSheet(null);
    setFile(null);
    setSaveError("");
    setPhase("idle");
    feed.dismiss();
  };

  const count = (s: Status) => status.filter((v) => v === s).length;
  const finished = status.filter((s) => s === "created" || s === "exists" || s === "skipped").length;
  const needsInput = items.filter((it) => missingFields(it).length).length;
  const current = items[status.findIndex((s) => s === "active" || s === "fixing")];
  const pct = items.length ? Math.round((finished / items.length) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 md:py-10">
      {!square.ok && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <b className="font-semibold">Square isn't connected.</b> {square.error} You can preview a sheet, but nothing can be posted until it is.
          </span>
        </p>
      )}

      {(phase === "idle" || phase === "reading") && (
        <DropZone reading={phase === "reading"} fileName={file?.name} error={error} onFile={load} />
      )}

      {(phase === "ready" || phase === "running" || phase === "done") && (
        <Card className="gap-0 overflow-hidden py-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
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
                  <Button onClick={run} disabled={!square.ok} title={square.ok ? undefined : square.error}>Add to Square</Button>
                </>
              )}
              {phase === "running" && (
                <Button variant="outline" onClick={togglePause} disabled={!!issue}>
                  {paused ? <Play /> : <Pause />}
                  {paused ? "Resume" : "Pause"}
                </Button>
              )}
              {phase === "done" && (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard />
                      Dashboard
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    <RotateCcw />
                    New file
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Ready: preview of the sheet about to be posted */}
          {phase === "ready" && sheet && <SheetPreview sheet={sheet} currency={currency} />}

          {/* Running: donut progress + the row toasts underneath */}
          {phase === "running" && (
            <>
              <div className="flex items-center gap-5 border-b px-4 py-5 sm:gap-7 sm:px-6">
                <Donut value={items.length ? finished / items.length : 0} size={116} thickness={11} paused={paused}>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">{pct}%</span>
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{finished}</span> of {items.length}
                  </span>
                </Donut>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <p className="truncate text-sm font-medium">
                    {paused ? "Paused" : issue ? "Waiting for you" : current ? `Adding ${shortName(current) || `row ${current.row}`}…` : "Finishing up…"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="success"><Check />{count("created")} added</Badge>
                    {count("exists") > 0 && <Badge variant="secondary">{count("exists")} already there</Badge>}
                    {count("skipped") > 0 && <Badge variant="warning"><SkipForward />{count("skipped")} skipped</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{items.length - finished} to go</p>
                </div>
              </div>
              <ToastFeed toasts={feed.toasts} />
            </>
          )}

          {/* Done: summary and anything that was skipped */}
          {phase === "done" && last && (
            <>
              {saveError && (
                <p className="flex items-center gap-2 border-b bg-destructive/8 px-4 py-2 text-xs text-destructive sm:px-5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Items were posted, but this upload couldn't be saved to the history: {saveError}
                </p>
              )}
              <div className="px-4 py-6 sm:px-5">
                <Summary u={last} currency={currency} />
              </div>
              {last.skipped.length > 0 && (
                <div className="border-t">
                  <p className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground sm:px-5">Items that weren't added</p>
                  <ScrollArea className="max-h-64">
                    <ul className="divide-y border-t">
                      {last.skipped.map((s, i) => (
                        <li key={i} className="flex items-stretch text-sm">
                          <RowNo n={s.row} />
                          <span className="min-w-0 flex-1 px-4 py-2.5">
                            <span className="block truncate font-medium">{s.name || "Untitled"}</span>
                            <span className="block truncate text-xs text-warning">{s.sku ? `${s.sku} · ` : ""}{s.reason}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <FixDrawer issue={issue} onResolve={resolve} />
    </div>
  );
}

/* ---------------- Donut progress ---------------- */

function Donut({ value, size, thickness, paused, children }: { value: number; size: number; thickness: number; paused?: boolean; children?: React.ReactNode }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={paused ? "var(--warning)" : "var(--primary)"}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">{children}</div>
    </div>
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
        "relative flex min-h-[22rem] flex-col items-center justify-center gap-7 rounded-xl border-2 border-dashed bg-drop px-6 text-center transition-all duration-300",
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

/* ---------------- Sheet preview (before posting) ----------------
   The spreadsheet as uploaded: every column from the file, with the columns we
   read a field from labelled, and cells that will need a fix called out. */

const PREVIEW_ROWS = 300;
const COL_LABEL: Record<ColumnKey, string> = {
  name: "Item name", sku: "SKU", price: "Price", brand: "Brand", model: "Model",
  category: "Category", subcategory: "Type", msrp: "RRP", url: "URL",
};

function SheetPreview({ sheet, currency }: { sheet: Manifest; currency: string }) {
  const fieldOf: Record<number, ColumnKey> = {};
  for (const [k, c] of Object.entries(sheet.columns) as [ColumnKey, number | undefined][]) if (c !== undefined) fieldOf[c] = k;
  const missingCols = REQUIRED.filter((f) => sheet.columns[f] === undefined);
  const rows = sheet.rows.slice(0, PREVIEW_ROWS);
  const isRequired = (k?: ColumnKey) => !!k && (REQUIRED as string[]).includes(k);

  const fmt = (v: string | number | null, k?: ColumnKey) => {
    if (v === null || v === "") return "";
    if (typeof v === "number" && (k === "price" || k === "msrp")) return money(v, currency);
    return String(v);
  };

  return (
    <>
      {missingCols.length > 0 && (
        <p className="flex items-center gap-2 border-b bg-warning/8 px-4 py-2 text-xs text-warning sm:px-5">
          <AlertTriangle className="size-3.5 shrink-0" />
          Couldn't find a {missingCols.map((f) => FIELD_LABEL[f].toLowerCase()).join(" or ")} column · we'll ask you for each row
        </p>
      )}
      <ScrollArea className="h-[min(26rem,55vh)]">
        <Table className="w-max min-w-full text-xs sm:text-sm">
          <TableHeader className="sticky top-0 z-10 bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center font-mono text-[11px] sm:w-12">#</TableHead>
              {sheet.header.map((h, c) => (
                <TableHead key={c} className="max-w-56">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{h || <em className="font-normal text-muted-foreground">no header</em>}</span>
                    {fieldOf[c] && (
                      <Badge variant={isRequired(fieldOf[c]) ? "default" : "secondary"} className="shrink-0 px-1.5 py-0 text-[10px]">
                        {COL_LABEL[fieldOf[c]]}
                      </Badge>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const missing = missingFields(r.item);
              return (
                <TableRow key={r.row} className={cn(missing.length > 0 && "bg-warning/6 hover:bg-warning/10")}>
                  <TableCell className="text-center font-mono text-[11px] text-muted-foreground">{r.row}</TableCell>
                  {sheet.header.map((_, c) => {
                    const k = fieldOf[c];
                    const miss = isRequired(k) && missing.includes(k as Field);
                    const v = r.cells[c] ?? null;
                    return (
                      <TableCell
                        key={c}
                        className={cn(
                          "max-w-56 truncate",
                          (k === "price" || k === "msrp") && "text-right tabular-nums",
                          k === "price" && "font-medium",
                          miss && "text-warning"
                        )}
                        title={v === null ? undefined : String(v)}
                      >
                        {miss ? `No ${FIELD_LABEL[k as Field].toLowerCase()}` : fmt(v, k)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {sheet.rows.length > PREVIEW_ROWS && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">
          Showing the first {PREVIEW_ROWS} of {sheet.rows.length} rows · all of them will be posted
        </p>
      )}
    </>
  );
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
                <span className="flex size-7 items-center justify-center rounded-lg bg-warning/15 text-warning">
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
              {err && <p className="mt-2 rounded-xl bg-destructive/8 px-4 py-2 text-sm text-destructive">{err}</p>}
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
