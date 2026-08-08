import { describe, expect, it } from "vitest";
import { normalizeVocabWord } from "./vocab";

describe("normalizeVocabWord", () => {
  it("trim spasi di kedua sisi", () => {
    expect(normalizeVocabWord("  cat  ")).toBe("cat");
  });

  it("lowercase huruf besar", () => {
    expect(normalizeVocabWord("Cat")).toBe("cat");
    expect(normalizeVocabWord("CAT")).toBe("cat");
  });

  it("tidak merusak aksara non-Latin", () => {
    expect(normalizeVocabWord("猫")).toBe("猫");
    expect(normalizeVocabWord("안녕")).toBe("안녕");
  });

  it("string kosong / spasi saja tetap kosong", () => {
    expect(normalizeVocabWord("")).toBe("");
    expect(normalizeVocabWord("   ")).toBe("");
  });
});
