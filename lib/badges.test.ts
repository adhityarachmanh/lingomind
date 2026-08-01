import { describe, expect, it } from "vitest";
import { evaluateBadgeMatches } from "./badges";

const badges = [
  { id: 1, requirement_type: "quiz_completed", requirement_value: 1, name: "First Step" },
  { id: 2, requirement_type: "streak", requirement_value: 7, name: "Week Warrior" },
  { id: 3, requirement_type: "coins", requirement_value: 100, name: "Rich Scholar" },
  { id: 4, requirement_type: "unknown", requirement_value: 999, name: "Ignore" },
];

describe("evaluateBadgeMatches", () => {
  it("semua terpenuhi", () => {
    const earned = evaluateBadgeMatches({ current_streak: 10, total_quiz_completed: 5, coins: 150 }, badges);
    expect(earned.map((b) => b.id).sort()).toEqual([1, 2, 3]);
  });
  it("tidak ada yang terpenuhi", () => {
    expect(evaluateBadgeMatches({ current_streak: 0, total_quiz_completed: 0, coins: 0 }, badges)).toEqual([]);
  });
  it("threshold tepat di nilai (>=)", () => {
    const earned = evaluateBadgeMatches({ current_streak: 7, total_quiz_completed: 1, coins: 100 }, badges);
    expect(earned.map((b) => b.id).sort()).toEqual([1, 2, 3]);
  });
  it("requirement_type tidak dikenal diabaikan", () => {
    const earned = evaluateBadgeMatches({ current_streak: 1000, total_quiz_completed: 1000, coins: 1000 }, [badges[3]]);
    expect(earned).toEqual([]);
  });
});
