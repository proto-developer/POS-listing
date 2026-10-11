"use client";

// The list of uploaded files under the two widgets. Fills its row and scrolls
// inside. Click a row for its details.

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, num, UploadDrawer, when } from "@/components/uploads";
import type { Upload } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UploadsTable({ history, currency }: { history: Upload[]; currency: string }) {
  const [viewing, setViewing] = useState<Upload | null>(null);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl py-0 shadow-none">
      <div className="flex items-baseline justify-between border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-medium">Uploaded files</h2>
        <span className="text-xs text-muted-foreground">{num(history.length)} {history.length === 1 ? "upload" : "uploads"} · click a row for details</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Table className="text-sm">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-full pl-4 sm:pl-5">File</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Rows</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Skipped</TableHead>
              <TableHead className="pr-4 text-right sm:pr-5">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No uploads yet. Drop a manifest on the Upload page.</TableCell>
              </TableRow>
            )}
            {history.map((u) => (
              <TableRow
                key={u.id}
                tabIndex={0}
                onClick={() => setViewing(u)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing(u); } }}
                className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none [&>td]:py-2.5"
              >
                <TableCell className="max-w-0 pl-4 sm:pl-5">
                  <span className="block truncate font-medium">{u.file}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {when(u.at)}
                    {u.skipped.length > 0 && <span className="text-warning sm:hidden"> · {num(u.skipped.length)} skipped</span>}
                  </span>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{num(u.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(u.created)}</TableCell>
                <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", u.skipped.length > 0 ? "text-warning" : "text-muted-foreground")}>
                  {num(u.skipped.length)}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-4 text-right tabular-nums sm:pr-5">{money(u.value, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <UploadDrawer u={viewing} currency={currency} onClose={() => setViewing(null)} />
    </Card>
  );
}
