import { describe, expect, it } from "vitest";
import { buildTranslationQuestions } from "./translation";

const story = (id: number, texts: string[], translations: string[]) => ({
  title: `Cerita ${id}`,
  title_translation: `Story ${id}`,
  segments: texts.map((text, i) => ({
    text,
    speaker: null,
    translation: translations[i] ?? `arti ${text}`,
    question: null,
  })),
});

describe("buildTranslationQuestions", () => {
  it("tiap pertanyaan: kalimat + 4 opsi berbeda + terjemahan benar ada di opsi", () => {
    const stories = [
      story(1, ["Hello", "Good morning", "Thank you", "Goodbye"], ["Halo", "Selamat pagi", "Terima kasih", "Selamat tinggal"]),
    ];
    const questions = buildTranslationQuestions(stories, 4);
    expect(questions.length).toBe(4);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.correct);
      expect(q.options).not.toContain(q.sentence);
    }
    const corrects = questions.map((q) => q.correct).sort();
    expect(corrects).toEqual(["Halo", "Selamat pagi", "Selamat tinggal", "Terima kasih"].sort());
  });

  it("pembatas jumlah pertanyaan", () => {
    const stories = [story(1, ["A", "B", "C", "D", "E", "F"], ["a", "b", "c", "d", "e", "f"])];
    expect(buildTranslationQuestions(stories, 3).length).toBe(3);
    expect(buildTranslationQuestions(stories, 100).length).toBe(6);
  });

  it("kosong bila tidak ada segmen", () => {
    expect(buildTranslationQuestions([], 4)).toHaveLength(0);
  });
});
