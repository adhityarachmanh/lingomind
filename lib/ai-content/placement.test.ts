import { describe, expect, it } from "vitest";
import { buildPlacementPrompt, formatPlacementHistory, parseCefrLevel } from "./placement";

describe("parseCefrLevel", () => {
  it("biasa", () => {
    expect(parseCefrLevel("B1")).toBe("B1");
    expect(parseCefrLevel("Level pengguna adalah A2.")).toBe("A2");
  });
  it("default A1 saat tidak ada", () => {
    expect(parseCefrLevel("tidak tahu")).toBe("A1");
  });
  it("C2 terbaca (jangan tertangkap C1 dulu? urutan scan)", () => {
    expect(parseCefrLevel("C2")).toBe("C2");
  });
});

describe("formatPlacementHistory", () => {
  it("format role: pesan per baris", () => {
    const out = formatPlacementHistory([
      { role: "AI", text: "Halo" },
      { role: "User", text: "Hi" },
    ]);
    expect(out).toBe("AI: Halo\nUser: Hi\n");
  });
});

describe("buildPlacementPrompt", () => {
  it("memuat bahasa dan tugas", () => {
    const p = buildPlacementPrompt("English", "AI: Halo\n");
    expect(p).toContain("Evaluasi kemampuan bahasa English pengguna");
    expect(p).toContain("Hanya kembalikan dua karakter");
  });
});
