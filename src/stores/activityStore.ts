import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { ActivitySession, AppUsageSummary } from "@/types";

interface ActivityState {
  summary: AppUsageSummary[];
  sessions: ActivitySession[];
  activeSession: ActivitySession | null;
  loading: boolean;
  startDate: string;
  endDate: string;

  fetchSummary: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchActiveSession: () => Promise<void>;
  setDateRange: (start: string, end: string) => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0] + "T00:00:00Z";
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0] + "T00:00:00Z";
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  summary: [],
  sessions: [],
  activeSession: null,
  loading: false,
  startDate: today(),
  endDate: tomorrow(),

  fetchSummary: async () => {
    const { startDate, endDate } = get();
    set({ loading: true });
    const summary = await api.activity.summary(startDate, endDate);
    set({ summary, loading: false });
  },

  fetchSessions: async () => {
    const { startDate, endDate } = get();
    const sessions = await api.activity.sessions(startDate, endDate);
    set({ sessions });
  },

  fetchActiveSession: async () => {
    const activeSession = await api.activity.activeSession();
    set({ activeSession });
  },

  setDateRange: (start: string, end: string) => {
    set({ startDate: start, endDate: end });
  },
}));
