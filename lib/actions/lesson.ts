"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getEngagementStats } from "../dashboard";
import { generateLesson } from "../ai-content/lesson";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { LessonContainer } from "../types";

function computeModifier(streak: number, quizzes: number): string {
  if (streak >= 3 && quizzes >= 5) return "hard";
  if (quizzes > 0 && streak === 0) return "easy";
  return "normal";
}

export async function getLessonAction(
  goal: string,
  part: number
): Promise<{ lesson: LessonContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const safePart = Math.max(1, part);

  const stats = await getEngagementStats(session.email);
  const modifier = computeModifier(stats?.current_streak ?? 0, stats?.total_quiz_completed ?? 0);

  const cached = await db.cachedLesson.findFirst({
    where: { language, level, goal, part: safePart, modifier },
  });
  if (cached) {
    const parsed = parseAiJson<LessonContainer>(cached.contentJson);
    if (parsed && parsed.title && parsed.content) {
      return { lesson: parsed, language };
    }
  }

  const lesson = await generateLesson({ language, level, goal, part: safePart, modifier });
  await db.cachedLesson.create({
    data: { language, level, goal, part: safePart, modifier, contentJson: JSON.stringify(lesson) },
  });
  return { lesson, language };
}
