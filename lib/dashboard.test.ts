import { describe, expect, it } from "vitest";
import { computeLevelContentTargets, isLanguageReady, isLevelReady } from "./dashboard";

describe("computeLevelContentTargets", () => {
  it("lesson = goals*9, quiz = goals*5+10 (bagian 3, semua modifier, 5 varian)", () => {
    expect(computeLevelContentTargets(3)).toEqual({ lessonTotal: 27, quizTotal: 25 });
    expect(computeLevelContentTargets(0)).toEqual({ lessonTotal: 0, quizTotal: 10 });
    expect(computeLevelContentTargets(10)).toEqual({ lessonTotal: 90, quizTotal: 60 });
  });
});

describe("isLevelReady", () => {
  it("benar saat lesson & quiz cache memenuhi target", () => {
    expect(isLevelReady(27, 25, 3)).toBe(true);
    expect(isLevelReady(27, 26, 3)).toBe(true);
  });
  it("salah saat salah satu belum memenuhi target", () => {
    expect(isLevelReady(26, 25, 3)).toBe(false);
    expect(isLevelReady(27, 24, 3)).toBe(false);
    expect(isLevelReady(0, 0, 3)).toBe(false);
  });
  it("level tanpa topik dianggap siap", () => {
    expect(isLevelReady(0, 0, 0)).toBe(true);
  });
});

describe("isLanguageReady", () => {
  it("benar hanya jika SEMUA level lengkap", () => {
    expect(isLanguageReady([{ goalCount: 3, lessonCount: 27, quizCount: 25 }])).toBe(true);
    expect(
      isLanguageReady([
        { goalCount: 3, lessonCount: 27, quizCount: 25 },
        { goalCount: 2, lessonCount: 18, quizCount: 20 },
      ])
    ).toBe(true);
  });
  it("salah jika ada level yang belum lengkap", () => {
    expect(
      isLanguageReady([
        { goalCount: 3, lessonCount: 27, quizCount: 25 },
        { goalCount: 2, lessonCount: 0, quizCount: 0 },
      ])
    ).toBe(false);
    expect(isLanguageReady([])).toBe(false);
  });
});
