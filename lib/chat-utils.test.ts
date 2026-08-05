import { describe, expect, it } from "vitest";
import { trimPreview } from "./chat-utils";

describe("trimPreview", () => {
  it("memotong teks panjang dan menambahkan elipsis", () => {
    const long = "a".repeat(100);
    expect(trimPreview(long)).toBe("a".repeat(60) + "...");
  });

  it("mengembalikan teks pendek tanpa perubahan", () => {
    expect(trimPreview("Halo!")).toBe("Halo!");
  });

  it("menormalisasi newline dan spasi ganda", () => {
    expect(trimPreview("Hello\n\n  world  ")).toBe("Hello world");
  });

  it("mengembalikan string kosong untuk null/undefined/kosong", () => {
    expect(trimPreview(null)).toBe("");
    expect(trimPreview(undefined)).toBe("");
    expect(trimPreview("   ")).toBe("");
  });

  it("menghormati maxLen kustom", () => {
    expect(trimPreview("abcdef", 3)).toBe("abc...");
  });
});
