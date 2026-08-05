import { describe, expect, it } from "vitest";
import { mapHistoryToAiMessages } from "./chat-helpers";

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
