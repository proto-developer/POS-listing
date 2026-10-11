"use client";

/** Bottom drawer that asks the user to complete a row Square can't take, or skip it. */

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_LABEL, shortName, type Field } from "@/lib/types";
import type { Issue, Resolution } from "@/lib/upload-runner";
import { cn } from "@/lib/utils";

export function FixDrawer({ issue, onResolve }: { issue: Issue | null; onResolve: (r: Resolution) => void }) {
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
