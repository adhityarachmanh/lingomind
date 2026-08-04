import { describe, expect, it } from "vitest";
import { computeGoalMastery } from "./mastery";

describe("computeGoalMastery", () => {
  const now = new Date("2026-08-04T10:00:00Z");
  const log = (topic: string, activityType: string, passed: boolean, daysAgo: number) => ({
    topic,
    activityType,
    passed,
    createdAt: new Date(now.getTime() - daysAgo * 86400000),
  });

  it("level = jumlah lesson + quiz lulus, per topik (maks 5)", () => {
    const m = computeGoalMastery(
      [
        log("Sapaan", "lesson", true, 5),
        log("Sapaan", "lesson", true, 5),
        log("Sapaan", "quiz", true, 3),
        log("Keluarga", "lesson", true, 2),
      ],
      now
    );
    expect(m.get("Sapaan")?.level).toBe(3);
    expect(m.get("Keluarga")?.level).toBe(1);
    expect(m.get("Tidak Ada")).toBeUndefined();
  });

  it("cap di 5 walau aktivitas berlebih", () => {
    const logs = [1, 2, 3, 4, 5, 6, 7].map((d) => log("Sapaan", "quiz", true, d));
    expect(computeGoalMastery(logs, now).get("Sapaan")?.level).toBe(5);
  });

  it("quiz gagal tidak menambah mastery", () => {
    const m = computeGoalMastery([log("Sapaan", "quiz", false, 1)], now);
    expect(m.get("Sapaan")?.level).toBe(0);
    expect(m.get("Sapaan")?.reviewDue).toBe(false);
  });

  it("nextReviewAt = aktivitas terakhir + interval level; reviewDue saat jadwal lewat", () => {
    const level1 = computeGoalMastery([log("Sapaan", "lesson", true, 3)], now).get("Sapaan")!;
    expect(level1.nextReviewAt).toEqual(new Date(now.getTime() - 2 * 86400000)); // level 1 → interval 1 hari
    expect(level1.reviewDue).toBe(true);

    const level2 = computeGoalMastery(
      [log("Keluarga", "lesson", true, 2), log("Keluarga", "quiz", true, 2)],
      now
    ).get("Keluarga")!;
    expect(level2.level).toBe(2);
    expect(level2.reviewDue).toBe(false); // interval 3 hari, baru 2 hari → belum lewat

    const fresh = computeGoalMastery([log("Angka", "lesson", true, 0)], now).get("Angka")!;
    expect(fresh.reviewDue).toBe(false);
  });
});
