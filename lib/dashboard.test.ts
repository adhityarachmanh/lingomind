import { describe, expect, it } from "vitest";
import { computeLevelContentTargets, isLanguageReady, isLevelReady } from "./dashboard";

describe("computeLevelContentTargets", () => {
  it("lesson = goals*5, quiz = goals*1+2 (5 bagian lesson, 1 varian per unit quiz)", () => {
    expect(computeLevelContentTargets(3)).toEqual({ lessonTotal: 15, quizTotal: 5 });
    expect(computeLevelContentTargets(0)).toEqual({ lessonTotal: 0, quizTotal: 2 });
    expect(computeLevelContentTargets(10)).toEqual({ lessonTotal: 50, quizTotal: 12 });
  });
});

describe("isLevelReady", () => {
  it("benar saat lesson & quiz cache memenuhi target", () => {
    expect(isLevelReady(15, 5, 3)).toBe(true);
    expect(isLevelReady(15, 6, 3)).toBe(true);
  });
  it("salah saat salah satu belum memenuhi target", () => {
    expect(isLevelReady(14, 5, 3)).toBe(false);
    expect(isLevelReady(15, 4, 3)).toBe(false);
    expect(isLevelReady(15, 2, 3)).toBe(false);
    expect(isLevelReady(0, 0, 3)).toBe(false);
  });
  it("level tanpa topik dianggap siap", () => {
    expect(isLevelReady(0, 0, 0)).toBe(true);
  });
});

describe("isLanguageReady", () => {
  it("benar hanya jika SEMUA level lengkap", () => {
    expect(isLanguageReady([{ goalCount: 3, lessonCount: 15, quizCount: 5 }])).toBe(true);
    expect(
      isLanguageReady([
        { goalCount: 3, lessonCount: 15, quizCount: 5 },
        { goalCount: 2, lessonCount: 10, quizCount: 4 },
      ])
    ).toBe(true);
  });
  it("salah jika ada level yang belum lengkap", () => {
    expect(
      isLanguageReady([
        { goalCount: 3, lessonCount: 15, quizCount: 5 },
        { goalCount: 2, lessonCount: 0, quizCount: 0 },
      ])
    ).toBe(false);
    expect(isLanguageReady([])).toBe(false);
  });
});
