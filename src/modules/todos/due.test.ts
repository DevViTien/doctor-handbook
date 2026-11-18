import { describe, expect, it } from "vitest";

import { compareDone, compareOpen, describeDue, shortDay } from "@/modules/todos/due";
import type { TodoItem } from "@/modules/todos/types";

const today = "2026-11-19";

describe("describeDue", () => {
  it("names overdue, today, tomorrow, and plain dates", () => {
    expect(describeDue("2026-11-16", today)).toEqual({ text: "Quá hạn · 16/11", tone: "overdue" });
    expect(describeDue("2026-11-19", today)).toEqual({ text: "Hôm nay", tone: "today" });
    expect(describeDue("2026-11-20", today)).toEqual({ text: "Ngày mai", tone: "soon" });
    expect(describeDue("2026-11-25", today)).toEqual({ text: "25/11", tone: "plain" });
  });

  it("adds the year when it is not this year", () => {
    expect(describeDue("2027-01-05", today).text).toBe("05/01/2027");
    expect(describeDue("2025-12-31", today).text).toBe("Quá hạn · 31/12/2025");
    expect(shortDay("2026-03-02", today)).toBe("02/03");
  });

  it("counts across a month and a year boundary", () => {
    expect(describeDue("2027-01-01", "2026-12-31").text).toBe("Ngày mai");
    expect(describeDue("2026-12-01", "2026-11-30").tone).toBe("soon");
  });
});

const item = (id: string, over: Partial<TodoItem>): TodoItem => ({
  id,
  content: id,
  dueDate: null,
  completedAt: null,
  createdAt: "2026-11-19T03:00:00.000Z",
  ...over,
});

describe("compareOpen", () => {
  it("Thứ tự việc chưa xong: dated (earliest first), then undated (newest first)", () => {
    const a = item("A", { dueDate: "2026-11-24" });
    const b = item("B", { dueDate: "2026-11-20" });
    const c = item("C", { createdAt: "2026-11-18T03:00:00.000Z" });
    const d = item("D", { createdAt: "2026-11-19T03:00:00.000Z" });
    expect([c, a, d, b].sort(compareOpen).map((x) => x.id)).toEqual(["B", "A", "D", "C"]);
  });

  it("same due date: newest first", () => {
    const old = item("old", { dueDate: today, createdAt: "2026-11-10T00:00:00.000Z" });
    const fresh = item("new", { dueDate: today, createdAt: "2026-11-18T00:00:00.000Z" });
    expect([old, fresh].sort(compareOpen).map((x) => x.id)).toEqual(["new", "old"]);
  });
});

describe("compareDone", () => {
  it("most recently completed first", () => {
    const first = item("first", { completedAt: "2026-11-18T00:00:00.000Z" });
    const last = item("last", { completedAt: "2026-11-19T00:00:00.000Z" });
    expect([first, last].sort(compareDone).map((x) => x.id)).toEqual(["last", "first"]);
  });
});
