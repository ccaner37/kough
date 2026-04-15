import { useEffect } from "react";
import { useActivityStore } from "@/stores/activityStore";
import { SummaryCards } from "./SummaryCards";
import { ActivityChart } from "./ActivityChart";
import { SessionTimeline } from "./SessionTimeline";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Today", offset: 0 },
  { label: "Yesterday", offset: -1 },
  { label: "Last 7 Days", offset: -7 },
  { label: "Last 30 Days", offset: -30 },
  { label: "All Time", offset: null },
] as const;

function toDateStr(offset: number | null): { start: string; end: string } {
  if (offset === null) {
    return { start: "2000-01-01T00:00:00Z", end: farFuture() };
  }
  const d = new Date();
  if (offset < 0) d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  const start = d.toISOString();
  const endD = new Date(d);
  if (offset === 0 || offset === -1) {
    endD.setDate(endD.getDate() + 1);
  } else {
    endD.setDate(new Date().getDate() + 1);
  }
  return { start, end: endD.toISOString() };
}

function farFuture(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString();
}

export function ActivityView() {
  const {
    summary, sessions, activeSession, loading,
    fetchSummary, fetchSessions, fetchActiveSession,
    setDateRange,
  } = useActivityStore();

  useEffect(() => {
    fetchSummary();
    fetchSessions();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchActiveSession, 5000);
    fetchActiveSession();
    return () => clearInterval(interval);
  }, []);

  const handlePreset = (offset: number | null) => {
    const { start, end } = toDateStr(offset);
    setDateRange(start, end);
    useActivityStore.setState({ startDate: start, endDate: end });
    fetchSummary();
    fetchSessions();
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          {activeSession && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Tracking: {activeSession.app_name.replace(".exe", "")}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.offset)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                "text-muted-foreground hover:bg-accent/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <>
          <SummaryCards summary={summary} totalSessions={sessions.length} />
          <ActivityChart summary={summary} />
          <SessionTimeline sessions={sessions} />
        </>
      )}
    </div>
  );
}
