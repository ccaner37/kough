import type { BrowserUsageSummary } from "@/types";

interface BrowserDetailProps {
  summary: BrowserUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function BrowserDetail({ summary }: BrowserDetailProps) {
  if (summary.length === 0) return null;

  const maxSecs = summary[0].total_secs;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Websites</h3>
      <div className="space-y-2">
        {summary.map((item) => {
          const widthPercent = Math.max((item.total_secs / maxSecs) * 100, 3);
          return (
            <div key={item.domain}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-muted-foreground truncate mr-2">
                  {item.domain}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDuration(item.total_secs)}
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
