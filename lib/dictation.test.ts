import { describe, expect, it } from "vitest";
import { isDictationCorrect, normalizeDictation } from "./dictation";

describe("normalizeDictation", () => {
  it("lowercase + buang tanda baca + rapikan spasi", () => {
    expect(normalizeDictation("  Hello, World!  ")).toBe("hello world");
    expect(normalizeDictation("What's your name?")).toBe("whats your name");
    expect(normalizeDictation("I'm fine, thank you.")).toBe("im fine thank you");
  });

  it("tetap mempertahankan huruf non-latin (mis. bahasa Indonesia/aksara lain)", () => {
    expect(normalizeDictation("Apa kabar?")).toBe("apa kabar");
    expect(normalizeDictation("どうも、ありがとう！")).toBe("どうも ありがとう");
  });
});

describe("isDictationCorrect", () => {
  it("benar walau beda kapital/tanda baca/spasi", () => {
    expect(isDictationCorrect("hello world", "Hello, World!")).toBe(true);
    expect(isDictationCorrect("Im fine", "I'm fine.")).toBe(true);
  });
  it("salah bila kata beda", () => {
    expect(isDictationCorrect("helo world", "Hello, World!")).toBe(false);
    expect(isDictationCorrect("", "Hello")).toBe(false);
  });
});
