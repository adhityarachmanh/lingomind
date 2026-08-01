import { describe, expect, it } from "vitest";
import { decideShopMysteryRoll, decideStreakRepair } from "./shop";

describe("decideShopMysteryRoll", () => {
  it("zonk <= 40", () => {
    const r = decideShopMysteryRoll(40);
    if (r.kind === "zonk") {
      expect(r.coins).toBe(10);
    } else {
      expect.unreachable();
    }
  });
  it("double xp 41-75", () => {
    expect(decideShopMysteryRoll(75).kind).toBe("double_xp");
  });
  it("streak freeze 76-95", () => {
    expect(decideShopMysteryRoll(95).kind).toBe("streak_freeze");
  });
  it("jackpot > 95", () => {
    const r = decideShopMysteryRoll(100);
    if (r.kind === "jackpot") {
      expect(r.coins).toBe(100);
    } else {
      expect.unreachable();
    }
  });
});

describe("decideStreakRepair", () => {
  const now = new Date("2026-08-02T10:00:00Z");
  it("tanpa riwayat → belum hangus", () => {
    const r = decideStreakRepair({ lastActiveDate: null, currentStreak: 0, previousStreak: 0, now });
    expect(r.action).toBe("none");
    expect(r.message).toContain("belum memiliki riwayat");
  });
  it("aktif hari ini → masih aktif", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-08-02T00:00:00Z"), currentStreak: 3, previousStreak: 0, now });
    expect(r.action).toBe("none");
    expect(r.message).toContain("masih aktif");
  });
  it("kemarin → masih aktif (diff 1)", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-08-01T00:00:00Z"), currentStreak: 3, previousStreak: 0, now });
    expect(r.action).toBe("none");
  });
  it("gap >= 2 hari → restore", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-07-25T00:00:00Z"), currentStreak: 3, previousStreak: 5, now });
    if (r.action === "restore") {
      expect(r.currentStreak).toBe(6); // previous + 1
    } else {
      expect.unreachable();
    }
    expect(r.message).toContain("berhasil dipulihkan");
  });
});
