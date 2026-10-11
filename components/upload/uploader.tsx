"use client";

/**
 * The upload page. Presentation only: all state and flow live in useUploadRun.
 * The Square connection (mode, currency, errors) comes from the server as a prop.
 */

import Link from "next/link";
import { AlertTriangle, Check, FileSpreadsheet, LayoutDashboard, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RowNumber } from "@/components/uploads/row-number";
import { UploadSummary } from "@/components/uploads/upload-summary";
import { useUploadRun } from "@/hooks/use-upload-run";
import { shortName, type SquareStatus } from "@/lib/types";
import { DropZone } from "./drop-zone";
import { FixDrawer } from "./fix-drawer";
import { ProgressDonut } from "./progress-donut";
import { SheetPreview } from "./sheet-preview";
import { ToastFeed } from "./toast-feed";

export function Uploader({ square }: { square: SquareStatus }) {
  const currency = square.currency ?? "";
  const { state, derived, feed, actions } = useUploadRun({ mode: square.mode, currency });
  const { phase, file, sheet, issue, paused, result } = state;

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
        <DropZone reading={phase === "reading"} fileName={file?.name} error={state.readError} onFile={actions.load} />
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
                  {phase === "ready" &&
                    `${derived.total} items ready${derived.needsInput ? ` · ${derived.needsInput} ${derived.needsInput === 1 ? "needs" : "need"} a quick fix` : ""}`}
                  {phase === "running" && (paused ? "Paused" : issue ? "Waiting for you" : "Adding items to Square…")}
                  {phase === "done" && (derived.skipped ? "Done · some items were skipped" : "All done")}
                </p>
              </div>
            </div>

            <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              {phase === "ready" && (
                <>
                  <Button variant="outline" onClick={actions.reset}>
                    <X />
                    Cancel
                  </Button>
                  <Button onClick={actions.run} disabled={!square.ok} title={square.ok ? undefined : square.error}>
                    Add to Square
                  </Button>
                </>
              )}
              {phase === "running" && (
                <Button variant="outline" onClick={actions.togglePause} disabled={!!issue}>
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
                  <Button variant="outline" onClick={actions.reset}>
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
                <ProgressDonut value={derived.total ? derived.finished / derived.total : 0} size={116} thickness={11} paused={paused}>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">{derived.pct}%</span>
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{derived.finished}</span> of {derived.total}
                  </span>
                </ProgressDonut>
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <p className="truncate text-sm font-medium">
                    {paused
                      ? "Paused"
                      : issue
                        ? "Waiting for you"
                        : derived.current
                          ? `Adding ${shortName(derived.current) || `row ${derived.current.row}`}…`
                          : "Finishing up…"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="success"><Check />{derived.created} added</Badge>
                    {derived.exists > 0 && <Badge variant="secondary">{derived.exists} already there</Badge>}
                    {derived.skipped > 0 && <Badge variant="warning"><SkipForward />{derived.skipped} skipped</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{derived.total - derived.finished} to go</p>
                </div>
              </div>
              <ToastFeed toasts={feed.toasts} />
            </>
          )}

          {/* Done: summary and anything that was skipped */}
          {phase === "done" && result && (
            <>
              {state.saveError && (
                <p className="flex items-center gap-2 border-b bg-destructive/8 px-4 py-2 text-xs text-destructive sm:px-5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Items were posted, but this upload couldn't be saved to the history: {state.saveError}
                </p>
              )}
              <div className="px-4 py-6 sm:px-5">
                <UploadSummary u={result} currency={currency} />
              </div>
              {result.skipped.length > 0 && (
                <div className="border-t">
                  <p className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground sm:px-5">Items that weren't added</p>
                  <ScrollArea className="max-h-64">
                    <ul className="divide-y border-t">
                      {result.skipped.map((s, i) => (
                        <li key={i} className="flex items-stretch text-sm">
                          <RowNumber n={s.row} />
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

      <FixDrawer issue={issue} onResolve={actions.resolve} />
    </div>
  );
}
