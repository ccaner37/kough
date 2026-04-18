import type { AppUsageSummary } from "@/types";

interface ActivityChartProps {
  summary: AppUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const BAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500",
  "bg-indigo-500", "bg-teal-500",
];

export function ActivityChart({ summary }: ActivityChartProps) {
  const filtered = summary.filter((s) => s.total_secs >= 600);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No activity data for this period
      </div>
    );
  }

  const maxSecs = filtered[0].total_secs;
  const maxSqrt = Math.sqrt(maxSecs);

  return (
    <div className="space-y-4">
      {filtered.map((item, i) => {
        const widthPercent = Math.max((Math.sqrt(item.total_secs) / maxSqrt) * 100, 3);
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={item.app_name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">
                {item.app_name.replace(".exe", "")}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDuration(item.total_secs)}
              </span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
