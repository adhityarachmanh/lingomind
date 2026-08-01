import { describe, expect, it } from "vitest";
import { decideBattleMessage, decideBattleWinner } from "./battle";

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
