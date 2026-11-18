import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Calendar from "./Calendar";

describe("Calendar", () => {
  it("disables days outside the allowed range", () => {
    render(<Calendar selectedDate="2025-01-25" onDateSelect={() => {}} maxDate="2025-03-10" today="2025-03-10" />);
    expect(screen.getByRole("gridcell", { name: "January 19, 2025" })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: "January 20, 2025" })).toBeEnabled();
  });

  it("can't page before the first month or past the current one", () => {
    render(<Calendar selectedDate="2025-01-25" onDateSelect={() => {}} maxDate="2025-02-10" today="2025-02-10" />);
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("February 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("allows paging into the max month even when today is the 31st-ish", () => {
    // The old calendar computed the max month as `new Date(y, m, 31)`, which rolled
    // over into the next month for 30-day months.
    render(<Calendar selectedDate="2025-03-15" onDateSelect={() => {}} maxDate="2025-04-30" today="2025-04-30" />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("April 2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("selects with click and arrow keys", () => {
    const onSelect = vi.fn();
    render(<Calendar selectedDate="2025-02-10" onDateSelect={onSelect} maxDate="2025-03-10" today="2025-03-10" />);
    fireEvent.click(screen.getByRole("gridcell", { name: "February 12, 2025" }));
    expect(onSelect).toHaveBeenLastCalledWith("2025-02-12");
    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith("2025-02-17");
  });

  it("ignores keyboard moves past the max date", () => {
    const onSelect = vi.fn();
    render(<Calendar selectedDate="2025-03-10" onDateSelect={onSelect} maxDate="2025-03-10" today="2025-03-10" />);
    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowRight" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
