import type { AppUsageSummary, BrowserUsageSummary } from "@/types";

interface SummaryCardsProps {
  appSummary: AppUsageSummary[];
  browserSummary: BrowserUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SummaryCards({ appSummary, browserSummary }: SummaryCardsProps) {
  const totalSecs = appSummary.reduce((acc, s) => acc + s.total_secs, 0);
  const topApp = appSummary.length > 0 ? appSummary[0] : null;
  const topSite = browserSummary.length > 0 ? browserSummary[0] : null;

  const cards = [
    { label: "Total Screen Time", value: formatDuration(totalSecs) },
    { label: "Top App", value: topApp ? topApp.app_name.replace(".exe", "") : "—" },
    { label: "Top Website", value: topSite ? topSite.domain : "—" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
