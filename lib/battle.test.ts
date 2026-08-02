import { describe, expect, it } from "vitest";
import { decideBattleMessage, decideBattleWinner, normalizeBattleScore } from "./battle";

describe("decideBattleWinner", () => {
  it("challenger menang", () => {
    expect(decideBattleWinner(80, 60)).toBe("challenger");
  });
  it("challenged menang", () => {
    expect(decideBattleWinner(40, 90)).toBe("challenged");
  });
  it("seri", () => {
    expect(decideBattleWinner(50, 50)).toBe("tie");
  });
});

describe("decideBattleMessage", () => {
  it("pemenang yang submit → menang", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "challenger", amWinner: true });
    expect(m).toContain("Selamat! Anda menang");
    expect(m).toContain("50 Koin");
  });
  it("pecundang yang submit → kalah", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "challenged", amWinner: false });
    expect(m).toContain("Anda kalah");
  });
  it("seri", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "tie", amWinner: false });
    expect(m).toContain("SERI");
  });
  it("challenger pertama submit → menunggu", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: false, winner: "tie", amWinner: false });
    expect(m).toContain("Menunggu lawan");
  });
  it("challenged submit pertama → skor disimpan", () => {
    const m = decideBattleMessage({ amChallenger: false, bothPlayed: false, winner: "tie", amWinner: false });
    expect(m).toBe("Skor berhasil disimpan!");
  });
});

describe("normalizeBattleScore", () => {
  it("skor 0 → 0", () => {
    expect(normalizeBattleScore(0, 20)).toBe(0);
  });
  it("skor penuh → 100", () => {
    expect(normalizeBattleScore(100, 20)).toBe(100);
  });
  it("setengah → 50", () => {
    expect(normalizeBattleScore(50, 20)).toBe(50);
  });
  it("5 dari max 50 (pts 10) → 10", () => {
    expect(normalizeBattleScore(5, 10)).toBe(10);
  });
  it("skor di atas max di-clamp → 100", () => {
    expect(normalizeBattleScore(999, 20)).toBe(100);
  });
  it("skor negatif → 0", () => {
    expect(normalizeBattleScore(-5, 20)).toBe(0);
  });
  it("skor 30 dari max 100 (pts 20) → 30", () => {
    expect(normalizeBattleScore(30, 20)).toBe(30);
  });
});
