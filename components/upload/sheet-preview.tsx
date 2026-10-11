"use client";

/**
 * The spreadsheet as uploaded: every column from the file, with the columns we
 * read a field from labelled, and cells that will need a fix called out.
 */

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import { COLUMN_LABEL, type Cell, type ColumnKey, type Manifest } from "@/lib/manifest";
import { FIELD_LABEL, missingFields, REQUIRED, type Field } from "@/lib/types";
import { cn } from "@/lib/utils";

const PREVIEW_ROWS = 300;
const isRequired = (k?: ColumnKey): k is Field => !!k && (REQUIRED as string[]).includes(k);

export function SheetPreview({ sheet, currency }: { sheet: Manifest; currency: string }) {
  const fieldOf: Record<number, ColumnKey> = {};
  for (const [k, c] of Object.entries(sheet.columns) as [ColumnKey, number | undefined][]) if (c !== undefined) fieldOf[c] = k;
  const missingCols = REQUIRED.filter((f) => sheet.columns[f] === undefined);
  const rows = sheet.rows.slice(0, PREVIEW_ROWS);

  const fmt = (v: Cell, k?: ColumnKey) => {
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
                        {COLUMN_LABEL[fieldOf[c]]}
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
                    const miss = isRequired(k) && missing.includes(k);
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
                        {miss ? `No ${FIELD_LABEL[k].toLowerCase()}` : fmt(v, k)}
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
