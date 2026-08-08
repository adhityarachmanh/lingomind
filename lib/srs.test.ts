import { describe, expect, it } from "vitest";
import { srsReview } from "./srs";

describe("srsReview", () => {
  it("ingat pertama kali -> interval 1 hari", () => {
    const r = srsReview({ easeFactor: 2.5, intervalDays: 0, repetitions: 0 }, true, new Date("2026-08-05T10:00:00Z"));
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(r.easeFactor).toBe(2.5);
    expect(r.dueAt.toISOString()).toBe("2026-08-06T10:00:00.000Z");
  });

  it("ingat kedua kali -> interval 3 hari", () => {
    const r = srsReview({ easeFactor: 2.5, intervalDays: 1, repetitions: 1 }, true, new Date("2026-08-05T10:00:00Z"));
    expect(r.intervalDays).toBe(3);
    expect(r.repetitions).toBe(2);
  });

  it("ingat ketiga kali -> interval x easeFactor", () => {
    const r = srsReview({ easeFactor: 2.5, intervalDays: 3, repetitions: 2 }, true, new Date("2026-08-05T10:00:00Z"));
    expect(r.intervalDays).toBe(8);
    expect(r.dueAt.toISOString()).toBe("2026-08-13T10:00:00.000Z");
  });

  it("lupa -> reset interval & repetitions, easeFactor turun (min 1.3)", () => {
    const r = srsReview({ easeFactor: 2.5, intervalDays: 8, repetitions: 3 }, false, new Date("2026-08-05T10:00:00Z"));
    expect(r.intervalDays).toBe(0);
    expect(r.repetitions).toBe(0);
    expect(r.easeFactor).toBe(2.3);
    const min = srsReview({ easeFactor: 1.3, intervalDays: 8, repetitions: 3 }, false);
    expect(min.easeFactor).toBe(1.3);
  });
});
