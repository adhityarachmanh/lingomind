import type { StoryData } from "./types";

export interface TranslationQuestion {
  sentence: string;
  options: string[];
  correct: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Bangun soal terjemahan (kalimat target → pilih arti Indonesia) dari segmen cerita yang SUDAH
// di-cache — opsi pengecoh = terjemahan segmen lain (tanpa biaya AI tambahan).
export function buildTranslationQuestions(stories: StoryData[], maxQuestions: number): TranslationQuestion[] {
  const segments = stories.flatMap((s) =>
    (s.segments ?? [])
      .filter((seg) => seg.text?.trim() && seg.translation?.trim())
      .map((seg) => ({ text: seg.text.trim(), translation: seg.translation.trim() }))
  );
  const shuffled = shuffle(segments);
  const questions: TranslationQuestion[] = [];
  const usedCorrect = new Set<string>();

  for (const seg of shuffled) {
    if (questions.length >= maxQuestions) break;
    if (usedCorrect.has(seg.translation)) continue;
    const distractors = shuffle(
      segments.filter((s) => s.translation !== seg.translation).map((s) => s.translation)
    )
      .filter((t, i, arr) => arr.indexOf(t) === i) // unik
      .slice(0, 3);
    if (distractors.length < 3) continue; // butuh minimal 4 opsi beda
    usedCorrect.add(seg.translation);
    questions.push({
      sentence: seg.text,
      options: shuffle([seg.translation, ...distractors]),
      correct: seg.translation,
    });
  }
  return questions;
}
