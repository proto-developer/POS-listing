"use client";

/** Bottom drawer with one upload's details and a "remove from history" action. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { api, errorMessage } from "@/lib/api-client";
import { modeLabel, when } from "@/lib/format";
import type { Upload } from "@/lib/types";
import { UploadDetails } from "./upload-details";

export function UploadDrawer({ u, currency, onClose }: { u: Upload | null; currency: string; onClose: () => void }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setError("");
    onClose();
  };

  async function remove() {
    if (!u || !window.confirm(`Remove "${u.file}" from the history? Items already on Square are not affected.`)) return;
    setRemoving(true);
    setError("");
    try {
      await api(`/api/history?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
      close();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't remove it"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Drawer open={!!u} onOpenChange={(o) => !o && close()}>
      <DrawerContent>
        {u && (
          <div className="mx-auto flex w-full max-w-xl flex-col overflow-y-auto">
            <DrawerHeader className="pt-6">
              <DrawerTitle className="truncate">{u.file}</DrawerTitle>
              <DrawerDescription>{when(u.at)} · {modeLabel(u.mode)}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <UploadDetails u={u} currency={currency} />
            </div>
            {error && (
              <p className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" /> {error}
              </p>
            )}
            <DrawerFooter className="flex-row pb-8 pt-6">
              <Button variant="ghost" className="h-11 text-muted-foreground" onClick={remove} disabled={removing}>
                {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Remove from history
              </Button>
              <Button variant="outline" className="h-11 flex-1" onClick={close}>Close</Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
