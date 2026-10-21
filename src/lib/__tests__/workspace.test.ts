import { describe, expect, it } from "vitest";
import { dueState, interestOf, nowPosition, scheduleLayout, taskFor } from "../workspace";

describe("workspace helpers", () => {
  it("maps priority to interest and dots", () => {
    expect(interestOf("A")).toEqual({ level: "hot", dots: 5 });
    expect(interestOf("C")).toEqual({ level: "medium", dots: 3 });
    expect(interestOf(null)).toEqual({ level: "unrated", dots: 1 });
  });

  it("names the next task, replies first", () => {
    expect(taskFor("PROPOSAL_SENT", false)).toEqual({ title: "Chase the proposal", kind: "proposal" });
    expect(taskFor("PROPOSAL_SENT", true).kind).toBe("reply");
    expect(taskFor("NEW", false).title).toBe("First call");
  });

  it("classifies due dates against today", () => {
    const now = new Date(2026, 9, 21, 15, 0);
    expect(dueState(new Date(2026, 9, 20, 9), now)).toBe("overdue");
    expect(dueState(new Date(2026, 9, 21, 9), now)).toBe("today");
    expect(dueState(new Date(2026, 9, 22, 9), now)).toBe("upcoming");
    expect(dueState(null, now)).toBe("none");
  });

  it("lays meetings out on an 8–20 timeline", () => {
    const day = new Date(2026, 9, 21);
    const [a, b] = scheduleLayout([{ id: "a", start: new Date(2026, 9, 21, 14, 0) }, { id: "b", start: new Date(2026, 9, 21, 19, 30) }], day);
    expect(a.left).toBe(50);
    expect(a.width).toBeCloseTo(100 / 12);
    expect(b.left + b.width).toBeLessThanOrEqual(100);
    expect(nowPosition(new Date(2026, 9, 21, 11, 0))).toBe(25);
    expect(nowPosition(new Date(2026, 9, 21, 22, 0))).toBeNull();
  });
});
