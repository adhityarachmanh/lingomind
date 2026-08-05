import { describe, expect, it } from "vitest";
import { isTemplateUsed, SCENARIO_TEMPLATES } from "./templates";

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

describe("isTemplateUsed", () => {
  const used = [
    { templateId: "restaurant-order", language: "English" },
    { templateId: null, language: "English" },
  ];

  it("true saat templateId dan bahasa sama", () => {
    expect(isTemplateUsed(used, "restaurant-order", "English")).toBe(true);
  });

  it("false saat templateId sama tapi bahasa berbeda", () => {
    expect(isTemplateUsed(used, "restaurant-order", "Japanese")).toBe(false);
  });

  it("false saat bahasa sama tapi templateId berbeda", () => {
    expect(isTemplateUsed(used, "hotel-checkin", "English")).toBe(false);
  });

  it("membandingkan templateId null dengan benar", () => {
    expect(isTemplateUsed(used, null, "English")).toBe(true);
  });
});

describe("type skenario", () => {
  it("semua template memiliki type yang valid", () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(["language", "general"]).toContain(t.type);
    }
  });

  it("menyediakan minimal 7 template umum", () => {
    const general = SCENARIO_TEMPLATES.filter((t) => t.type === "general");
    expect(general.length).toBeGreaterThanOrEqual(7);
    for (const t of general) {
      expect(t.category).toBe("Umum");
    }
  });
});
