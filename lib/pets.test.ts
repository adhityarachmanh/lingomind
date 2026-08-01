import { describe, expect, it } from "vitest";
import { computePetStage, feedPetProgress, petEmojiLabel } from "./pets";

describe("computePetStage", () => {
  it("0-99 → 1", () => {
    expect(computePetStage(0)).toBe(1);
    expect(computePetStage(99)).toBe(1);
  });
  it("100-299 → 2", () => {
    expect(computePetStage(100)).toBe(2);
    expect(computePetStage(299)).toBe(2);
  });
  it("300-999 → 3", () => {
    expect(computePetStage(300)).toBe(3);
    expect(computePetStage(999)).toBe(3);
  });
  it(">=1000 → 4", () => {
    expect(computePetStage(1000)).toBe(4);
  });
});

describe("feedPetProgress", () => {
  it("exp naik, stage tetap", () => {
    expect(feedPetProgress(1, 40)).toEqual({ stage: 1, exp: 90 });
  });
  it("melewati 100 → stage 2, exp reset", () => {
    expect(feedPetProgress(1, 80)).toEqual({ stage: 2, exp: 30 });
  });
  it("melewati 300 → stage 3", () => {
    expect(feedPetProgress(2, 280)).toEqual({ stage: 3, exp: 30 });
  });
  it("stage 4 → exp terus naik (Max)", () => {
    expect(feedPetProgress(4, 1200)).toEqual({ stage: 4, exp: 1250 });
  });
});

describe("petEmojiLabel", () => {
  it("dragon 4 stage", () => {
    expect(petEmojiLabel("dragon", 1).emoji).toBe("🥚");
    expect(petEmojiLabel("dragon", 4).emoji).toBe("🐉");
    expect(petEmojiLabel("dragon", 4).label).toBe("Naga Raksasa");
  });
  it("owl", () => {
    expect(petEmojiLabel("owl", 2).label).toBe("Anak Burung");
  });
  it("fenrir", () => {
    expect(petEmojiLabel("fenrir", 3).label).toBe("Serigala Muda");
  });
  it("fallback", () => {
    expect(petEmojiLabel("unknown", 1).label).toBe("Telur Misterius");
  });
});
