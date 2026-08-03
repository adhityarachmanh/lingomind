import { describe, expect, it } from "vitest";
import { buildContentWorkList, detectQuizDuplicates, hasDuplicateLesson, hasDuplicateQuiz, isQuizVariantClean } from "./admin";

describe("buildContentWorkList", () => {
  it("menyusun 3 lesson per goal (modifier normal) lalu 1 quiz per goal", () => {
    const units = buildContentWorkList(["Sapaan", "Keluarga"], { parts: 3, lessonModifiers: ["normal"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units).toHaveLength(2 * 3 + 2 * 1 + 1 + 1);
    expect(units[0]).toEqual({ kind: "lesson", goal: "Sapaan", part: 1, modifier: "normal" });
    expect(units[1]).toEqual({ kind: "lesson", goal: "Sapaan", part: 2, modifier: "normal" });
    expect(units[3]).toEqual({ kind: "quiz", goal: "Sapaan", part: 0, modifier: "normal" });
  });

  it("mengulang lesson untuk tiap modifier (default hanya normal)", () => {
    const units = buildContentWorkList(["Sapaan"], { parts: 3, lessonModifiers: ["normal", "hard"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units.filter((u) => u.kind === "lesson").map((u) => u.modifier)).toEqual(["normal", "normal", "normal", "hard", "hard", "hard"]);
  });

  it("menambahkan exam (1) dan general_practice (1) di akhir", () => {
    const units = buildContentWorkList([], { parts: 3, lessonModifiers: ["normal"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units.filter((u) => u.goal === "exam")).toHaveLength(1);
    expect(units.filter((u) => u.goal === "general_practice")).toHaveLength(1);
    expect(units[units.length - 1]).toEqual({ kind: "quiz", goal: "general_practice", part: 0, modifier: "normal" });
  });

  it("tanpa topik & varian 0 hanya menyisakan exam (fixed 1)", () => {
    expect(buildContentWorkList([], { parts: 3, lessonModifiers: ["normal"], quizVariants: 0, generalPracticeVariants: 0 })).toHaveLength(1);
  });
});

describe("hasDuplicateQuiz", () => {
  it("mendeteksi duplikat saat ADA minimal 1 pertanyaan identik (case & HTML-insensitive)", () => {
    expect(
      hasDuplicateQuiz([{ question: "What <b>is</b> your name?" }], [{ question: "what is your name?  " }])
    ).toBe(true);
    expect(
      hasDuplicateQuiz(
        [{ question: "A" }, { question: "B" }],
        [{ question: "A" }, { question: "X" }, { question: "Y" }]
      )
    ).toBe(true);
    expect(
      hasDuplicateQuiz(
        [{ question: "A" }, { question: "B" }],
        [{ question: "C" }, { question: "X" }, { question: "Y" }]
      )
    ).toBe(false);
    expect(hasDuplicateQuiz([], [{ question: "A" }])).toBe(false);
  });

  it("soal listening dibedakan oleh listen_text (instruksi yang sama bukan duplikat)", () => {
    expect(
      hasDuplicateQuiz(
        [{ question: "Dengarkan lalu jawab", listenText: "Hello, how are you today?" }],
        [{ question: "Dengarkan lalu jawab", listenText: "What time does the train leave?" }]
      )
    ).toBe(false);
    expect(
      hasDuplicateQuiz(
        [{ question: "Dengarkan lalu jawab", listenText: "Hello, how are you today?" }],
        [{ question: "Dengarkan lalu jawab", listenText: "Hello, how are you today?" }]
      )
    ).toBe(true);
  });
});

describe("hasDuplicateLesson", () => {
  it("duplikat jika judul sama persis (normalisasi) atau konten overlap >= 60%", () => {
    expect(hasDuplicateLesson(["Kata Sapaan"], ["Halo ini konten panjang"], "kata  sapaan", "Konten baru berbeda")).toBe(true);
    expect(hasDuplicateLesson([], ["ini kalimat pertama materi dan lanjutan"], "Judul Baru", "ini kalimat pertama materi dan lanjutan lainnya")).toBe(true);
    expect(hasDuplicateLesson(["Judul A"], ["konten satu"], "Judul B", "konten dua yang sangat berbeda sekali")).toBe(false);
    expect(hasDuplicateLesson(["A"], ["x"], "B", "")).toBe(false);
  });
});

describe("detectQuizDuplicates", () => {
  const rows = (id: number, qs: { question: string; listenText?: string }[]) => ({ id, questions: qs });

  it("mendeteksi varian dengan soal IDENTIK (keep yang pertama)", () => {
    const flags = detectQuizDuplicates([
      {
        key: "A1|Sapaan",
        rows: [
          rows(1, [{ question: "What is your name?" }]),
          rows(2, [{ question: "what  is your name?  " }]),
        ],
      },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ rowId: 2, reason: "identical", similarity: 1, collidedWithRowId: 1 });
  });

  it("mendeteksi parafrase mirip (Jaccard >= 0.7) — kasus instruksi sama, audio beda sedikit", () => {
    const flags = detectQuizDuplicates([
      {
        key: "A1|Sapaan",
        rows: [
          rows(1, [{ question: "Listen and choose the best reply.", listenText: "How are you?" }]),
          rows(2, [{ question: "Listen and choose the best reply.", listenText: "Good morning! How are you?" }]),
        ],
      },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0].rowId).toBe(2);
    expect(flags[0].reason).toBe("near");
    expect(flags[0].similarity).toBeGreaterThanOrEqual(0.7);
  });

  it("TIDAK menandai parafrase ringan di bawah threshold", () => {
    const flags = detectQuizDuplicates([
      {
        key: "A1|Sapaan",
        rows: [
          rows(1, [{ question: "apple banana cherry" }]),
          rows(2, [{ question: "apple banana cherry durian mango orange" }]),
        ],
      },
    ]);
    expect(flags).toHaveLength(0);
  });

  it("TIDAK mencampur antar grup (level/goal berbeda)", () => {
    const flags = detectQuizDuplicates([
      { key: "A1|Sapaan", rows: [rows(1, [{ question: "A" }])] },
      { key: "A2|Sapaan", rows: [rows(2, [{ question: "A" }])] },
    ]);
    expect(flags).toHaveLength(0);
  });

  it("varian pertama tiap grup tidak pernah di-flag; varian ke-3 duplikat di-flag terhadap sumber aslinya", () => {
    const flags = detectQuizDuplicates([
      {
        key: "A1|Sapaan",
        rows: [
          rows(1, [{ question: "A" }, { question: "B" }]),
          rows(2, [{ question: "C" }]),
          rows(3, [{ question: "B" }]),
          rows(4, [{ question: "D" }]),
        ],
      },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ rowId: 3, collidedWithRowId: 1 });
  });

  it("audio yang berbeda membuat dua soal tidak identik dan tidak mirip cukup", () => {
    const flags = detectQuizDuplicates([
      {
        key: "A1|Sapaan",
        rows: [
          rows(1, [{ question: "Dengarkan lalu jawab", listenText: "Hello, how are you today?" }]),
          rows(2, [{ question: "Dengarkan lalu jawab", listenText: "What time does the train leave tomorrow morning?" }]),
        ],
      },
    ]);
    expect(flags).toHaveLength(0);
  });
});

describe("isQuizVariantClean", () => {
  const rows = (id: number, qs: { question: string; listenText?: string }[]) => ({ id, questions: qs });

  it("bersih saat tidak ada soal yang identik atau mirip dengan varian lain", () => {
    const group = [rows(1, [{ question: "What is your name?" }])];
    expect(isQuizVariantClean(group, rows(2, [{ question: "Where do you live?" }]))).toBe(true);
  });

  it("TIDAK bersih saat ada soal identik dengan varian lain", () => {
    const group = [rows(1, [{ question: "What is your name?" }])];
    expect(isQuizVariantClean(group, rows(2, [{ question: "what  is your name? " }]))).toBe(false);
  });

  it("TIDAK bersih saat ada soal mirip (Jaccard >= 0.7)", () => {
    const group = [rows(1, [{ question: "Listen and choose the best reply.", listenText: "How are you?" }])];
    expect(isQuizVariantClean(group, rows(2, [{ question: "Listen and choose the best reply.", listenText: "Good morning! How are you?" }]))).toBe(false);
  });

  it("bersih saat kemiripan di bawah threshold", () => {
    const group = [rows(1, [{ question: "apple banana cherry" }])];
    expect(isQuizVariantClean(group, rows(2, [{ question: "apple banana cherry durian mango orange" }]))).toBe(true);
  });
});
