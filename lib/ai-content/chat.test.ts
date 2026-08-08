import { describe, expect, it } from "vitest";
import { buildGeneralOpeningPrompt, buildGeneralStreamPrompt, buildGeneralSummaryPrompt, buildPolyglotOpeningPrompt, buildPolyglotStreamPrompt, buildPolyglotSystemPrompt, buildPolyglotUserMessage, buildSummaryPrompt } from "./chat";

describe("buildPolyglotSystemPrompt", () => {
  it("mencantumkan suggested_replies di skema JSON", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).toContain("suggested_replies");
  });

  it("memberi aturan untuk suggested_replies", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).toContain("2-3 kalimat singkat");
  });

  it("menempatkan suggested_replies sebagai field terakhir skema", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt.indexOf("suggested_replies")).toBeGreaterThan(prompt.indexOf("reply_translation_in_indonesian"));
  });

  it("mencantumkan arti Indonesia pada native_rephrasing", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).toContain("formal_meaning_in_indonesian");
    expect(prompt).toContain("casual_meaning_in_indonesian");
  });

  it("menggunakan bentuk objek untuk suggested_replies (text, romanization, translation)", () => {
    const prompt = buildPolyglotSystemPrompt("Korean", "A1", "Restaurant");
    expect(prompt).toContain("translation_in_indonesian");
    expect(prompt).toContain('"text"');
  });

  it("mencantumkan romanisasi untuk bahasa non-Latin", () => {
    const prompt = buildPolyglotSystemPrompt("Korean", "A1", "Restaurant");
    expect(prompt).toContain("corrected_romanization");
    expect(prompt).toContain("formal_romanization");
    expect(prompt).toContain("casual_romanization");
    expect(prompt).toContain("romanization");
    expect(prompt).toContain("huruf Latin");
  });

  it("mencantumkan reply_romanization untuk bahasa non-Latin", () => {
    const prompt = buildPolyglotSystemPrompt("Korean", "A1", "Restaurant");
    expect(prompt).toContain("reply_romanization");
  });

  it("tidak mencantumkan reply_romanization untuk bahasa Latin", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).not.toContain("reply_romanization");
  });

  it("mencantumkan arti & romanisasi pesan user (user_message_*)", () => {
    const prompt = buildPolyglotSystemPrompt("Korean", "A1", "Restaurant");
    expect(prompt).toContain("user_message_translation_in_indonesian");
    expect(prompt).toContain("user_message_romanization");
  });
});

describe("buildPolyglotUserMessage", () => {
  it("memisahkan instructions dari messages (tanpa role system)", () => {
    const history = [{ role: "assistant" as const, content: "Hi there!" }];
    const { instructions, messages } = buildPolyglotUserMessage("Hello", "English", "A1", "Restaurant", history);
    expect(instructions).toContain("Restaurant");
    expect(instructions).toContain("suggested_replies");
    expect(messages).toEqual([
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "Hello" },
    ]);
  });
});

describe("buildPolyglotOpeningPrompt", () => {
  it("menghasilkan instructions pembuka yang memuat skenario dan suggested_replies, dengan pesan starter user", () => {
    const { instructions, messages } = buildPolyglotOpeningPrompt("English", "A1", "Restaurant");
    expect(instructions).toContain("Restaurant");
    expect(instructions).toContain("suggested_replies");
    expect(messages).toEqual([{ role: "user", content: "Mulai percakapan!" }]);
  });

  it("menyertakan reply_romanization untuk pembuka non-Latin", () => {
    const { instructions } = buildPolyglotOpeningPrompt("Korean", "A1", "Restaurant");
    expect(instructions).toContain("reply_romanization");
  });

  it("tidak menyertakan reply_romanization untuk pembuka Latin", () => {
    const { instructions } = buildPolyglotOpeningPrompt("English", "A1", "Restaurant");
    expect(instructions).not.toContain("reply_romanization");
  });
});

