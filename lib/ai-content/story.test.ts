import { describe, expect, it } from "vitest";
import { buildStoryPrompt, parseStoryData } from "./story";

describe("buildStoryPrompt", () => {
  it("memuat bahasa, level, goal, 4 segmen", () => {
    const p = buildStoryPrompt("English", "A1", "Greetings");
    expect(p).toContain("Interactive Story");
    expect(p).toContain("level CEFR A1");
    expect(p).toContain("'Greetings'");
    expect(p).toContain("persis 4 segmen");
  });
});

describe("parseStoryData", () => {
  const valid = {
    title: "The Coffee",
    title_translation: "Kopi",
    segments: [
      {
        text: "Once upon a time...",
        speaker: null,
        translation: "Pada suatu hari...",
        question: {
          question_text: "Apa yang terjadi?",
          options: ["A", "B", "C", "D"],
          correct_answer: "B",
          explanation: "Karena ...",
        },
      },
      { text: "The end.", speaker: "Narrator", translation: "Tamat.", question: null },
    ],
  };
  it("valid → StoryData", () => {
    const d = parseStoryData(JSON.stringify(valid));
    expect(d).not.toBeNull();
    expect(d?.segments).toHaveLength(2);
    expect(d?.segments[1].speaker).toBe("Narrator");
  });
  it("invalid JSON → null", () => {
    expect(parseStoryData("bukan json")).toBeNull();
  });
  it("segmen tanpa text → null", () => {
    expect(parseStoryData(JSON.stringify({ ...valid, segments: [{ text: "", speaker: null, translation: "x", question: null }] }))).toBeNull();
  });
  it("question dengan correct_answer tidak di opsi → null", () => {
    const bad = { ...valid, segments: [{ ...valid.segments[0], question: { ...valid.segments[0].question, correct_answer: "Z" } }] };
    expect(parseStoryData(JSON.stringify(bad))).toBeNull();
  });
});
