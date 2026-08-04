import { describe, expect, it } from "vitest";
import { buildChatHistory, buildOpeningPrompt, buildReplySystemPrompt } from "./chat";
import { splitKoreksi } from "../chat";

describe("splitKoreksi", () => {
  it("memisahkan bagian Koreksi:", () => {
    const r = splitKoreksi("Halo, apa kabar?\nKoreksi: Gunakan 'are' bukan 'is'.");
    expect(r.main).toContain("Halo, apa kabar?");
    expect(r.koreksi).toContain("Gunakan 'are'");
  });
  it("tanpa Koreksi → koreksi null", () => {
    const r = splitKoreksi("Halo saja.");
    expect(r.koreksi).toBeNull();
    expect(r.main).toBe("Halo saja.");
  });
  it("Koreksi di awal string (legacy empty main?)", () => {
    const r = splitKoreksi("Koreksi: x");
    expect(r.koreksi).toBe("x");
  });
  it("case-insensitive (koreksi:) tetap dipisah", () => {
    const r = splitKoreksi("Halo.\nkoreksi: pakai 'am'");
    expect(r.main).toContain("Halo.");
    expect(r.koreksi).toContain("pakai 'am'");
  });
  it("toleransi spasi (Koreksi :)", () => {
    const r = splitKoreksi("Halo\nKoreksi :  x ");
    expect(r.koreksi).toBe("x");
  });
});

describe("buildChatHistory", () => {
  it("ai → assistant, user → user", () => {
    const h = buildChatHistory([{ sender: "ai", content: "Halo" }, { sender: "user", content: "Hi" }]);
    expect(h).toEqual([
      { role: "assistant", content: "Halo" },
      { role: "user", content: "Hi" },
    ]);
  });
});

describe("buildOpeningPrompt", () => {
  it("topik: memuat bahasa, level, setting", () => {
    const p = buildOpeningPrompt("English", "A1", "Greetings", "Greetings", true);
    expect(p.system).toContain("TARGET BAHASA: English");
    expect(p.system).toContain("Topik yang sedang dilatih: 'Greetings'");
    expect(p.user).toContain("Buat sapaan pembuka");
  });
  it("persona: memuat skenario + goal", () => {
    const p = buildOpeningPrompt("English", "B1", "Bebas", "Cafe", false);
    expect(p.system).toContain("karakter di skenario 'Cafe'");
    expect(p.system).toContain("Goal belajar: Bebas");
  });
});

describe("buildReplySystemPrompt", () => {
  it("memuat instruksi Koreksi:", () => {
    const p = buildReplySystemPrompt("English", "A1", "Greetings", "Greetings", true);
    expect(p).toContain("Koreksi:");
    expect(p).toContain("maksimal 3 poin");
  });
  it("memuat format contoh koreksi (salah → benar — alasan)", () => {
    const p = buildReplySystemPrompt("English", "A1", "Greetings", "Greetings", true);
    expect(p).toContain("→");
    expect(p).toContain("WAJIB sertakan blok");
    expect(p).toContain("Jangan mengulangi koreksi yang sudah pernah diberikan");
  });
});
