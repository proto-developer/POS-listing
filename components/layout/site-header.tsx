"use client";

/** Page title plus connection badges for Square and the database. */

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { DbStatus, SquareStatus } from "@/lib/types";
import { NAV_MAIN } from "./app-sidebar";

export function SiteHeader({ square, db }: { square: SquareStatus; db: DbStatus }) {
  const pathname = usePathname();
  const title = NAV_MAIN.find((n) => n.url === pathname)?.title ?? "Lister";
  const where = square.location ? ` · ${square.location}` : "";
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!db.ok && <Badge variant="destructive" title={db.error}>Database: {db.error ?? "unreachable"}</Badge>}
          {!square.ok && <Badge variant="destructive" title={square.error}>Square: {square.error ?? "not connected"}</Badge>}
          {square.ok && square.mode === "sandbox" && <Badge variant="warning">Square sandbox{where}</Badge>}
          {square.ok && square.mode === "live" && <Badge variant="success">Square live{where}</Badge>}
        </div>
      </div>
    </header>
  );
}
