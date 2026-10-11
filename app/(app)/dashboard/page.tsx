import { ActivityCard } from "@/components/dashboard/activity-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UploadsTable } from "@/components/dashboard/uploads-table";
import { readHistory } from "@/lib/history";
import { status } from "@/lib/square";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Lister" };

export default async function DashboardPage() {
  const [history, square] = await Promise.all([readHistory(), status()]);
  const cur = square.currency ?? "";
  return (
    // Bento grid. Left column: the stats card at its natural height, then the file list
    // filling the rest. Right column: the activity card spans both rows, so it is always
    // tall and vertical. Below md everything stacks. 1rem = the inset frame's top + bottom margin.
    <div className="flex flex-col gap-4 p-4 lg:p-6 md:grid md:h-[calc(100svh-var(--header-height)-1rem)] md:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] md:grid-rows-[auto_minmax(0,1fr)] animate-in fade-in duration-500">
      <div className="md:col-start-1 md:row-start-1">
        <StatsCard history={history} currency={cur} square={square} />
      </div>
      <div className="md:col-start-2 md:row-span-2 md:row-start-1 min-h-0">
        <ActivityCard history={history} currency={cur} />
      </div>
      <div className="min-h-0 max-md:h-[32rem] md:col-start-1 md:row-start-2">
        <UploadsTable history={history} currency={cur} />
      </div>
    </div>
  );
}
