import type { AppUsageSummary } from "@/types";

interface ActivityChartProps {
  summary: AppUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const BAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500",
  "bg-indigo-500", "bg-teal-500",
];

export function ActivityChart({ summary }: ActivityChartProps) {
  if (summary.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No activity data for this period
      </div>
    );
  }

  const maxSecs = summary[0].total_secs;

  return (
    <div className="space-y-2">
      {summary.map((item, i) => {
        const widthPercent = Math.max((item.total_secs / maxSecs) * 100, 2);
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={item.app_name} className="flex items-center gap-3">
            <span className="w-32 truncate text-sm text-muted-foreground text-right">
              {item.app_name.replace(".exe", "")}
            </span>
            <div className="flex-1 h-6 bg-secondary rounded overflow-hidden">
              <div
                className={`h-full rounded ${color} transition-all`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="w-16 text-sm text-right">
              {formatDuration(item.total_secs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
