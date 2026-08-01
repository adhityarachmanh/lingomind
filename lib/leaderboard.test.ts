import { describe, expect, it } from "vitest";
import { daysLeftInWeek, decideNextDivision, weekStartOf } from "./leaderboard";

describe("weekStartOf", () => {
  it("Senin → hari itu sendiri", () => {
    const d = new Date("2026-08-03T15:00:00Z"); // Senin
    expect(weekStartOf(d).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
  it("Minggu → Senin sebelumnya", () => {
    const d = new Date("2026-08-09T10:00:00Z"); // Minggu
    expect(weekStartOf(d).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
});

describe("daysLeftInWeek", () => {
  it("Senin → 6", () => {
    expect(daysLeftInWeek(new Date("2026-08-03T00:00:00Z"))).toBe(6);
  });
  it("Minggu → 0", () => {
    expect(daysLeftInWeek(new Date("2026-08-09T00:00:00Z"))).toBe(0);
  });
  it("Rabu → 4", () => {
    expect(daysLeftInWeek(new Date("2026-08-05T00:00:00Z"))).toBe(4);
  });
});

describe("decideNextDivision", () => {
  it("tanpa riwayat → Bronze (0)", () => {
    expect(decideNextDivision(null, null)).toBe(0);
  });
  it("rank <= 5 → naik 1", () => {
    expect(decideNextDivision(1, 3)).toBe(2);
  });
  it("rank >= 26 → turun 1", () => {
    expect(decideNextDivision(2, 30)).toBe(1);
  });
  it("rank tengah → tetap", () => {
    expect(decideNextDivision(2, 15)).toBe(2);
  });
  it("cap: Diamond (3) rank 1 → tetap 3", () => {
    expect(decideNextDivision(3, 1)).toBe(3);
  });
  it("floor: Bronze (0) rank 30 → tetap 0", () => {
    expect(decideNextDivision(0, 30)).toBe(0);
  });
});
