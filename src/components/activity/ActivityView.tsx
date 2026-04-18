import { useEffect } from "react";
import { useActivityStore } from "@/stores/activityStore";
import { SummaryCards } from "./SummaryCards";
import { ActivityChart } from "./ActivityChart";
import { BrowserDetail } from "./BrowserDetail";
import { CalendarPicker } from "./CalendarPicker";
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
    return { start: "2000-01-01", end: farFuture() };
  }
  const d = new Date();
  if (offset < 0) d.setDate(d.getDate() + offset);
  const start = d.toISOString().split("T")[0];
  let endD: Date;
  if (offset === 0 || offset === -1) {
    endD = new Date(d);
    endD.setDate(endD.getDate() + 1);
  } else {
    endD = new Date();
    endD.setDate(endD.getDate() + 1);
  }
  return { start, end: endD.toISOString().split("T")[0] };
}

function farFuture(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().split("T")[0];
}

export function ActivityView() {
  const {
    appSummary, browserSummary, activeTracking, loading,
    fetchAppSummary, fetchBrowserSummary, fetchActiveTracking,
    startDate, endDate, setDateRange,
  } = useActivityStore();

  useEffect(() => {
    fetchAppSummary();
    fetchBrowserSummary();
  }, [startDate, endDate]);

  useEffect(() => {
    const interval = setInterval(fetchActiveTracking, 5000);
    fetchActiveTracking();
    return () => clearInterval(interval);
  }, []);

  const handlePreset = (offset: number | null) => {
    const { start, end } = toDateStr(offset);
    setDateRange(start, end);
  };

  const handleCalendarRange = (start: string, end: string) => {
    const actualEnd = new Date(end);
    actualEnd.setDate(actualEnd.getDate() + 1);
    setDateRange(start, actualEnd.toISOString().split("T")[0]);
  };

  const activePreset = (offset: number | null): boolean => {
    const { start, end } = toDateStr(offset);
    return startDate === start && endDate === end;
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          {activeTracking && activeTracking.app_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Tracking: {activeTracking.app_name.replace(".exe", "")}
              {activeTracking.domain && ` — ${activeTracking.domain}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.offset)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                activePreset(p.offset)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              {p.label}
            </button>
          ))}
          <CalendarPicker
            startDate={startDate}
            endDate={endDate}
            onRangeSelect={handleCalendarRange}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <>
          <SummaryCards appSummary={appSummary} browserSummary={browserSummary} />
          <ActivityChart summary={appSummary} />
          <BrowserDetail summary={browserSummary} />
        </>
      )}
    </div>
  );
}
