/** The sheet row number gutter used in row lists. */
export function RowNumber({ n }: { n?: number }) {
  return (
    <span className="flex w-10 shrink-0 items-center justify-center border-r bg-secondary/60 font-mono text-[11px] tabular-nums text-muted-foreground sm:w-12">
      {n ?? "—"}
    </span>
  );
}