describe("buildPolyglotStreamPrompt", () => {
  it("menghasilkan instructions teks polos tanpa JSON", () => {
    const history = [{ role: "assistant" as const, content: "Hi there!" }];
    const { instructions, messages } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", history);
    expect(instructions).toContain("Restaurant");
    expect(instructions).toContain("TANPA JSON");
    expect(instructions).not.toContain("suggested_replies");
    expect(messages).toEqual([
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "Hello" },
    ]);
  });

  it("menyertakan pemisah romanisasi ||ROM|| untuk bahasa non-Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("안녕하세요", "Korean", "A1", "Restaurant", []);
    expect(instructions).toContain("||ROM||");
    expect(instructions).toContain("romanisasi");
  });

  it("tidak menyertakan pemisah romanisasi untuk bahasa Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", []);
    expect(instructions).not.toContain("||ROM||");
  });

  it("menyertakan pemisah ||UROM|| dan ||UTRANS|| untuk bahasa non-Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("안녕하세요", "Korean", "A1", "Restaurant", []);
    expect(instructions).toContain("||UROM||");
    expect(instructions).toContain("||UTRANS||");
  });

  it("menyertakan ||UTRANS|| tanpa ||UROM|| untuk bahasa Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", []);
    expect(instructions).toContain("||UTRANS||");
    expect(instructions).not.toContain("||UROM||");
  });
});

describe("buildGeneralStreamPrompt", () => {
  it("menghasilkan instruksi role umum dengan markdown, LaTeX, dan Bahasa Indonesia", () => {
    const history = [{ role: "assistant" as const, content: "Silakan tanya!" }];
    const { instructions, messages } = buildGeneralStreamPrompt("Guru Matematika", "Guru Matematika — Diskusi rumus", "Halo", history);
    expect(instructions).toContain("Guru Matematika");
    expect(instructions).toContain("Markdown");
    expect(instructions).toContain("LaTeX");
    expect(instructions).toContain("Bahasa Indonesia");
    expect(instructions).not.toContain("||ROM||");
    expect(instructions).not.toContain("||UROM||");
    expect(instructions).not.toContain("||UTRANS||");
    expect(messages).toEqual([
      { role: "assistant", content: "Silakan tanya!" },
      { role: "user", content: "Halo" },
    ]);
  });
});

describe("buildGeneralOpeningPrompt", () => {
  it("menghasilkan pembuka umum dalam Bahasa Indonesia", () => {
    const { instructions, messages } = buildGeneralOpeningPrompt("Guru Matematika", "Guru Matematika — Diskusi rumus");
    expect(instructions).toContain("Guru Matematika");
    expect(instructions).toContain("Bahasa Indonesia");
    expect(messages).toEqual([{ role: "user", content: "Mulai percakapan!" }]);
  });
});

describe("buildSummaryPrompt", () => {
  it("menghasilkan instruksi rekap bahasa dengan format teks biasa", () => {
    const history = [{ role: "assistant" as const, content: "Hi!" }];
    const { instructions, messages } = buildSummaryPrompt("English", "B1", "Restaurant", history);
    expect(instructions).toContain("Rekap Pelajaran");
    expect(instructions).toContain("Bahasa Indonesia");
    expect(instructions).toContain("tanpa markdown");
    expect(instructions).toContain("B1");
    expect(messages).toEqual(history);
  });
});

describe("buildGeneralSummaryPrompt", () => {
  it("menghasilkan instruksi rekap umum dengan markdown", () => {
    const history = [{ role: "assistant" as const, content: "Rumus: $x^2$" }];
    const { instructions, messages } = buildGeneralSummaryPrompt("Guru Matematika", "Guru Matematika - Diskusi rumus", history);
    expect(instructions).toContain("Rekap Pelajaran");
    expect(instructions).toContain("Markdown");
    expect(messages).toEqual(history);
  });
});
