import { describe, expect, it } from "vitest";
import { classifySkill, classifyWeaknessTopic } from "./weakness";

describe("classifyWeaknessTopic", () => {
  it("tense/past → Grammar: Tense", () => {
    expect(classifyWeaknessTopic("Kalimat menggunakan past tense yang salah.")).toBe("Grammar: Tense");
  });
  it("preposition → Grammar: Preposition", () => {
    expect(classifyWeaknessTopic("Penggunaan preposition 'in' dan 'on' keliru.")).toBe("Grammar: Preposition");
  });
  it("article → Grammar: Article", () => {
    expect(classifyWeaknessTopic("Artikel 'the' seharusnya dipakai di sini.")).toBe("Grammar: Article");
  });
  it("vocabulary/word choice → Vocabulary: Word Choice", () => {
    expect(classifyWeaknessTopic("Pilihan kata (word choice) kurang tepat.")).toBe("Vocabulary: Word Choice");
  });
  it("fallback → General: Answer Accuracy", () => {
    expect(classifyWeaknessTopic("Penjelasan umum tentang tata bahasa.")).toBe("General: Answer Accuracy");
  });
});

describe("classifySkill", () => {
  it("question_type listening → listening", () => {
    expect(classifySkill("Dengarkan audio", "Penjelasan", "listening")).toBe("listening");
  });
  it("kata kosakata → vocabulary", () => {
    expect(classifySkill("Apa arti kata 'apple'?", "Kosakata baru.", "text")).toBe("vocabulary");
  });
  it("fallback → grammar", () => {
    expect(classifySkill("Pilih kalimat yang benar", "Pola kalimat.", "text")).toBe("grammar");
  });
});
