import { describe, expect, it } from "vitest";
import { decideMissionMysteryRoll, decideTierRequirement } from "./mission";

const base = { quizzesCompleted: 0, correctAnswersToday: 0, pvpWinsToday: 0, tier1Claimed: false, tier2Claimed: false, tier3Claimed: false };

describe("decideTierRequirement", () => {
  it("tier 1 belum kuis → error", () => {
    const r = decideTierRequirement(base, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Selesaikan 1 Kuis terlebih dahulu!");
  });
  it("tier 1 siap → 20 koin", () => {
    const r = decideTierRequirement({ ...base, quizzesCompleted: 1 }, 1);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(20);
  });
  it("tier 1 sudah diklaim → error", () => {
    const r = decideTierRequirement({ ...base, quizzesCompleted: 5, tier1Claimed: true }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Peti Kayu sudah diklaim!");
  });
  it("tier 2 butuh 50 benar", () => {
    expect(decideTierRequirement({ ...base, correctAnswersToday: 49 }, 2).ok).toBe(false);
    const r = decideTierRequirement({ ...base, correctAnswersToday: 50 }, 2);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(50);
  });
  it("tier 3 butuh 3 pvp", () => {
    expect(decideTierRequirement({ ...base, pvpWinsToday: 2 }, 3).ok).toBe(false);
    const r = decideTierRequirement({ ...base, pvpWinsToday: 3 }, 3);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(100);
  });
  it("tier tidak valid", () => {
    const r = decideTierRequirement(base, 9);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Tier tidak valid");
  });
});

describe("decideMissionMysteryRoll", () => {
  it("<=50 freeze", () => {
    expect(decideMissionMysteryRoll(50)).toBe("streak_freeze");
  });
  it(">50 double xp", () => {
    expect(decideMissionMysteryRoll(51)).toBe("double_xp");
  });
});
