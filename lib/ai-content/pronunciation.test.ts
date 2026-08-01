import { describe, expect, it } from "vitest";
import { buildEvaluationPrompt, buildSentencePrompt, parseEvaluation, parseSentenceArray } from "./pronunciation";

describe("buildSentencePrompt", () => {
  it("memuat bahasa dan level", () => {
    const p = buildSentencePrompt("English", "A1");
    expect(p).toContain("5 kalimat");
    expect(p).toContain("level CEFR A1");
    expect(p).toContain("4 hingga 12 kata");
  });
});

describe("parseSentenceArray", () => {
  it("array string valid", () => {
    expect(parseSentenceArray('["Hello world","How are you"]')).toEqual(["Hello world", "How are you"]);
  });
  it("item kosong → null", () => {
    expect(parseSentenceArray('["ok",""]')).toBeNull();
  });
  it("bukan array → null", () => {
    expect(parseSentenceArray('{"a":1}')).toBeNull();
  });
});

describe("buildEvaluationPrompt", () => {
  it("memuat target dan transcript", () => {
    const p = buildEvaluationPrompt("English", "Good morning", "Good mornin");
    expect(p).toContain("'Good morning'");
    expect(p).toContain("'Good mornin'");
    expect(p).toContain("skor 0-100");
  });
});

describe("parseEvaluation", () => {
  it("valid", () => {
    const ev = parseEvaluation(JSON.stringify({
      score: 80, feedback: "Bagus!", word_results: [{ word: "Good", status: "correct" }, { word: "morning", status: "incorrect" }],
    }));
    expect(ev?.score).toBe(80);
    expect(ev?.word_results[1].status).toBe("incorrect");
  });
  it("score di luar 0-100 → null", () => {
    expect(parseEvaluation(JSON.stringify({ score: 150, feedback: "x", word_results: [] }))).toBeNull();
  });
  it("status tidak dikenal → null", () => {
    expect(parseEvaluation(JSON.stringify({ score: 50, feedback: "x", word_results: [{ word: "a", status: "unknown" }] }))).toBeNull();
  });
});
