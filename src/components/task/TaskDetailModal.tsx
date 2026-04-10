import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { PRIORITY_CONFIG, type Priority } from "@/types";
import { cn } from "@/lib/utils";

function detectLineType(line: string): "h1" | "h2" | "h3" | "h4" | "checkbox-checked" | "checkbox-unchecked" | "list" | "blockquote" | "code" | "hr" | "empty" | "paragraph" {
  if (!line.trim()) return "empty";
  if (/^#{1}\s/.test(line)) return "h1";
  if (/^#{2}\s/.test(line)) return "h2";
  if (/^#{3}\s/.test(line)) return "h3";
  if (/^#{4,}\s/.test(line)) return "h4";
  if (/^[-*]\s+\[x\]/i.test(line)) return "checkbox-checked";
  if (/^[-*]\s+\[\s\]/.test(line)) return "checkbox-unchecked";
  if (/^[-*]\s+/.test(line)) return "list";
  if (/^>\s/.test(line)) return "blockquote";
  if (/^---+$/.test(line.trim())) return "hr";
  return "paragraph";
}

function extractCheckboxState(line: string): { checked: boolean; text: string } {
  const match = line.match(/^[-*]\s+\[([xX ])\]\s*(.*)/);
  if (!match) return { checked: false, text: line };
  return { checked: match[1].toLowerCase() === "x", text: match[2] };
}

function LineEditor({
  line,
  isActive,
  onActivate,
  onChange,
  onInsertBelow,
  onRemoveLine,
}: {
  line: string;
  isActive: boolean;
  onActivate: () => void;
  onChange: (value: string) => void;
  onInsertBelow: () => void;
  onRemoveLine: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lineType = detectLineType(line);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onInsertBelow();
    }
    if (e.key === "Backspace" && !line && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      onRemoveLine();
    }
    if (e.key === "ArrowDown" && e.currentTarget.selectionStart !== null && e.currentTarget.selectionStart >= line.length) {
      e.preventDefault();
      onInsertBelow();
    }
  };

  const getFontClass = () => {
    switch (lineType) {
      case "h1": return "text-2xl font-bold";
      case "h2": return "text-xl font-bold";
      case "h3": return "text-lg font-semibold";
      case "h4": return "text-base font-semibold";
      default: return "text-sm";
    }
  };

  return (
    <div
      className={cn(
        "group/block relative rounded px-1 -mx-1 cursor-text min-h-[1.65em]",
        isActive ? "bg-muted/40" : "hover:bg-muted/15",
      )}
      onClick={onActivate}
    >
      {isActive ? (
        <input
          ref={inputRef}
          type="text"
          value={line}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {}}
          className={cn(
            "w-full bg-transparent text-foreground outline-none font-mono placeholder:text-muted-foreground",
            getFontClass()
          )}
          placeholder={lineType === "empty" ? "Type something..." : ""}
        />
      ) : (
        <div className={cn("pointer-events-none", getFontClass())}>
          {lineType === "empty" ? (
            <span className="text-muted-foreground/40 text-xs opacity-0 group-hover/block:opacity-100 transition-opacity">
              <Plus size={12} className="inline mr-1 -mt-0.5" />
              click to add content
            </span>
          ) : lineType === "checkbox-checked" || lineType === "checkbox-unchecked" ? (
            (() => {
              const { checked, text } = extractCheckboxState(line);
              return (
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className={checked ? "line-through text-muted-foreground" : "text-foreground"}>
                    {text}
                  </span>
                </span>
              );
            })()
          ) : lineType === "hr" ? (
            <hr className="border-border my-1" />
          ) : (
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              disallowedElements={["input"]}
            >
              {line}
            </Markdown>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskDetailModal() {
  const { activeTaskId, closeTaskDetail } = useUIStore();
  const { tasks, updateTask, deleteTask } = useTaskStore();
  const { tags, taskTags, addTagToTask, removeTagFromTask } = useTagStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const task = tasks.find((t) => t.id === activeTaskId);
  const taskTagList = activeTaskId ? taskTags[activeTaskId] || [] : [];

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description_md);
      setPriority(task.priority);
      setDueDate(task.due_date || "");
    }
  }, [task]);

  const saveDescription = useCallback(
    (newDesc: string) => {
      setDescription(newDesc);
      updateTask(task!.id, { description_md: newDesc });
    },
    [task, updateTask]
  );

  if (!task) return null;

  const handleSave = async () => {
    await updateTask(task.id, {
      title: title.trim() || task.title,
      description_md: description,
      priority,
      due_date: dueDate || null,
    });
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    closeTaskDetail();
  };

  const handleToggleTag = async (tagId: string) => {
    if (!activeTaskId) return;
    const hasTag = taskTagList.some((t) => t.id === tagId);
    if (hasTag) {
      await removeTagFromTask(activeTaskId, tagId);
    } else {
      await addTagToTask(activeTaskId, tagId);
    }
  };

  const handleLineChange = (index: number, value: string) => {
    const lines = description.split("\n");
    lines[index] = value;
    saveDescription(lines.join("\n"));
  };

  const handleInsertBelow = (index: number) => {
    const lines = description.split("\n");
    lines.splice(index + 1, 0, "");
    saveDescription(lines.join("\n"));
    setActiveLineIndex(index + 1);
  };

  const handleRemoveLine = (index: number) => {
    const lines = description.split("\n");
    if (lines.length <= 1) {
      saveDescription("");
      return;
    }
    lines.splice(index, 1);
    saveDescription(lines.join("\n"));
    const newIdx = Math.min(index - 1, lines.length - 1);
    setActiveLineIndex(newIdx);
  };

  const lines = description.split("\n");

  return (
    <Dialog open={true} onOpenChange={() => closeTaskDetail()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col bg-card border-border p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="sr-only">Task Detail</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            placeholder="Task title..."
            className="w-full bg-transparent text-xl font-bold text-foreground outline-none placeholder:text-muted-foreground mb-4"
          />

          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Priority:
            </span>
            {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={async () => {
                  setPriority(p);
                  await updateTask(task.id, { priority: p });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs transition-colors",
                  priority === p
                    ? `${PRIORITY_CONFIG[p].color} text-white`
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                )}
              >
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Due:
            </span>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                updateTask(task.id, { due_date: e.target.value || null });
              }}
              className="w-44 bg-secondary border-border text-foreground text-sm"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Tags:
            </span>
            {taskTagList.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleToggleTag(tag.id)}
                  className="ml-0.5 hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
            {tags
              .filter((t) => !taskTagList.some((tt) => tt.id === t.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className="rounded-full px-2 py-0.5 text-xs text-muted-foreground border border-dashed border-border hover:bg-accent/50"
                >
                  + {tag.name}
                </button>
              ))}
          </div>

          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Description
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-secondary/30 p-4"
            onClick={(e) => {
              if (e.target === scrollContainerRef.current) {
                setActiveLineIndex(-1);
              }
            }}
          >
            <div className="kough-prose max-w-none">
              {lines.map((line, i) => (
                <LineEditor
                  key={`${i}-${lines.length}`}
                  line={line}
                  isActive={activeLineIndex === i}
                  onActivate={() => setActiveLineIndex(i)}
                  onChange={(val) => handleLineChange(i, val)}
                  onInsertBelow={() => handleInsertBelow(i)}
                  onRemoveLine={() => handleRemoveLine(i)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={14} className="mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
