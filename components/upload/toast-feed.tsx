"use client";

/**
 * Inline toast stack: toasts pile up under the progress donut, newest on top with
 * the older ones peeking out beneath; hover to fan them out. State comes from useToastFeed.
 */

import { useState } from "react";
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import type { FeedEntry } from "@/hooks/use-toast-feed";
import type { FeedType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON: Record<FeedType, React.ReactNode> = {
  loading: <Loader2 className="size-4 animate-spin" />,
  success: <CircleCheck className="size-4" />,
  info: <Info className="size-4" />,
  warning: <TriangleAlert className="size-4" />,
  error: <OctagonX className="size-4" />,
  default: <Info className="size-4" />,
};

const TONE: Record<FeedType, string> = {
  loading: "bg-popover text-popover-foreground [&>svg]:text-primary",
  success: "border-success/25 bg-success/8 text-success [&_p]:text-success/80",
  info: "border-primary/25 bg-primary/8 text-primary [&_p]:text-primary/80",
  warning: "border-warning/30 bg-warning/10 text-warning [&_p]:text-warning/85",
  error: "border-destructive/30 bg-destructive/8 text-destructive [&_p]:text-destructive/80",
  default: "bg-popover text-popover-foreground",
};

/** How many toasts peek out of the stack, and the layout of one card. */
const VISIBLE = 4;
const CARD_H = 64; // px, fixed so the stack can fan out without measuring
const GAP = 8;
const PEEK = 12; // px each older toast shows below the one above it

export function ToastFeed({ toasts, className, empty = "Waiting for the first row…" }: { toasts: FeedEntry[]; className?: string; empty?: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = toasts.slice(0, VISIBLE + 1); // one extra so the exit of the 4th looks smooth
  const stackH = CARD_H + (Math.min(shown.length, VISIBLE) - 1) * PEEK;
  const fanH = shown.length * (CARD_H + GAP) - GAP;

  return (
    <div
      className={cn("px-4 py-5 sm:px-6", className)}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
    >
      {toasts.length === 0 ? (
        <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CARD_H + PEEK * (VISIBLE - 1) }}>
          {empty}
        </p>
      ) : (
        <div className="relative mx-auto w-full max-w-md transition-[height] duration-300 ease-out" style={{ height: expanded ? fanH : stackH }} aria-live="polite">
          {shown.map((t, i) => {
            const hidden = i >= VISIBLE && !expanded;
            const y = expanded ? i * (CARD_H + GAP) : i * PEEK;
            const scale = expanded ? 1 : 1 - i * 0.05;
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "absolute inset-x-0 top-0 flex origin-top items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 text-sm shadow-md transition-all duration-300 ease-out",
                  TONE[t.type],
                  t.leaving ? "animate-out fade-out zoom-out-95 fill-mode-forwards duration-300" : i === 0 && "animate-in fade-in slide-in-from-top-2 duration-300",
                  hidden && "pointer-events-none opacity-0"
                )}
                style={{ height: CARD_H, transform: `translateY(${y}px) scale(${scale})`, zIndex: shown.length - i }}
              >
                <span className="mt-0.5 shrink-0">{ICON[t.type]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
                </span>
                {/* older cards get a soft veil so the newest reads as "on top" */}
                {!expanded && i > 0 && <span className="pointer-events-none absolute inset-0 bg-card/40" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
