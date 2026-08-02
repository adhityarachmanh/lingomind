import { describe, expect, it } from "vitest";
import { buildContentWorkList } from "./admin";

describe("buildContentWorkList", () => {
  it("menyusun unit lesson per (goal, part, modifier) lalu quiz per goal (1 varian)", () => {
    const units = buildContentWorkList(["Sapaan", "Keluarga"], { parts: 3, lessonModifiers: ["normal"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units).toHaveLength(2 * (3 * 1) + 2 * 1 + 1 + 1);
    expect(units[0]).toEqual({ kind: "lesson", goal: "Sapaan", part: 1, modifier: "normal" });
    expect(units[1]).toEqual({ kind: "lesson", goal: "Sapaan", part: 2, modifier: "normal" });
    expect(units[3]).toEqual({ kind: "quiz", goal: "Sapaan", part: 0, modifier: "normal" });
  });

  it("mengulang lesson untuk tiap modifier", () => {
    const units = buildContentWorkList(["Sapaan"], { parts: 1, lessonModifiers: ["normal", "hard", "easy"], quizVariants: 1, generalPracticeVariants: 1 });
    expect(units.filter((u) => u.kind === "lesson").map((u) => u.modifier)).toEqual(["normal", "hard", "easy"]);
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
