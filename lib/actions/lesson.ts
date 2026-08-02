"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getEngagementStats } from "../dashboard";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { LessonContainer } from "../types";

function computeModifier(streak: number, quizzes: number): string {
  if (streak >= 3 && quizzes >= 5) return "hard";
  if (quizzes > 0 && streak === 0) return "easy";
  return "normal";
}

async function resolveLessonContext(session: { email: string }) {
  const profile = await getUserProfile(session.email);
  if (!profile) return null;
  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const stats = await getEngagementStats(session.email);
  const modifier = computeModifier(stats?.current_streak ?? 0, stats?.total_quiz_completed ?? 0);
  return { language, level, modifier };
}

// Cache-only: konten lesson di-pre-generate via panel admin (bukan AI on-demand dari user).
export async function getLessonAction(
  goal: string,
  part: number
): Promise<{ lesson: LessonContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const ctx = await resolveLessonContext(session);
  if (!ctx) return { error: "Sesi berakhir. Silakan login kembali." };

  const { language, level, modifier } = ctx;
  const safePart = Math.max(1, part);

  // cari cache sesuai modifier user (normal/hard/easy); fallback ke "normal" bila modifier tidak tersedia
  const cached =
    (await db.cachedLesson.findFirst({
      where: { language, level, goal, part: safePart, modifier },
    })) ??
    (modifier !== "normal"
      ? await db.cachedLesson.findFirst({
          where: { language, level, goal, part: safePart, modifier: "normal" },
        })
      : null);
  if (cached) {
    const parsed = parseAiJson<LessonContainer>(cached.contentJson);
    if (parsed && parsed.title && parsed.content) {
      return { lesson: parsed, language };
    }
  }

  return { error: "Materi belum tersedia. Konten sedang disiapkan, silakan coba lagi nanti." };
}
