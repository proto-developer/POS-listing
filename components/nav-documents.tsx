"use client";

import { useState } from "react";
import Link from "next/link";
import { IconDots, IconFileSpreadsheet } from "@tabler/icons-react";

import {
  SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UploadDrawer, when } from "@/components/uploads";
import type { Upload } from "@/lib/types";

/** Recent files in the sidebar. Click one to open its details drawer. */
export function NavDocuments({ items, currency }: { items: Upload[]; currency: string }) {
  const [viewing, setViewing] = useState<Upload | null>(null);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent files</SidebarGroupLabel>
      <SidebarMenu>
        {items.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled className="text-sidebar-foreground/70">
              <span>Nothing uploaded yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {items.map((u) => (
          <SidebarMenuItem key={u.id}>
            <SidebarMenuButton tooltip={u.file} onClick={() => setViewing(u)} className="h-auto py-1.5">
              <IconFileSpreadsheet />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{u.file}</span>
                <span className="truncate text-[11px] text-sidebar-foreground/60">
                  {when(u.at)} · {u.created} added{u.skipped.length > 0 ? ` · ${u.skipped.length} skipped` : ""}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {items.length > 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-sidebar-foreground/70">
              <Link href="/dashboard">
                <IconDots className="text-sidebar-foreground/70" />
                <span>More</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
      <UploadDrawer u={viewing} currency={currency} onClose={() => setViewing(null)} />
    </SidebarGroup>
  );
}
