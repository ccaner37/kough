import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { useTagStore } from "@/stores/tagStore";
import { useBoardStore } from "@/stores/boardStore";
import { TagBadge } from "./TagBadge";
import { DEFAULT_TAG_COLORS } from "@/types";

export function TagFilter() {
  const { tags, activeTagFilters, toggleTagFilter, clearTagFilters, createTag } =
    useTagStore();
  const { activeBoardId } = useBoardStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLORS[0]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !activeBoardId) return;
    await createTag(activeBoardId, trimmed, newColor);
    setNewName("");
    setShowCreate(false);
  };

  if (tags.length === 0 && !showCreate) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          <Plus size={12} />
          Create tag
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
      <Tag size={14} className="text-muted-foreground flex-shrink-0" />

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => toggleTagFilter(tag.id)}
          className={`flex-shrink-0 rounded-full transition-all ${
            activeTagFilters.has(tag.id)
              ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <TagBadge tag={tag} />
        </button>
      ))}

      {activeTagFilters.size > 0 && (
        <button
          onClick={clearTagFilters}
          className="flex-shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
        >
          <X size={10} />
          Clear
        </button>
      )}

      <button
        onClick={() => setShowCreate(!showCreate)}
        className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <Plus size={14} />
      </button>

      {showCreate && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowCreate(false);
            }}
            placeholder="Tag name..."
            className="w-24 rounded bg-secondary px-2 py-0.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-1">
            {DEFAULT_TAG_COLORS.slice(0, 6).map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`h-4 w-4 rounded-full border-2 ${
                  newColor === c ? "border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
