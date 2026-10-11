"use client";

/**
 * State for the upload page as one reducer-driven state machine:
 *
 *   idle → reading → ready → running → done
 *                      └──────────────┘ (reset)
 *
 * The business logic lives in lib/upload-runner.ts; this hook wires it to React state,
 * the inline toast feed, the fix drawer and the pause button.
 */

import { useCallback, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api-client";
import { readManifest, type Manifest } from "@/lib/manifest";
import { rowToast } from "@/lib/row-toasts";
import { missingFields, type Item, type Upload } from "@/lib/types";
import { runUpload, saveUpload, type Issue, type Resolution, type RowStatus } from "@/lib/upload-runner";
import { useToastFeed } from "./use-toast-feed";

export type Phase = "idle" | "reading" | "ready" | "running" | "done";

export type UploadState = {
  phase: Phase;
  file: File | null;
  sheet: Manifest | null;
  items: Item[];
  status: RowStatus[];
  issue: Issue | null;
  paused: boolean;
  /** Why the file couldn't be read */
  readError: string;
  /** The finished upload */
  result: Upload | null;
  /** Why the finished upload couldn't be saved to the history */
  saveError: string;
};

type Action =
  | { type: "read-start"; file: File }
  | { type: "read-ok"; sheet: Manifest }
  | { type: "read-fail"; error: string }
  | { type: "run-start" }
  | { type: "row-status"; index: number; status: RowStatus }
  | { type: "row-item"; index: number; item: Item }
  | { type: "ask"; issue: Issue }
  | { type: "answered" }
  | { type: "paused"; paused: boolean }
  | { type: "done"; result: Upload }
  | { type: "save-fail"; error: string }
  | { type: "reset" };

const initial: UploadState = {
  phase: "idle", file: null, sheet: null, items: [], status: [], issue: null, paused: false, readError: "", result: null, saveError: "",
};

function reducer(s: UploadState, a: Action): UploadState {
  switch (a.type) {
    case "read-start":
      return { ...initial, phase: "reading", file: a.file };
    case "read-ok": {
      const items = a.sheet.rows.map((r) => r.item);
      return { ...s, phase: "ready", sheet: a.sheet, items, status: items.map(() => "pending") };
    }
    case "read-fail":
      return { ...s, phase: "idle", readError: a.error };
    case "run-start":
      return { ...s, phase: "running", result: null, saveError: "" };
    case "row-status":
      return { ...s, status: s.status.map((v, i) => (i === a.index ? a.status : v)) };
    case "row-item":
      return { ...s, items: s.items.map((v, i) => (i === a.index ? a.item : v)) };
    case "ask":
      return { ...s, issue: a.issue };
    case "answered":
      return { ...s, issue: null };
    case "paused":
      return { ...s, paused: a.paused };
    case "done":
      return { ...s, phase: "done", result: a.result, paused: false };
    case "save-fail":
      return { ...s, saveError: a.error };
    case "reset":
      return initial;
  }
}

export function useUploadRun(input: { mode: string; currency: string }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const feed = useToastFeed();

  // Promises the running loop waits on: the user's answer to a fix, and resume after pause.
  const answer = useRef<((r: Resolution) => void) | null>(null);
  const pausedRef = useRef(false);
  const resume = useRef<(() => void) | null>(null);

  const load = useCallback(async (file: File) => {
    dispatch({ type: "read-start", file });
    try {
      const [sheet] = await Promise.all([readManifest(file), new Promise((r) => setTimeout(r, 600))]);
      dispatch({ type: "read-ok", sheet });
    } catch (e) {
      dispatch({ type: "read-fail", error: errorMessage(e, "Couldn't read that file. Use .xlsx, .xls or .csv") });
    }
  }, []);

  const resolve = useCallback((r: Resolution) => {
    dispatch({ type: "answered" });
    answer.current?.(r);
    answer.current = null;
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    dispatch({ type: "paused", paused: pausedRef.current });
    if (pausedRef.current) feed.show(rowToast.paused());
    else {
      feed.dismiss("pause");
      resume.current?.();
    }
  }, [feed]);

  const run = useCallback(async () => {
    dispatch({ type: "run-start" });
    feed.dismiss();
    const result = await runUpload(
      { items: state.items, file: state.file?.name ?? "Untitled", currency: input.currency, mode: input.mode },
      {
        onStatus: (index, status) => dispatch({ type: "row-status", index, status }),
        onItem: (index, item) => dispatch({ type: "row-item", index, item }),
        toast: feed.show,
        ask: (issue) =>
          new Promise<Resolution>((res) => {
            answer.current = res;
            dispatch({ type: "ask", issue });
          }),
        waitIfPaused: () => (pausedRef.current ? new Promise<void>((r) => (resume.current = r)) : Promise.resolve()),
      }
    );
    dispatch({ type: "done", result });
    try {
      await saveUpload(result);
      router.refresh(); // sidebar and dashboard pick up the new upload
    } catch (e) {
      dispatch({ type: "save-fail", error: errorMessage(e) });
    }
  }, [state.items, state.file, input.currency, input.mode, feed, router]);

  const reset = useCallback(() => {
    pausedRef.current = false;
    answer.current = null;
    resume.current = null;
    feed.dismiss();
    dispatch({ type: "reset" });
  }, [feed]);

  const derived = useMemo(() => {
    const count = (s: RowStatus) => state.status.filter((v) => v === s).length;
    const finished = count("created") + count("exists") + count("skipped");
    const activeIndex = state.status.findIndex((s) => s === "active" || s === "fixing");
    return {
      created: count("created"),
      exists: count("exists"),
      skipped: count("skipped"),
      finished,
      total: state.items.length,
      pct: state.items.length ? Math.round((finished / state.items.length) * 100) : 0,
      current: activeIndex >= 0 ? state.items[activeIndex] : undefined,
      needsInput: state.items.filter((it) => missingFields(it).length > 0).length,
    };
  }, [state.status, state.items]);

  return { state, derived, feed, actions: { load, run, togglePause, resolve, reset } };
}
