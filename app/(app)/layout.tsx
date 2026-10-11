import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { userName } from "@/lib/auth";
import { dbStatus } from "@/lib/db";
import { readHistory } from "@/lib/history";
import { status as squareStatus } from "@/lib/square";

// User, recent files and connection status come from env / the database at request time
export const dynamic = "force-dynamic";

const RECENT = 5;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [history, square, db] = await Promise.all([readHistory(), squareStatus(), dbStatus()]);
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" user={userName} mode={square.mode} recent={history.slice(0, RECENT)} currency={square.currency ?? ""} />
      <SidebarInset>
        <SiteHeader square={square} db={db} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
