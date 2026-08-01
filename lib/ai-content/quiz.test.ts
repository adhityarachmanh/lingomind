import { describe, expect, it } from "vitest";
import { buildGeneralPracticePrompt, buildWeaknessContext, buildWeaknessPrompt, normalizeQuiz, qualityIssues, shuffleOptions, validateQuizShape } from "./quiz";
import type { QuizQuestion } from "../types";

function q(over: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    question: "What is the capital of France?",
    question_type: "text",
    listen_text: "",
    options: ["Paris", "London", "Rome", "Berlin"],
    correct_answer: "Paris",
    explanation: "Ibukota Prancis adalah Paris. Ini pengetahuan dasar.",
    ...over,
  };
}

describe("normalizeQuiz", () => {
  it("strip prefix opsi A) B. C: D)", () => {
    const c = normalizeQuiz({ questions: [q({ options: ["A) Paris", "B) London", "C) Rome", "D) Berlin"] })] });
    expect(c.questions[0].options[0]).toBe("Paris");
  });
  it("lowercase question_type", () => {
    const c = normalizeQuiz({ questions: [q({ question_type: "LISTENING", listen_text: "audio" })] });
    expect(c.questions[0].question_type).toBe("listening");
  });
  it("correct_answer yang sudah strip tetap cocok", () => {
    const c = normalizeQuiz({ questions: [q({ options: ["A) Paris", "London", "Rome", "Berlin"], correct_answer: "A) Paris" })] });
    expect(c.questions[0].correct_answer).toBe("Paris");
  });
  it("question text di-collapse whitespace", () => {
    const c = normalizeQuiz({ questions: [q({ question: "Halo   dunia\n  apa kabar?" })] });
    expect(c.questions[0].question).toBe("Halo dunia apa kabar?");
  });
});

describe("validateQuizShape", () => {
  it("valid → []", () => {
    expect(validateQuizShape([q(), q(), q(), q(), q()], 5)).toEqual([]);
  });
  it("jumlah salah → error", () => {
    const errs = validateQuizShape([q()], 5);
    expect(errs[0]).toContain("Format quiz tidak valid: wajib 5 pertanyaan.");
  });
  it("opsi tidak 4 → error", () => {
    const errs = validateQuizShape([q({ options: ["a", "b"] })], 1);
    expect(errs.some((e) => e.includes("4 opsi"))).toBe(true);
  });
  it("correct_answer tidak cocok → error", () => {
    const errs = validateQuizShape([q({ correct_answer: "Tidak Ada" })], 1);
    expect(errs.some((e) => e.includes("kunci jawaban"))).toBe(true);
  });
  it("listening tanpa listen_text cukup → error", () => {
    const errs = validateQuizShape([q({ question_type: "listening", listen_text: "abc" })], 1);
    expect(errs.some((e) => e.includes("listen_text"))).toBe(true);
  });
});

describe("qualityIssues", () => {
  it("soal duplikat → issue", () => {
    const issues = qualityIssues([q(), q(), q(), q(), q({ question: "What is the capital of France?" })], 5);
    expect(issues.some((i) => i.includes("terduplikasi"))).toBe(true);
  });
  it("soal terlalu pendek → issue", () => {
    const issues = qualityIssues([q({ question: "Hai?" })], 1);
    expect(issues.some((i) => i.includes("terlalu pendek"))).toBe(true);
  });
  it("kurang dari 2 listening → issue", () => {
    const issues = qualityIssues([q(), q(), q(), q(), q()], 5);
    expect(issues.some((i) => i.includes("listening"))).toBe(true);
  });
  it("pola ambigu → issue", () => {
    const issues = qualityIssues([q({ options: ["Paris", "London", "Rome", "Semua jawaban benar"] })], 1);
    expect(issues.some((i) => i.includes("ambigu"))).toBe(true);
  });
  it("listening cukup & variasi skill → bersih", () => {
    const list = q({ question_type: "listening", listen_text: "Dengarkan audio ini dan jawab", question: "Apa yang didengar?" });
    const list2 = q({ question_type: "listening", listen_text: "Dengarkan audio ini dan jawab", question: "Apa yang diucapkan orang itu?" });
    const vocab = q({ question: "Sinonim dari kata 'happy' adalah?", correct_answer: "Joyful" });
    const g2 = q({ question: "Pilih kata tanya yang tepat untuk menanyakan tempat:", correct_answer: "London" });
    const issues = qualityIssues([list, list2, vocab, q(), g2], 5);
    expect(issues).toEqual([]);
  });
});

describe("shuffleOptions", () => {
  it("opsi tetap 4 dan berisi jawaban benar", () => {
    const c = shuffleOptions({ questions: [q()] });
    expect(c.questions[0].options).toHaveLength(4);
    expect(c.questions[0].options).toContain("Paris");
  });
  it("setiap elemen tetap ada (permutasi)", () => {
    const original = ["Paris", "London", "Rome", "Berlin"];
    const c = shuffleOptions({ questions: [q()] });
    expect([...c.questions[0].options].sort()).toEqual([...original].sort());
  });
});

describe("buildGeneralPracticePrompt", () => {
  it("memuat target bahasa dan level", () => {
    const p = buildGeneralPracticePrompt("English", "A2");
    expect(p).toContain("TARGET BAHASA SOAL: English");
    expect(p).toContain("level CEFR A2");
  });
  it("melarang trivia", () => {
    expect(buildGeneralPracticePrompt("English", "A1")).toContain("DILARANG KERAS membuat soal pengetahuan umum");
  });
});

describe("buildWeaknessPrompt", () => {
  it("memuat topik dan konteks", () => {
    const p = buildWeaknessPrompt("English", "A1", "Grammar: Tense", "- Past tense keliru");
    expect(p).toContain("Topik kelemahan utama: Grammar: Tense");
    expect(p).toContain("Past tense keliru");
  });
  it("3 soal, minimal 1 listening", () => {
    const p = buildWeaknessPrompt("English", "A1", "X", "");
    expect(p).toContain("3 soal latihan weakness-focused");
    expect(p).toContain("Minimal 1 soal harus bertipe listening");
  });
});

describe("buildWeaknessContext", () => {
  it("truncate 140 char", () => {
    const long = "x".repeat(200);
    const out = buildWeaknessContext([long]);
    expect(out.length).toBeLessThanOrEqual(150); // "- " + 140 + possible
    expect(out).toBe("- " + "x".repeat(140));
  });
  it("skip kosong + join newline", () => {
    expect(buildWeaknessContext(["  a  b ", "", "c"])).toBe("- a b\n- c");
  });
  it("semua kosong → string kosong", () => {
    expect(buildWeaknessContext(["", "  "])).toBe("");
  });
});
