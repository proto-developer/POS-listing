"use client";

/** Donut of added / already there / skipped for one upload. */

import { Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { Upload } from "@/lib/types";

const config = {
  added: { label: "Added", color: "var(--success)" },
  there: { label: "Already there", color: "var(--primary)" },
  skipped: { label: "Skipped", color: "var(--warning)" },
} satisfies ChartConfig;

export function ResultRing({
  u, size, thickness, animate = true, children,
}: { u: Upload; size: number; thickness: number; animate?: boolean; children?: React.ReactNode }) {
  const data = [
    { key: "added", value: u.created, fill: "var(--color-added)" },
    { key: "there", value: u.exists, fill: "var(--color-there)" },
    { key: "skipped", value: u.skipped.length, fill: "var(--color-skipped)" },
  ].filter((d) => d.value > 0);
  const r = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ChartContainer config={config} className="size-full">
        <PieChart>
          <Pie
            data={data.length ? data : [{ key: "none", value: 1, fill: "var(--secondary)" }]}
            dataKey="value"
            nameKey="key"
            innerRadius={r - thickness}
            outerRadius={r}
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={0}
            minAngle={10}
            paddingAngle={data.length > 1 ? 4 : 0}
            cornerRadius={data.length > 1 ? 2 : 0}
            isAnimationActive={animate}
            animationDuration={900}
          />
        </PieChart>
      </ChartContainer>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
