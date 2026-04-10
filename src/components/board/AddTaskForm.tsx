import { useState } from "react";
import { useTaskStore } from "@/stores/taskStore";
import type { Priority } from "@/types";

interface AddTaskFormProps {
  columnId: string;
  onClose: () => void;
}

export function AddTaskForm({ columnId, onClose }: AddTaskFormProps) {
  const { createTask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await createTask(columnId, trimmed, priority);
    setTitle("");
    onClose();
  };

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onClose();
        }}
        placeholder="Task title..."
        className="w-full rounded bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                priority === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
