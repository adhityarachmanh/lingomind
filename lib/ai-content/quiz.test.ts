import { describe, expect, it, vi } from "vitest";
import { buildGeneralPracticePrompt, buildQuizPrompt, formatExistingQuestions, quizMaxTokens, shuffleQuiz } from "./quiz";
import type { QuizContainer } from "../types";

describe("formatExistingQuestions", () => {
  it("mengembalikan daftar soal yang dilarang ditiru (termasuk audio listening)", () => {
    const out = formatExistingQuestions([
      { question: "What is your name?", listenText: "My name is David." },
      { question: "Choose the greeting." },
    ]);
    expect(out).toContain("What is your name?");
    expect(out).toContain("audio: My name is David.");
    expect(out).toContain("Choose the greeting.");
  });

  it("membatasi jumlah contoh (maks 10, ambil yang terbaru)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ question: `Soal ${i + 1}` }));
    const out = formatExistingQuestions(many);
    expect(out).toMatch(/1\) Soal 3/);
    expect(out).toMatch(/10\) Soal 12/);
    expect(out).not.toMatch(/1\) Soal 1/);
    expect((out.match(/\d+\) /g) ?? []).length).toBe(10);
  });

  it("kosong jika tidak ada soal existing", () => {
    expect(formatExistingQuestions([])).toBe("");
  });
});

describe("buildQuizPrompt anti-duplikat", () => {
  it("menyertakan blok larangan meniru saat ada soal existing", () => {
    const prompt = buildQuizPrompt("English", "A1", "Greetings", "(belum ada riwayat kelemahan)", [
      { question: "Listen and choose the best reply.", listenText: "How are you?" },
    ]);
    expect(prompt).toContain("DILARANG");
    expect(prompt).toContain("Listen and choose the best reply.");
    expect(prompt).toContain("audio: How are you?");
  });

  it("tanpa soal existing tidak ada blok larangan", () => {
    const prompt = buildQuizPrompt("English", "A1", "Greetings", "(belum ada riwayat kelemahan)");
    expect(prompt).not.toContain("DILARANG KERAS membuat soal yang sama");
  });

  it("general practice juga menyertakan blok saat ada existing", () => {
    const prompt = buildGeneralPracticePrompt("English", "A1", "kafe dan restoran", [
      { question: "Pertanyaan lama" },
    ]);
    expect(prompt).toContain("Pertanyaan lama");
    expect(prompt).toContain("DILARANG");
  });
});

describe("quizMaxTokens", () => {
  it("kuis 3 soal pakai 4096, 5+ soal pakai 8192", () => {
    expect(quizMaxTokens(3)).toBe(4096);
    expect(quizMaxTokens(5)).toBe(8192);
  });
  it("override menang saat diberikan", () => {
    expect(quizMaxTokens(5, 12288)).toBe(12288);
  });
});

describe("shuffleQuiz", () => {
  const quiz: QuizContainer = {
    questions: [
      { question: "Q1", question_type: "text", listen_text: "", options: ["A", "B", "C", "D"], correct_answer: "B", explanation: "x" },
      { question: "Q2", question_type: "text", listen_text: "", options: ["1", "2", "3", "4"], correct_answer: "3", explanation: "y" },
    ],
  };

  it("mengacak urutan soal dan opsi (deterministik saat Math.random = 0)", () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const out = shuffleQuiz(quiz);
      expect(out.questions.map((q) => q.question)).toEqual(["Q2", "Q1"]);
      expect(out.questions[0].options).toEqual(["2", "3", "4", "1"]);
      expect(out.questions[1].options).toEqual(["B", "C", "D", "A"]);
      for (const q of out.questions) {
        expect(q.options).toContain(q.correct_answer);
      }
    } finally {
      rnd.mockRestore();
    }
  });

  it("mempertahankan semua soal & opsi dan tidak mengubah input", () => {
    const before = JSON.stringify(quiz);
    const out = shuffleQuiz(quiz);
    expect(JSON.stringify(quiz)).toBe(before);
    expect(out.questions.map((q) => q.question).sort()).toEqual(["Q1", "Q2"]);
    const opts = (q: QuizContainer["questions"][number]) => [...q.options].sort().join(",");
    expect(opts(out.questions.find((q) => q.question === "Q1")!)).toBe("A,B,C,D");
    expect(opts(out.questions.find((q) => q.question === "Q2")!)).toBe("1,2,3,4");
  });
});
