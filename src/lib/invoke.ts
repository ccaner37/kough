import { invoke } from "@tauri-apps/api/core";
import type {
  Board, Column, Task, Tag,
  CreateBoardInput, UpdateBoardInput,
  CreateColumnInput, UpdateColumnInput,
  CreateTaskInput, UpdateTaskInput, MoveTaskInput, ReorderTaskInput,
  CreateTagInput, UpdateTagInput,
  ActivitySession, AppUsageSummary,
} from "@/types";

const cmd = <T>(name: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(name, args);

export const api = {
  boards: {
    list: () => cmd<Board[]>("get_boards"),
    create: (input: CreateBoardInput) => cmd<Board>("create_board", { input }),
    update: (input: UpdateBoardInput) => cmd<Board>("update_board", { input }),
    delete: (boardId: string) => cmd<void>("delete_board", { boardId }),
  },
  columns: {
    list: (boardId: string) => cmd<Column[]>("get_columns_by_board", { boardId }),
    create: (input: CreateColumnInput) => cmd<Column>("create_column", { input }),
    update: (input: UpdateColumnInput) => cmd<void>("update_column", { input }),
    delete: (columnId: string) => cmd<void>("delete_column", { columnId }),
    reorder: (columnId: string, newPosition: number) => cmd<void>("reorder_columns", { columnId, newPosition }),
  },
  tasks: {
    listByBoard: (boardId: string) => cmd<Task[]>("get_tasks_by_board", { boardId }),
    listByColumn: (columnId: string) => cmd<Task[]>("get_tasks_by_column", { columnId }),
    create: (input: CreateTaskInput) => cmd<Task>("create_task", { input }),
    update: (input: UpdateTaskInput) => cmd<Task>("update_task", { input }),
    move: (input: MoveTaskInput) => cmd<void>("move_task", { input }),
    reorder: (input: ReorderTaskInput) => cmd<void>("reorder_task", { input }),
    delete: (taskId: string) => cmd<void>("delete_task", { taskId }),
  },
  tags: {
    list: (boardId: string) => cmd<Tag[]>("get_tags_by_board", { boardId }),
    create: (input: CreateTagInput) => cmd<Tag>("create_tag", { input }),
    update: (input: UpdateTagInput) => cmd<Tag>("update_tag", { input }),
    delete: (tagId: string) => cmd<void>("delete_tag", { tagId }),
    forTask: (taskId: string) => cmd<Tag[]>("get_tags_for_task", { taskId }),
    addToTask: (taskId: string, tagId: string) => cmd<void>("add_tag_to_task", { taskId, tagId }),
    removeFromTask: (taskId: string, tagId: string) => cmd<void>("remove_tag_from_task", { taskId, tagId }),
  },
  activity: {
    summary: (startDate: string, endDate: string) =>
      cmd<AppUsageSummary[]>("get_activity_summary", { startDate, endDate }),
    sessions: (startDate: string, endDate: string) =>
      cmd<ActivitySession[]>("get_activity_sessions", { startDate, endDate }),
    activeSession: () => cmd<ActivitySession | null>("get_active_session"),
  },
};
