import { describe, expect, it } from "vitest";
import { buildContentWorkList } from "./admin";

describe("buildContentWorkList", () => {
  it("menyusun unit lesson per (goal, part, modifier) lalu quiz per goal", () => {
    const units = buildContentWorkList(["Sapaan", "Keluarga"], { parts: 3, lessonModifiers: ["normal"], quizVariants: 5 });
    expect(units).toHaveLength(2 * (3 * 1) + 2 * 5 + 5);
    expect(units[0]).toEqual({ kind: "lesson", goal: "Sapaan", part: 1, modifier: "normal" });
    expect(units[1]).toEqual({ kind: "lesson", goal: "Sapaan", part: 2, modifier: "normal" });
    expect(units[6]).toEqual({ kind: "quiz", goal: "Sapaan", part: 0, modifier: "normal" });
  });

  it("mengulang lesson untuk tiap modifier", () => {
    const units = buildContentWorkList(["Sapaan"], { parts: 1, lessonModifiers: ["normal", "hard", "easy"], quizVariants: 1 });
    expect(units.filter((u) => u.kind === "lesson").map((u) => u.modifier)).toEqual(["normal", "hard", "easy"]);
  });

  it("menambahkan exam per varian di akhir (general_practice TIDAK di pre-gen)", () => {
    const units = buildContentWorkList([], { parts: 3, lessonModifiers: ["normal"], quizVariants: 5 });
    expect(units.filter((u) => u.goal === "exam")).toHaveLength(5);
    expect(units.filter((u) => u.goal === "general_practice")).toHaveLength(0);
    expect(units[units.length - 1]).toEqual({ kind: "quiz", goal: "exam", part: 0, modifier: "normal" });
  });

  it("menghasilkan daftar kosong saat tidak ada topik dan varian 0", () => {
    expect(buildContentWorkList([], { parts: 3, lessonModifiers: ["normal"], quizVariants: 0 })).toHaveLength(0);
  });
});
