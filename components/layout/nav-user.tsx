"use client";

/** Sidebar footer: who is signed in, which Square mode, and Log out. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconDotsVertical, IconLoader, IconLogout } from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { api } from "@/lib/api-client";
import { modeLabel } from "@/lib/format";

export function NavUser({ user, mode }: { user: string; mode: string }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initials = user.slice(0, 2).toUpperCase();

  async function logout() {
    setBusy(true);
    // Even if the request fails the session cookie may be gone; the login wall decides.
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const identity = (
    <>
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user}</span>
        <span className="truncate text-xs text-muted-foreground">{modeLabel(mode)}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              {identity}
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{identity}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} disabled={busy}>
              {busy ? <IconLoader className="animate-spin" /> : <IconLogout />}
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
