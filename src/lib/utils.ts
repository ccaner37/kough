import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateFractionalIndex(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1.0;
  if (before === null) return after! / 2.0;
  if (after === null) return before! + 1.0;
  return (before + after) / 2.0;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
