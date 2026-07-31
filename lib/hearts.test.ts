import { describe, expect, it } from "vitest";
import { computeHeartRefill } from "./dashboard";

const base = new Date("2026-07-31T08:00:00Z");

describe("computeHeartRefill", () => {
  it("tidak refill jika full", () => {
    const r = computeHeartRefill(5, new Date("2026-07-30T00:00:00Z"), base);
    expect(r).toEqual({ hearts: 5, lastRefill: new Date("2026-07-30T00:00:00Z") });
  });
  it("refill 1 heart setelah 4 jam", () => {
    const last = new Date("2026-07-31T04:00:00Z");
    const r = computeHeartRefill(4, last, base);
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
  it("refill 2 hearts setelah 8 jam (kapasitas 3→5)", () => {
    const last = new Date("2026-07-31T00:00:00Z");
    const r = computeHeartRefill(3, last, base);
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
  it("tetap 1 heart jika belum 4 jam", () => {
    const last = new Date("2026-07-31T07:30:00Z");
    const r = computeHeartRefill(2, last, base);
    expect(r.hearts).toBe(2);
    expect(r.lastRefill).toBe(last);
  });
  it("set lastRefill ke now jika null dan kurang dari 5", () => {
    const r = computeHeartRefill(3, null, base);
    expect(r.hearts).toBe(3);
    expect(r.lastRefill).toEqual(base);
  });
  it("advance lastRefill saat refill parsial (kapasitas 4→5 butuh 2 heart = 8 jam)", () => {
    const last = new Date("2026-07-31T00:00:00Z");
    const r = computeHeartRefill(4, last, new Date("2026-07-31T20:00:00Z")); // 20 jam > 8 jam butuh
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
});
