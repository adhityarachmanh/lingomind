import { describe, expect, it } from "vitest";
import { buildReminderBody } from "./reminder";

describe("buildReminderBody", () => {
  it("streak > 0 + due > 0", () => {
    const body = buildReminderBody({ fullName: "Andi", currentStreak: 5, dueFlashcards: 3, appUrl: "https://app.com" });
    expect(body).toContain("Hai Andi,");
    expect(body).toContain("Hebat! Pertahankan streak 5 harimu!");
    expect(body).toContain("Ada 3 kosakata yang hampir terlupakan");
    expect(body).toContain("https://app.com");
    expect(body).toContain("Salam hangat,\nLingoMind Team");
  });
  it("streak 0 + due 0", () => {
    const body = buildReminderBody({ fullName: "Budi", currentStreak: 0, dueFlashcards: 0, appUrl: "https://app.com" });
    expect(body).toContain("Mari mulai belajar hari ini dan bangun streak-mu");
    expect(body).not.toContain("Smart Reminder");
  });
  it("streak > 0 + due 0 (tanpa kalimat flashcard)", () => {
    const body = buildReminderBody({ fullName: "Cici", currentStreak: 10, dueFlashcards: 0, appUrl: "x" });
    expect(body).toContain("streak 10 harimu");
    expect(body).not.toContain("Smart Reminder");
  });
});
