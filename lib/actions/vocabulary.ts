"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { addVocabularyCard, deleteVocabularyCard, getDueVocabularyCount, getVocabulary } from "../flashcards";
import type { ActionResult } from "./types";
import type { FlashcardItem } from "../types";

export async function getVocabularyAction(): Promise<
  { cards: FlashcardItem[]; dueCount: number } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const [cards, dueCount] = await Promise.all([
    getVocabulary(session.email, profile.preferred_language),
    getDueVocabularyCount(session.email, profile.preferred_language),
  ]);
  return { cards, dueCount };
}

export async function addVocabularyAction(input: {
  word: string;
  translation: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!input.word.trim() || !input.translation.trim()) {
    return { error: "Kata dan arti tidak boleh kosong." };
  }
  await addVocabularyCard(session.email, profile.preferred_language, input.word, input.translation);
  return { message: "ok" };
}

export async function deleteVocabularyAction(id: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await deleteVocabularyCard(id, session.email);
  return { message: "ok" };
}
