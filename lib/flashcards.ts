import { db } from "./db";
import { incrementMissionProgress } from "./mission";
import type { FlashcardItem, NewFlashcard } from "./types";

export function sm2Next(
  easeFactor: number,
  intervalDays: number,
  repetition: number,
  quality: number
): { easeFactor: number; intervalDays: number; repetition: number } {
  let ef = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  if (quality < 3) return { easeFactor: ef, intervalDays: 1, repetition: 0 };
  const newRepetition = repetition + 1;
  const newInterval =
    newRepetition === 1 ? 1 : newRepetition === 2 ? 3 : Math.round(intervalDays * ef);
  return { easeFactor: ef, intervalDays: Math.max(1, newInterval), repetition: newRepetition };
}

function toItem(f: {
  id: number; email: string; language: string; frontText: string; backText: string;
  easeFactor: number; intervalDays: number; repetition: number;
}): FlashcardItem {
  return {
    id: f.id, email: f.email, language: f.language, front_text: f.frontText,
    back_text: f.backText, ease_factor: f.easeFactor, interval_days: f.intervalDays, repetition: f.repetition,
  };
}

export async function addFlashcards(email: string, cards: NewFlashcard[]): Promise<void> {
  const valid = cards.filter((c) => c.front_text.trim() && c.back_text.trim());
  if (valid.length === 0) return;
  await db.flashcard.createMany({
    data: valid.map((c) => ({
      email,
      language: c.language,
      frontText: c.front_text,
      backText: c.back_text,
    })),
    skipDuplicates: true,
  });
}

export async function getDueFlashcards(email: string, language: string, limit: number): Promise<FlashcardItem[]> {
  const safeLimit = limit <= 0 ? 10 : Math.min(limit, 50);
  const rows = await db.flashcard.findMany({
    where: { email, language, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: safeLimit,
  });
  return rows.map(toItem);
}

export async function getDueFlashcardCount(email: string, language: string): Promise<number> {
  return db.flashcard.count({ where: { email, language, dueAt: { lte: new Date() } } });
}

export async function reviewFlashcard(id: number, quality: number, email: string): Promise<void> {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error("Quality review harus 0..5.");
  }
  const card = await db.flashcard.findFirst({ where: { id, email } });
  if (!card) throw new Error("Flashcard tidak ditemukan.");

  const next = sm2Next(card.easeFactor, card.intervalDays, card.repetition, quality);
  const now = new Date();
  const dueAt = new Date(now.getTime() + next.intervalDays * 24 * 60 * 60 * 1000);

  await db.flashcard.update({
    where: { id },
    data: { easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetition: next.repetition, dueAt, lastReviewedAt: now },
  });
  await incrementMissionProgress(card.email, "flashcard");
}
