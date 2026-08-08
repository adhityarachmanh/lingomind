import { describe, expect, it } from "vitest";
import { mapHistoryToAiMessages, normalizeSuggestedReplies, parseStreamedSections } from "./chat-helpers";

describe("mapHistoryToAiMessages", () => {
  it("memetakan pesan ai dengan analysisJson ke reply_in_target_language", () => {
    const result = mapHistoryToAiMessages([
      { role: "user", content: "Hello", analysisJson: null },
      { role: "ai", content: "old", analysisJson: { reply_in_target_language: "Hi there!" } },
    ]);
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ]);
  });

  it("fallback ke content bila analysisJson tidak ada", () => {
    const result = mapHistoryToAiMessages([{ role: "ai", content: "plain", analysisJson: null }]);
    expect(result).toEqual([{ role: "assistant", content: "plain" }]);
  });

  it("membuang entri dengan content kosong", () => {
    const result = mapHistoryToAiMessages([
      { role: "user", content: "", analysisJson: null },
      { role: "ai", content: "  ", analysisJson: null },
      { role: "user", content: "ok", analysisJson: null },
    ]);
    expect(result).toEqual([{ role: "user", content: "ok" }]);
  });
});

describe("normalizeSuggestedReplies", () => {
  it("menormalisasi objek saran dengan romanisasi dan arti", () => {
    const result = normalizeSuggestedReplies([
      { text: "네, 좋아요.", romanization: "ne, joayo.", translation_in_indonesian: "Ya, bagus." },
    ]);
    expect(result).toEqual([
      { text: "네, 좋아요.", romanization: "ne, joayo.", translation_in_indonesian: "Ya, bagus." },
    ]);
  });

  it("menangani saran lama berbentuk string", () => {
    const result = normalizeSuggestedReplies(["Hello", "How are you?"]);
    expect(result).toEqual([{ text: "Hello" }, { text: "How are you?" }]);
  });

  it("membuang entri tidak valid dan kosong", () => {
    const result = normalizeSuggestedReplies([null, 42, { text: "" }, { text: "   " }, { text: "ok" }]);
    expect(result).toEqual([{ text: "ok" }]);
  });

  it("mengembalikan array kosong untuk input non-array", () => {
    expect(normalizeSuggestedReplies(undefined)).toEqual([]);
    expect(normalizeSuggestedReplies({})).toEqual([]);
  });
});

describe("parseStreamedSections", () => {
  it("memisahkan userRomanization, userTranslation, replyText, replyRomanization (format lengkap)", () => {
    const result = parseStreamedSections(
      "||UROM||annyeonghaseyo\n||UTRANS||Halo\n안녕하세요! 어떻게 지내요?\n||ROM||\nannyeonghaseyo! eotteoke jinaeyo?"
    );
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요! 어떻게 지내요?",
      replyRomanization: "annyeonghaseyo! eotteoke jinaeyo?",
    });
  });

  it("bahasa Latin: hanya ||UTRANS|| (tanpa UROM/ROM)", () => {
    const result = parseStreamedSections("||UTRANS||Halo\nHi there! How are you?");
    expect(result).toEqual({
      userTranslation: "Halo",
      replyText: "Hi there! How are you?",
    });
    expect(result.userRomanization).toBeUndefined();
    expect(result.replyRomanization).toBeUndefined();
  });

  it("marker dengan isi kosong → ambil baris berikutnya (format lama ||ROM||)", () => {
    const result = parseStreamedSections("안녕하세요!\n||ROM||\nannyeonghaseyo!");
    expect(result).toEqual({
      replyText: "안녕하세요!",
      replyRomanization: "annyeonghaseyo!",
    });
  });

  it("||UROM|| dengan isi kosong → ambil baris berikutnya", () => {
    const result = parseStreamedSections("||UROM||\nannyeonghaseyo\n||UTRANS||Halo\n안녕하세요!");
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요!",
    });
  });

  it("tanpa marker sama sekali → seluruh teks jadi replyText (general/polos)", () => {
    const result = parseStreamedSections("Halo, silakan tanya apa saja!");
    expect(result).toEqual({ replyText: "Halo, silakan tanya apa saja!" });
  });

  it("trim whitespace pada tiap seksi", () => {
    const result = parseStreamedSections("||UTRANS||   Halo   \n  Balasan.  \n");
    expect(result).toEqual({ userTranslation: "Halo", replyText: "Balasan." });
  });

  it("replyText kosong bila tidak ada isi", () => {
    const result = parseStreamedSections("");
    expect(result).toEqual({ replyText: "" });
  });

  it("memisahkan replyTranslation dari ||RTRANS|| (format lengkap 4 marker)", () => {
    const result = parseStreamedSections(
      "||UROM||annyeonghaseyo\n||UTRANS||Halo\n안녕하세요!\n||RTRANS||Halo!\n||ROM||\nannyeonghaseyo!"
    );
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요!",
      replyTranslation: "Halo!",
      replyRomanization: "annyeonghaseyo!",
    });
  });

  it("bahasa Latin: ||UTRANS|| + ||RTRANS|| tanpa UROM/ROM", () => {
    const result = parseStreamedSections("||UTRANS||Halo\nHi there!\n||RTRANS||Halo juga!");
    expect(result).toEqual({
      userTranslation: "Halo",
      replyText: "Hi there!",
      replyTranslation: "Halo juga!",
    });
    expect(result.userRomanization).toBeUndefined();
    expect(result.replyRomanization).toBeUndefined();
  });

  it("||RTRANS|| tetap dikenali walau muncul SETELAH ||ROM|| (urutan dibalik AI)", () => {
    const result = parseStreamedSections("안녕!\n||ROM||\nannyeong!\n||RTRANS||Halo!");
    expect(result).toEqual({
      replyText: "안녕!",
      replyRomanization: "annyeong!",
      replyTranslation: "Halo!",
    });
  });

  it("||RTRANS|| dengan isi kosong → ambil baris berikutnya", () => {
    const result = parseStreamedSections("Hi!\n||RTRANS||\nHalo!");
    expect(result).toEqual({
      replyText: "Hi!",
      replyTranslation: "Halo!",
    });
  });

  it("format lama tetap bekerja: balasan lalu ||ROM|| (tanpa RTRANS)", () => {
    const result = parseStreamedSections("안녕하세요!\n||ROM||\nannyeonghaseyo!");
    expect(result).toEqual({
      replyText: "안녕하세요!",
      replyRomanization: "annyeonghaseyo!",
    });
    expect(result.replyTranslation).toBeUndefined();
  });
});
