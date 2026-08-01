import { describe, expect, it } from "vitest";
import { decideStreakMilestone, formatFeedDate } from "./social";

describe("formatFeedDate", () => {
  it("format legacy %d %b %Y, %H:%M", () => {
    const d = new Date("2026-08-02T14:30:00Z");
    expect(formatFeedDate(d)).toBe("02 Aug 2026, 14:30");
  });
  it("jam dua digit", () => {
    const d = new Date("2026-01-05T09:05:00Z");
    expect(formatFeedDate(d)).toBe("05 Jan 2026, 09:05");
  });
});

describe("decideStreakMilestone", () => {
  it("7 → true", () => {
    expect(decideStreakMilestone(7)).toBe(true);
  });
  it("14 → true", () => {
    expect(decideStreakMilestone(14)).toBe(true);
  });
  it("6 → false", () => {
    expect(decideStreakMilestone(6)).toBe(false);
  });
  it("0 → false", () => {
    expect(decideStreakMilestone(0)).toBe(false);
  });
});
