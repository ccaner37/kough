import { useState } from "react";
import { Plus, Trash2, Kanban } from "lucide-react";
import { useBoardStore } from "@/stores/boardStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { boards, activeBoardId, createBoard, setActiveBoard, deleteBoard } =
    useBoardStore();
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const board = await createBoard(trimmed);
    setNewTitle("");
    setShowInput(false);
    setActiveBoard(board.id);
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-3">
        <Kanban size={18} className="text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Boards
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {boards.map((board) => (
          <div
            key={board.id}
            className={cn(
              "group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer text-sm transition-colors",
              board.id === activeBoardId
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            onClick={() => setActiveBoard(board.id)}
          >
            <span className="truncate">{board.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteBoard(board.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        {showInput ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowInput(false);
                  setNewTitle("");
                }
              }}
              placeholder="Board name..."
              className="w-full rounded bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <Plus size={14} />
            New Board
          </button>
        )}
      </div>
    </div>
  );
}
