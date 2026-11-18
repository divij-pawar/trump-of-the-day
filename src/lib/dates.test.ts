import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampDate,
  compareMonths,
  daysInMonth,
  firstWeekday,
  formatLong,
  isValidISODate,
  todayUTC,
} from "./dates";

describe("dates", () => {
  it("uses the UTC calendar day regardless of local timezone", () => {
    // 9pm in New York on Mar 9 is already Mar 10 in UTC, the pipeline's day.
    expect(todayUTC(new Date("2025-03-10T02:00:00Z"))).toBe("2025-03-10");
  });

  it("formats without shifting the day", () => {
    expect(formatLong("2025-01-20")).toBe("January 20, 2025");
  });

  it("handles month lengths, including leap years", () => {
    expect(daysInMonth({ year: 2025, month: 1 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 1 })).toBe(29);
    expect(daysInMonth({ year: 2025, month: 3 })).toBe(30);
  });

  it("finds the first weekday of a month", () => {
    expect(firstWeekday({ year: 2025, month: 0 })).toBe(3); // Jan 1 2025 was a Wednesday
  });

  it("adds months across year boundaries", () => {
    expect(addMonths({ year: 2025, month: 11 }, 1)).toEqual({ year: 2026, month: 0 });
    expect(addMonths({ year: 2025, month: 0 }, -1)).toEqual({ year: 2024, month: 11 });
    expect(compareMonths({ year: 2025, month: 0 }, { year: 2024, month: 11 })).toBeGreaterThan(0);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("validates dates", () => {
    expect(isValidISODate("2025-02-28")).toBe(true);
    expect(isValidISODate("2025-02-30")).toBe(false);
    expect(isValidISODate("02/28/2025")).toBe(false);
  });

  it("clamps into range", () => {
    expect(clampDate("2024-12-31", "2025-01-20", "2025-03-01")).toBe("2025-01-20");
    expect(clampDate("2025-04-01", "2025-01-20", "2025-03-01")).toBe("2025-03-01");
  });
});
