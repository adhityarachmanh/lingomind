import { describe, expect, it } from "vitest";
import { buildPolyglotOpeningPrompt, buildPolyglotSystemPrompt } from "./chat";

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

describe("buildPolyglotOpeningPrompt", () => {
  it("menghasilkan system prompt pembuka yang memuat skenario dan suggested_replies", () => {
    const { messages } = buildPolyglotOpeningPrompt("English", "A1", "Restaurant");
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Restaurant");
    expect(messages[0].content).toContain("suggested_replies");
  });
});
