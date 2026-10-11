import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merging, the shadcn way. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Only allow redirects to a path on this site (blocks "//evil.com" and "/\evil.com"). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.length > 500) return "/";
  return next;
}
