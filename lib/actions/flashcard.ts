"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getDueFlashcards, reviewFlashcard, addFlashcards } from "../flashcards";
import type { ActionResult } from "./types";
import type { FlashcardItem, NewFlashcard } from "../types";

export async function getDueFlashcardsAction(limit: number, kind?: string): Promise<{ cards: FlashcardItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const cards = await getDueFlashcards(session.email, profile.preferred_language, limit, kind);
  return { cards };
}

export async function reviewFlashcardAction(id: number, quality: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    await reviewFlashcard(id, quality, session.email);
    return { message: "ok" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan review flashcard." };
  }
}

export async function addFlashcardsAction(cards: NewFlashcard[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await addFlashcards(session.email, cards);
  return { message: "ok" };
}
