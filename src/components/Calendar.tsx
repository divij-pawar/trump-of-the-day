import { useEffect, useState, type KeyboardEvent } from "react";
import {
  addDays,
  addMonths,
  compareMonths,
  daysInMonth,
  FIRST_DAY,
  firstWeekday,
  formatLong,
  formatMonth,
  isoFromParts,
  monthOf,
  type ISODate,
} from "../lib/dates";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalendarProps {
  selectedDate: ISODate;
  onDateSelect: (date: ISODate) => void;
  minDate?: ISODate;
  maxDate: ISODate;
  /** Today in the pipeline's (UTC) calendar; outlined. */
  today: ISODate;
}

const Calendar = ({ selectedDate, onDateSelect, minDate = FIRST_DAY, maxDate, today }: CalendarProps) => {
  const [view, setView] = useState(() => monthOf(selectedDate));

  // Follow the selection when it moves to another month (initial load, live update, keyboard).
  useEffect(() => {
    setView(monthOf(selectedDate));
  }, [selectedDate]);

  const minMonth = monthOf(minDate);
  const maxMonth = monthOf(maxDate);
  const canPrev = compareMonths(view, minMonth) > 0;
  const canNext = compareMonths(view, maxMonth) < 0;

  const select = (date: ISODate) => {
    if (date >= minDate && date <= maxDate) onDateSelect(date);
  };

  // Arrow keys move the selection by a day/week, matching the WAI-ARIA grid pattern.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    select(addDays(selectedDate, step));
  };

  const cells = [];
  for (let i = 0; i < firstWeekday(view); i++) {
    cells.push(<div key={`pad-${i}`} aria-hidden="true" />);
  }
  for (let day = 1; day <= daysInMonth(view); day++) {
    const date = isoFromParts(view.year, view.month, day);
    const disabled = date < minDate || date > maxDate;
    const selected = date === selectedDate;
    const isToday = date === today;
    const isFirstDay = date === FIRST_DAY;

    cells.push(
      <button
        key={date}
        type="button"
        role="gridcell"
        disabled={disabled}
        aria-selected={selected}
        aria-current={isToday ? "date" : undefined}
        aria-label={formatLong(date)}
        tabIndex={selected ? 0 : -1}
        onClick={() => select(date)}
        className={`relative mx-auto h-9 w-9 rounded-full text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${
            disabled
              ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
              : selected
                ? "bg-blue-600 text-white"
                : isToday
                  ? "border border-red-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  : "hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
      >
        {day}
        {isFirstDay && (
          <span className="absolute -right-0.5 -top-0.5 text-xs text-yellow-500" aria-hidden="true">
            ★
          </span>
        )}
      </button>,
    );
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(addMonths(view, -1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="rounded-full p-2 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
        >
          ◀️
        </button>
        <h2 className="text-lg font-bold text-red-600 dark:text-yellow-400" aria-live="polite">
          {formatMonth(view)}
        </h2>
        <button
          type="button"
          onClick={() => setView(addMonths(view, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="rounded-full p-2 hover:bg-gray-200 disabled:opacity-30 dark:hover:bg-gray-700"
        >
          ▶️
        </button>
      </div>
      <div
        role="grid"
        aria-label={formatMonth(view)}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1 text-center text-gray-700 dark:text-gray-300"
      >
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="text-xs font-bold">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
};

export default Calendar;
