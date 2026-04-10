import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { PRIORITY_CONFIG } from "@/types";
import { useUIStore } from "@/stores/uiStore";
import { useTagStore } from "@/stores/tagStore";
import { useEffect } from "react";
import { TagBadge } from "@/components/tags/TagBadge";

interface TaskCardProps {
  task: Task;
}

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  if (args.isSorting) return defaultAnimateLayoutChanges(args);
  return false;
};

export function TaskCard({ task }: TaskCardProps) {
  const { openTaskDetail } = useUIStore();
  const { taskTags, fetchTagsForTask } = useTagStore();
  const priorityCfg = PRIORITY_CONFIG[task.priority];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    animateLayoutChanges,
  });

  useEffect(() => {
    if (!taskTags[task.id]) {
      fetchTagsForTask(task.id);
    }
  }, [task.id, taskTags, fetchTagsForTask]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
  };

  const tags = taskTags[task.id] || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => openTaskDetail(task.id)}
      className="cursor-grab rounded-md border border-border bg-background p-3 transition-all duration-150 hover:shadow-md hover:border-muted-foreground/30 hover:-translate-y-0.5 active:cursor-grabbing"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <span
            className={`inline-block mt-1 h-2 w-2 rounded-full flex-shrink-0 ${priorityCfg.color}`}
            title={priorityCfg.label}
          />
          <p className="text-sm font-medium text-foreground break-words">
            {task.title}
          </p>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
          </div>
        )}
        {task.due_date && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Due: {new Date(task.due_date).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
