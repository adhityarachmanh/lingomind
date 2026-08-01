import { describe, expect, it } from "vitest";
import { buildExamPrompt, nextCefrLevel } from "./exam";

describe("nextCefrLevel", () => {
  it("naik satu tingkat", () => {
    expect(nextCefrLevel("A1")).toBe("A2");
    expect(nextCefrLevel("B1")).toBe("B2");
    expect(nextCefrLevel("C1")).toBe("C2");
  });
  it("cap di C2", () => {
    expect(nextCefrLevel("C2")).toBe("C2");
    expect(nextCefrLevel("unknown")).toBe("C2");
  });
});

describe("buildExamPrompt", () => {
  it("memuat level, target, dan topik", () => {
    const p = buildExamPrompt("English", "A1", "A2", "Greetings, Numbers");
    expect(p).toContain("8 soal ujian sertifikasi");
    expect(p).toContain("dari level CEFR A1 menuju A2");
    expect(p).toContain("ke-4 topik ini: Greetings, Numbers");
  });
  it("minimal 2 reading + 2 listening + explanation 3 kalimat", () => {
    const p = buildExamPrompt("English", "A1", "A2", "X");
    expect(p).toContain("Minimal 2 soal harus berupa 'reading comprehension'");
    expect(p).toContain("Minimal 2 soal harus bertipe listening");
    expect(p).toContain("minimal 3 kalimat");
  });
});
