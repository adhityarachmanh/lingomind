import { describe, expect, it } from "vitest";
import {
  computeAddHeart,
  computeExamOutcome,
  computeQuizOutcome,
  computeStreakAfterActivity,
  nextLevelAfterExam,
} from "./progress";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("computeStreakAfterActivity", () => {
  it("belum pernah aktif → streak 1, lastActiveDate hari ini", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 0, previousStreak: 0, longestStreak: 0, lastActiveDate: null, streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.lastActiveDate).toEqual(d("2026-08-01"));
  });
  it("aktif hari yang sama → streak tetap, previous tetap", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 5, previousStreak: 5, longestStreak: 7, lastActiveDate: d("2026-08-01"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(5);
    expect(r.previousStreak).toBe(5);
  });
  it("kemarin → streak +1, previous tetap", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 3, previousStreak: 2, longestStreak: 3, lastActiveDate: d("2026-07-31"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(4);
    expect(r.previousStreak).toBe(2);
    expect(r.longestStreak).toBe(4);
  });
  it("gap 2 hari tanpa freeze → reset 1, previous = streak lama", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 6, previousStreak: 0, longestStreak: 6, lastActiveDate: d("2026-07-30"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(1);
    expect(r.previousStreak).toBe(6);
    expect(r.longestStreak).toBe(6);
  });
  it("gap 2 hari dengan 2 freeze → +1 dan freeze berkurang", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 4, previousStreak: 0, longestStreak: 4, lastActiveDate: d("2026-07-30"), streakFreezes: 2, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(5);
    expect(r.streakFreezes).toBe(1);
  });
  it("Senin (dow 1) gap 3 hari dengan weekend amulet → +1", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 7, previousStreak: 0, longestStreak: 7, lastActiveDate: d("2026-07-31") /* Jumat */, streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-08-03") // Senin
    );
    expect(r.currentStreak).toBe(8);
  });
  it("Minggu (dow 0) gap 2 hari dengan weekend amulet → +1", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 9, previousStreak: 0, longestStreak: 9, lastActiveDate: d("2026-07-31") /* Jumat */, streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-08-02") // Minggu
    );
    expect(r.currentStreak).toBe(10);
  });
  it("hari lain (Selasa) gap 2 hari dengan amulet → reset (amulet hanya akhir pekan)", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 3, previousStreak: 0, longestStreak: 3, lastActiveDate: d("2026-07-28") /* Selasa */, streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-07-30") // Kamis
    );
    expect(r.currentStreak).toBe(1);
    expect(r.previousStreak).toBe(3);
  });
});

describe("computeQuizOutcome", () => {
  it("nilai sempurna & topik sesuai → passed, topic_idx +1", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 0, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r).toEqual({ passed: true, newTopicIdx: 1 });
  });
  it("nilai kurang → tidak passed, tidak naik", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 0, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 40 });
    expect(r).toEqual({ passed: false, newTopicIdx: 0 });
  });
  it("nilai penuh tapi topik bukan topik aktif → tidak passed", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 2, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r.passed).toBe(false);
  });
  it("passed di topik terakhir → topic_idx jadi 4 (sentinel semua topik selesai)", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 3, topicsInLevel: 4, playedTopicIdx: 3, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r).toEqual({ passed: true, newTopicIdx: 4 });
  });
  it("topic_idx sudah 4 (sentinel) → re-pass tetap 4 (idempotent)", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 4, topicsInLevel: 4, playedTopicIdx: 4, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r).toEqual({ passed: true, newTopicIdx: 4 });
  });
});

describe("computeAddHeart", () => {
  it("naik satu, cap 5", () => {
    expect(computeAddHeart(3)).toBe(4);
    expect(computeAddHeart(5)).toBe(5);
  });
});

describe("computeExamOutcome", () => {
  it("8 soal, 6 benar → lulus (ceil 6), skor 6*pts", () => {
    const r = computeExamOutcome({ correctCount: 6, total: 8, ptsPerQuestion: 10 });
    expect(r).toEqual({ passingScore: 6, passed: true, scoreGained: 60 });
  });
  it("8 soal, 5 benar → tidak lulus", () => {
    expect(computeExamOutcome({ correctCount: 5, total: 8, ptsPerQuestion: 10 }).passed).toBe(false);
  });
  it("4 soal, 3 benar → lulus", () => {
    expect(computeExamOutcome({ correctCount: 3, total: 4, ptsPerQuestion: 20 }).passed).toBe(true);
  });
});

describe("nextLevelAfterExam", () => {
  it("naik ke level berikutnya", () => {
    expect(nextLevelAfterExam(["A1", "A2", "B1", "B2", "C1", "C2"], "A1")).toBe("A2");
  });
  it("C2 tetap C2", () => {
    expect(nextLevelAfterExam(["A1", "A2", "B1", "B2", "C1", "C2"], "C2")).toBe("C2");
  });
});
