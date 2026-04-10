interface TagBadgeProps {
  tag: { name: string; color: string };
  size?: "sm" | "md";
  onRemove?: () => void;
}

export function TagBadge({ tag, size = "md", onRemove }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-medium ${
        size === "sm" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
      style={{
        backgroundColor: `${tag.color}25`,
        color: tag.color,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}
