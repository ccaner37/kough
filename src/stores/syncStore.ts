import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { SyncSettings, SyncResult } from "@/types";

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastResult: SyncResult | null;
  lastError: string | null;

  fetchSettings: () => Promise<void>;
  saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) => Promise<void>;
  runPull: () => Promise<SyncResult | null>;
  runSync: () => Promise<SyncResult | null>;
  forceResync: () => Promise<SyncResult | null>;
}

async function executeSync(
  set: (partial: Partial<SyncState> | ((s: SyncState) => Partial<SyncState>)) => void,
  get: () => SyncState,
  mode: "pull" | "push",
): Promise<SyncResult | null> {
  const { syncing } = get();
  if (syncing) return null;
  set({ syncing: true, lastError: null });
  try {
    const result = await api.sync.run(mode);
    set({ lastResult: result });
    if (result.status === "ok" && result.server_time) {
      set({
        settings: { ...get().settings, last_sync: result.server_time },
        lastError: null,
      });
    } else if (result.status === "disabled") {
      set({ lastError: null });
    } else if (result.status === "not_configured") {
      set({ lastError: "Sync not configured. Enter server URL and sync key." });
    }
    return result;
  } catch (e: unknown) {
    let msg: string;
    if (e instanceof Error) {
      msg = e.message;
    } else if (typeof e === "object" && e !== null && "message" in e) {
      msg = String((e as Record<string, unknown>).message);
    } else if (typeof e === "string") {
      msg = e;
    } else {
      msg = JSON.stringify(e);
    }
    set({ lastError: msg, lastResult: null });
    return null;
  } finally {
    set({ syncing: false });
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  settings: { enabled: false, server_url: "", sync_key: "", last_sync: "" },
  syncing: false,
  lastResult: null,
  lastError: null,

  fetchSettings: async () => {
    const settings = await api.sync.getSettings();
    set({ settings });
  },

  saveSettings: async (enabled, serverUrl, syncKey) => {
    await api.sync.saveSettings(enabled, serverUrl, syncKey);
    set({
      settings: { ...get().settings, enabled, server_url: serverUrl, sync_key: syncKey },
    });
  },

  runPull: async () => executeSync(set, get, "pull"),

  runSync: async () => executeSync(set, get, "push"),

  forceResync: async () => {
    await api.sync.forceResync();
    set({ settings: { ...get().settings, last_sync: "1970-01-01T00:00:00.000Z" } });
    return executeSync(set, get, "push");
  },
}));
