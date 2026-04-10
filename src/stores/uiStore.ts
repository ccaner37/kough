import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  taskDetailOpen: boolean;
  activeTaskId: string | null;
  editingColumnId: string | null;

  toggleSidebar: () => void;
  openTaskDetail: (taskId: string) => void;
  closeTaskDetail: () => void;
  setEditingColumn: (columnId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  taskDetailOpen: false,
  activeTaskId: null,
  editingColumnId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  openTaskDetail: (taskId: string) =>
    set({ taskDetailOpen: true, activeTaskId: taskId }),

  closeTaskDetail: () =>
    set({ taskDetailOpen: false, activeTaskId: null }),

  setEditingColumn: (columnId: string | null) =>
    set({ editingColumnId: columnId }),
}));
