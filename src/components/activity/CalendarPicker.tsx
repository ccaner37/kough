import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarPickerProps {
  startDate: string;
  endDate: string;
  onRangeSelect: (start: string, end: string) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarPicker({ startDate, endDate, onRangeSelect }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(startDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();

  const prevMonth = () => {
    setViewMonth((v) => {
      const m = v.month === 0 ? 11 : v.month - 1;
      const y = v.month === 0 ? v.year - 1 : v.year;
      return { year: y, month: m };
    });
  };

  const nextMonth = () => {
    setViewMonth((v) => {
      const m = v.month === 11 ? 0 : v.month + 1;
      const y = v.month === 11 ? v.year + 1 : v.year;
      return { year: y, month: m };
    });
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!selectingEnd) {
      onRangeSelect(dateStr, dateStr);
      setSelectingEnd(true);
    } else {
      if (dateStr < startDate) {
        onRangeSelect(dateStr, dateStr);
      } else {
        onRangeSelect(startDate, dateStr);
      }
      setSelectingEnd(false);
      setOpen(false);
    }
  };

  const isSelected = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setSelectingEnd(false); }}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs transition-colors flex items-center gap-1",
          open
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50"
        )}
      >
        <Calendar size={12} />
        Date Range
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 rounded-lg border border-border bg-card shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="text-xs text-muted-foreground hover:text-foreground p-1">
              ←
            </button>
            <span className="text-xs font-medium">{monthName}</span>
            <button onClick={nextMonth} className="text-xs text-muted-foreground hover:text-foreground p-1">
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DAYS.map((d) => (
              <span key={d} className="text-[10px] text-muted-foreground">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "text-xs rounded-sm py-1 hover:bg-accent/50 transition-colors",
                    selected && "bg-accent text-accent-foreground",
                    !selected && "text-muted-foreground"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {selectingEnd && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Select end date
            </p>
          )}

          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
