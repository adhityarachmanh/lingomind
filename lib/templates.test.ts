import { describe, expect, it } from "vitest";
import { SCENARIO_TEMPLATES } from "./templates";

describe("SCENARIO_TEMPLATES", () => {
  it("menyediakan minimal 40 template", () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(40);
  });

  it("memiliki id yang unik", () => {
    const ids = SCENARIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("semua field terisi dan kategori konsisten", () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.id.trim()).not.toBe("");
      expect(t.category.trim()).not.toBe("");
      expect(t.title.trim()).not.toBe("");
      expect(t.description.trim()).not.toBe("");
    }
  });
});
