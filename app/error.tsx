"use client";

/** Catches rendering errors anywhere in the app and offers a retry. */

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div>
        <p className="text-lg font-semibold tracking-tight">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          {error.message || "The page could not be shown."}
          {error.digest && <span className="block text-xs">Reference {error.digest}</span>}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
