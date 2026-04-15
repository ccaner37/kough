import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActivitySession } from "@/types";

interface SessionTimelineProps {
  sessions: ActivitySession[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  const grouped = groupByApp(sessions);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (app: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Sessions</h3>
      {grouped.map(([app, sessions]) => {
        const isOpen = expanded.has(app);
        const totalSecs = sessions.reduce((a, s) => a + (s.duration_secs ?? 0), 0);
        return (
          <div key={app} className="rounded-md border border-border">
            <button
              onClick={() => toggle(app)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{app.replace(".exe", "")}</span>
                <span className="text-xs text-muted-foreground">
                  ({sessions.length} sessions)
                </span>
              </div>
              <span className="text-muted-foreground">{formatDuration(totalSecs)}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-1.5 text-xs text-muted-foreground border-b border-border last:border-0"
                  >
                    <span className="truncate mr-2 flex-1">{s.app_title || "—"}</span>
                    <span>
                      {formatTime(s.started_at)} → {formatTime(s.ended_at!)}
                    </span>
                    <span className="ml-3 w-12 text-right">
                      {formatDuration(s.duration_secs ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function groupByApp(sessions: ActivitySession[]): [string, ActivitySession[]][] {
  const map = new Map<string, ActivitySession[]>();
  for (const s of sessions) {
    const list = map.get(s.app_name) ?? [];
    list.push(s);
    map.set(s.app_name, list);
  }
  return [...map.entries()];
}
