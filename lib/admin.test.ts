import { describe, expect, it } from "vitest";
import { buildContentWorkList, hasDuplicateLesson, hasDuplicateQuiz } from "./admin";

describe("buildContentWorkList", () => {
  it("menyusun 5 lesson per goal (modifier normal) lalu 1 quiz per goal", () => {
    const units = buildContentWorkList(["Sapaan", "Keluarga"], { parts: 5, lessonModifiers: ["normal"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units).toHaveLength(2 * 5 + 2 * 1 + 1 + 1);
    expect(units[0]).toEqual({ kind: "lesson", goal: "Sapaan", part: 1, modifier: "normal" });
    expect(units[1]).toEqual({ kind: "lesson", goal: "Sapaan", part: 2, modifier: "normal" });
    expect(units[5]).toEqual({ kind: "quiz", goal: "Sapaan", part: 0, modifier: "normal" });
  });

  it("mengulang lesson untuk tiap modifier (default hanya normal)", () => {
    const units = buildContentWorkList(["Sapaan"], { parts: 5, lessonModifiers: ["normal", "hard"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units.filter((u) => u.kind === "lesson").map((u) => u.modifier)).toEqual(["normal", "normal", "normal", "normal", "normal", "hard", "hard", "hard", "hard", "hard"]);
  });

  it("menambahkan exam (1) dan general_practice (1) di akhir", () => {
    const units = buildContentWorkList([], { parts: 5, lessonModifiers: ["normal"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units.filter((u) => u.goal === "exam")).toHaveLength(1);
    expect(units.filter((u) => u.goal === "general_practice")).toHaveLength(1);
    expect(units[units.length - 1]).toEqual({ kind: "quiz", goal: "general_practice", part: 0, modifier: "normal" });
  });

  it("tanpa topik & varian 0 hanya menyisakan exam (fixed 1)", () => {
    expect(buildContentWorkList([], { parts: 5, lessonModifiers: ["normal"], quizVariants: 0, generalPracticeVariants: 0 })).toHaveLength(1);
  });
});

describe("hasDuplicateQuiz", () => {
  it("mendeteksi duplikat saat >= 50% pertanyaan sama (case & HTML-insensitive)", () => {
    expect(hasDuplicateQuiz(["What <b>is</b> your name?"], ["what is your name?  "])).toBe(true);
    expect(hasDuplicateQuiz(["A", "B", "C", "D"], ["A", "X", "Y", "Z"])).toBe(false);
    expect(hasDuplicateQuiz(["A", "B", "C"], ["A", "B", "X"])).toBe(true);
    expect(hasDuplicateQuiz([], ["A", "B"])).toBe(false);
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
