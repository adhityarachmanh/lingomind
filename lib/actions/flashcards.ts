"use server";

import { getSession } from "../auth";
import { db } from "../db";
import { srsReview } from "../srs";
import type { ActionResult } from "./types";

export interface DueFlashcardDto {
  id: string;
  frontText: string;
  backText: string;
  language: string;
}

export async function getDueFlashcardsAction(): Promise<{ cards: DueFlashcardDto[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const cards = await db.flashcard.findMany({
    where: { userId: user.id, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
  });
  return {
    cards: cards.map((c) => ({ id: c.id, frontText: c.frontText, backText: c.backText, language: c.language })),
  };
}

export async function reviewFlashcardAction(id: string, remembered: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const card = await db.flashcard.findFirst({ where: { id, userId: user.id } });
  if (!card) return { error: "Akses ditolak." };
  const next = srsReview(
    { easeFactor: card.easeFactor, intervalDays: card.intervalDays, repetitions: card.repetitions },
    remembered
  );
  await db.flashcard.update({
    where: { id: card.id },
    data: {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
    },
  });
  return { message: "ok" };
}

export async function exportFlashcardsAction(): Promise<{ csv: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const cards = await db.flashcard.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = cards.map((c) => [c.frontText, c.backText, c.language].map(escapeCsv).join(","));
  return { csv: ["front,back,language", ...rows].join("\n") };
}
