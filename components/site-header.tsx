"use client";

import { usePathname } from "next/navigation";
import { NAV_MAIN } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { DbStatus } from "@/lib/db";
import type { SquareStatus } from "@/lib/square";

export function SiteHeader({ square, db }: { square: SquareStatus; db: DbStatus }) {
  const pathname = usePathname();
  const title = NAV_MAIN.find((n) => n.url === pathname)?.title ?? "Lister";
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!db.ok && <Badge variant="destructive" title={db.error}>Database: {db.error ?? "unreachable"}</Badge>}
          {!square.ok && <Badge variant="destructive" title={square.error}>Square: {square.error ?? "not connected"}</Badge>}
          {square.ok && square.mode === "sandbox" && <Badge variant="warning">Square sandbox{square.location ? ` · ${square.location}` : ""}</Badge>}
          {square.ok && square.mode === "live" && <Badge variant="success">Square live{square.location ? ` · ${square.location}` : ""}</Badge>}
        </div>
      </div>
    </header>
  );
}
