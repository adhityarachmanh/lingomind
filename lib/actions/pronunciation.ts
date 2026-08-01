"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { evaluatePronunciation, generateSentences } from "../ai-content/pronunciation";
import type { PronunciationEvaluation } from "../types";

export async function getSentencesAction(): Promise<{ sentences: string[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  try {
    const sentences = await generateSentences({ language, level });
    return { sentences };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyiapkan kalimat latihan." };
  }
}

export async function evaluatePronunciationAction(input: {
  sentence: string;
  transcript: string;
}): Promise<{ evaluation: PronunciationEvaluation } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  try {
    const evaluation = await evaluatePronunciation({
      language: profile.preferred_language,
      targetSentence: input.sentence,
      transcript: input.transcript,
    });
    return { evaluation };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengevaluasi pronunciation." };
  }
}
