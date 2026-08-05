import { describe, expect, it } from "vitest";
import { buildPolyglotOpeningPrompt, buildPolyglotSystemPrompt, buildPolyglotUserMessage } from "./chat";

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
});
