"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CloudArt } from "./cloud-art";

/** Drag-and-drop / browse target for the manifest file. */
export function DropZone({
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
