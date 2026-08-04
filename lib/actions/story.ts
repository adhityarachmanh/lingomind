"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { generateStory } from "../ai-content/story";
import { parseAiJson } from "../ai-content/parse";
import { applyQuizResult, updateEngagementAfterQuiz } from "../progress";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { StoryData } from "../types";

export async function getStoryAction(goal: string): Promise<{ story: StoryData; language: string; level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  try {
    // cache-first: cerita pre-generated per (language, level, goal) — kunjungan kedua+ instan
    const cached = await db.cachedStory.findUnique({
      where: { language_level_goal: { language, level, goal } },
    });
    if (cached) {
      const story = parseAiJson<StoryData>(cached.contentJson);
      if (story) return { story, language, level };
    }
    const story = await generateStory({ language, level, goal });
    await db.cachedStory
      .upsert({
        where: { language_level_goal: { language, level, goal } },
        update: { contentJson: JSON.stringify(story) },
        create: { language, level, goal, contentJson: JSON.stringify(story) },
      })
      .catch(() => {});
    return { story, language, level };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat cerita." };
  }
}

export async function completeStoryAction(goal: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  try {
    // dedup anti-farm: story reward sekali per topik per hari
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyDone = await db.userProgressLog.count({
      where: { email: session.email, activityType: "quiz", topic: goal, createdAt: { gte: todayStart } },
    });
    if (alreadyDone >= 1) return { message: "Cerita selesai." };

    await applyQuizResult(session.email, profile.preferred_language, goal, 20);
    await updateEngagementAfterQuiz(session.email, 20);
    return { message: "ok" };
  } catch {
    return { message: "Cerita selesai. (Gagal menyimpan skor)" };
  }
}
