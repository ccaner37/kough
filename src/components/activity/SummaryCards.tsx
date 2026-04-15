import type { AppUsageSummary } from "@/types";

interface SummaryCardsProps {
  summary: AppUsageSummary[];
  totalSessions: number;
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function SummaryCards({ summary, totalSessions }: SummaryCardsProps) {
  const totalSecs = summary.reduce((acc, s) => acc + s.total_secs, 0);
  const topApp = summary.length > 0 ? summary[0] : null;

  const cards = [
    { label: "Total Screen Time", value: formatDuration(totalSecs) },
    {
      label: "Most Used App",
      value: topApp ? topApp.app_name.replace(".exe", "") : "—",
    },
    { label: "Sessions", value: totalSessions.toString() },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
