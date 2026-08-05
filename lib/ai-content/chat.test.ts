import { describe, expect, it } from "vitest";
import { buildPolyglotOpeningPrompt, buildPolyglotStreamPrompt, buildPolyglotSystemPrompt, buildPolyglotUserMessage } from "./chat";

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
});
