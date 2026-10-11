"use client";

/** State for the inline toast stack: add / update in place / auto-dismiss / clear. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedToast } from "@/lib/types";

export type FeedEntry = FeedToast & { leaving?: boolean };

const MAX = 60;
const LEAVE_MS = 280;

export function useToastFeed() {
  const [toasts, setToasts] = useState<FeedEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  };

  const remove = useCallback((id: string) => {
    clearTimer(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, LEAVE_MS)
    );
  }, []);

  /** Add a toast, or update the one with the same id in place. */
  const show = useCallback(
    (t: FeedToast) => {
      clearTimer(t.id);
      setToasts((prev) => {
        const i = prev.findIndex((x) => x.id === t.id);
        if (i >= 0) return prev.map((x, j) => (j === i ? { ...t, leaving: false } : x));
        return [{ ...t }, ...prev].slice(0, MAX);
      });
      if (t.duration && Number.isFinite(t.duration)) timers.current.set(t.id, setTimeout(() => remove(t.id), t.duration));
    },
    [remove]
  );

  /** Dismiss one toast, or all of them. */
  const dismiss = useCallback(
    (id?: string) => {
      if (id) return remove(id);
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
      setToasts([]);
    },
    [remove]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
    };
  }, []);

  return { toasts, show, dismiss };
}
