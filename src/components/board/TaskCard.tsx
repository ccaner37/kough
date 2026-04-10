import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
      onClick={() => openTaskDetail(task.id)}
      className="group cursor-pointer rounded-md border border-border bg-background p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${priorityCfg.color}`}
              title={priorityCfg.label}
            />
            <p className="text-sm font-medium text-foreground truncate">
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
    </div>
  );
}
