import { describe, expect, it } from "vitest";
import { parseVocabList } from "./vocab";

describe("parseVocabList", () => {
  it("parsing array JSON valid → item di-trim", () => {
    const items = parseVocabList('[{"word": " apartment ", "meaning": " apartemen "}, {"word": "rent", "meaning": "menyewa"}]');
    expect(items).toEqual([
      { word: "apartment", meaning: "apartemen" },
      { word: "rent", meaning: "menyewa" },
    ]);
  });

  it("maksimal 3 item", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ word: `kata${i}`, meaning: `arti${i}` }));
    expect(parseVocabList(JSON.stringify(many))).toHaveLength(3);
  });

  it("bukan JSON / salah bentuk → kosong", () => {
    expect(parseVocabList("bukan json")).toHaveLength(0);
    expect(parseVocabList('{"word":"x"}')).toHaveLength(0);
  });

  it("filter item tanpa word/meaning dan dedupe case-insensitive", () => {
    const items = parseVocabList(
      JSON.stringify([
        { word: "", meaning: "a" },
        { word: "Apple", meaning: "apel" },
        { word: "apple", meaning: "apel" },
        { word: "Banana", meaning: "" },
      ])
    );
    expect(items).toEqual([{ word: "Apple", meaning: "apel" }]);
  });

  it("filter word/meaning terlalu panjang", () => {
    expect(parseVocabList(JSON.stringify([{ word: "x".repeat(60), meaning: "a" }]))).toHaveLength(0);
    expect(parseVocabList(JSON.stringify([{ word: "ok", meaning: "y".repeat(250) }]))).toHaveLength(0);
  });
});
