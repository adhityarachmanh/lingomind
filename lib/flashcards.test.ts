import { describe, expect, it } from "vitest";
import { sm2Next } from "./flashcards";

describe("sm2Next", () => {
  it("quality 2 (Ulangi) → interval 1, repetition reset 0, ef turun", () => {
    const r = sm2Next(2.5, 5, 3, 2);
    expect(r.intervalDays).toBe(1);
    expect(r.repetition).toBe(0);
    expect(r.easeFactor).toBeLessThan(2.5);
  });
  it("quality 4 (Bagus) rep 1 → interval 1, rep 1", () => {
    const r = sm2Next(2.5, 1, 0, 4);
    expect(r.intervalDays).toBe(1);
    expect(r.repetition).toBe(1);
    expect(r.easeFactor).toBeGreaterThanOrEqual(2.5);
  });
  it("quality 4 rep 2 → interval 3", () => {
    const r = sm2Next(2.5, 1, 1, 4);
    expect(r.intervalDays).toBe(3);
    expect(r.repetition).toBe(2);
  });
  it("quality 5 rep 3 → interval round(interval * ef)", () => {
    const r = sm2Next(2.6, 3, 2, 5);
    expect(r.intervalDays).toBe(Math.round(3 * 2.6));
    expect(r.repetition).toBe(3);
  });
  it("ef tidak pernah di bawah 1.3", () => {
    const r = sm2Next(1.3, 1, 0, 2);
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it("interval tidak pernah 0", () => {
    const r = sm2Next(1.3, 1, 99, 5);
    expect(r.intervalDays).toBeGreaterThanOrEqual(1);
  });
});
