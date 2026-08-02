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

async function resolveLessonContext(session: { email: string }) {
  const profile = await getUserProfile(session.email);
  if (!profile) return null;
  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const stats = await getEngagementStats(session.email);
  const modifier = computeModifier(stats?.current_streak ?? 0, stats?.total_quiz_completed ?? 0);
  return { language, level, modifier };
}

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

export async function prefetchLessonAction(goal: string, part: number): Promise<{ ok: boolean }> {
  try {
    const session = await getSession();
    if (!session) return { ok: false };
    const ctx = await resolveLessonContext(session);
    if (!ctx) return { ok: false };

    const target = part + 1;
    const cached = await db.cachedLesson.findFirst({
      where: { language: ctx.language, level: ctx.level, goal, part: target, modifier: ctx.modifier },
    });
    if (cached) return { ok: true };

    const lesson = await generateLesson({
      language: ctx.language,
      level: ctx.level,
      goal,
      part: target,
      modifier: ctx.modifier,
    });
    await db.cachedLesson.create({
      data: {
        language: ctx.language,
        level: ctx.level,
        goal,
        part: target,
        modifier: ctx.modifier,
        contentJson: JSON.stringify(lesson),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
