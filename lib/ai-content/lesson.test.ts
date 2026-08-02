import { describe, expect, it } from "vitest";
import { mergeLessonParts } from "./lesson";

const contentJson = JSON.stringify({ title: "Kata Sapa", content: "x".repeat(700) });
const vocabJson = JSON.stringify({
  vocabulary: Array.from({ length: 8 }, (_, i) => ({ word: `kata${i}`, meaning: `arti${i}` })),
});
const sentencesJson = JSON.stringify({
  example_sentences: Array.from({ length: 8 }, (_, i) => ({ target: `kalimat${i}`, meaning: `terjemahan${i}` })),
});

describe("mergeLessonParts", () => {
  it("menggabungkan 3 bagian JSON valid menjadi LessonContainer", () => {
    const merged = mergeLessonParts(contentJson, vocabJson, sentencesJson);
    expect(merged).not.toBeNull();
    expect(merged?.title).toBe("Kata Sapa");
    expect(merged?.content.length).toBeGreaterThanOrEqual(700);
    expect(merged?.vocabulary).toHaveLength(8);
    expect(merged?.vocabulary[0]).toEqual({ word: "kata0", meaning: "arti0" });
    expect(merged?.example_sentences).toHaveLength(8);
    expect(merged?.example_sentences[0]).toEqual({ target: "kalimat0", meaning: "terjemahan0" });
  });

  it("mengembalikan null jika ada bagian yang tidak memenuhi syarat", () => {
    expect(mergeLessonParts(JSON.stringify({ title: "x", content: "pendek" }), vocabJson, sentencesJson)).toBeNull();
    expect(mergeLessonParts(contentJson, JSON.stringify({ vocabulary: [{ word: "a", meaning: "b" }] }), sentencesJson)).toBeNull();
    expect(mergeLessonParts(contentJson, vocabJson, JSON.stringify({ example_sentences: [] }))).toBeNull();
    expect(mergeLessonParts("bukan json", vocabJson, sentencesJson)).toBeNull();
  });
});
