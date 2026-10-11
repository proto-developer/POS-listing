"use client";

import * as React from "react";
import Link from "next/link";
import { IconBuildingStore, IconDashboard, IconHelp, IconInnerShadowTop, IconUpload } from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Upload } from "@/lib/types";

export const NAV_MAIN = [
  { title: "Upload", url: "/", icon: IconUpload },
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
];

/** Links follow the configured Square environment. */
const navSecondary = (mode: string) => [
  {
    title: mode === "sandbox" ? "Square sandbox items" : "Square item library",
    url: mode === "sandbox" ? "https://app.squareupsandbox.com/dashboard/items/library" : "https://app.squareup.com/dashboard/items/library",
    icon: IconBuildingStore,
    external: true,
  },
  { title: "Get help", url: "https://developer.squareup.com/docs/catalog-api/what-it-does", icon: IconHelp, external: true },
];

export function AppSidebar({
  user, mode, recent, currency, ...props
}: React.ComponentProps<typeof Sidebar> & { user: string; mode: string; recent: Upload[]; currency: string }) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Lister</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAV_MAIN} />
        <NavDocuments items={recent} currency={currency} />
        <NavSecondary items={navSecondary(mode)} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} mode={mode} />
      </SidebarFooter>
    </Sidebar>
  );
}
