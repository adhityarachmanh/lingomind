"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getCurriculum } from "../dashboard";
import { generateStory } from "../ai-content/story";
import { parseAiJson } from "../ai-content/parse";
import { buildTranslationQuestions } from "../translation";
import { db } from "../db";
import type { StoryData, TranslationQuestion } from "../types";

export async function getTranslationPracticeAction(): Promise<
  { questions: TranslationQuestion[] } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  try {
    const cached = await db.cachedStory.findMany({ where: { language, level } });
    let stories = cached
      .map((c) => parseAiJson<StoryData>(c.contentJson))
      .filter((s): s is StoryData => !!s);

    if (stories.length === 0) {
      // belum ada cerita di level ini — generate 1 untuk topik acak, cache untuk kunjungan berikutnya
      const curriculum = await getCurriculum();
      const topics = curriculum.find((c) => c.level === level)?.topics ?? [];
      const goal = topics[Math.floor(Math.random() * topics.length)] ?? "General";
      const story = await generateStory({ language, level, goal });
      await db.cachedStory
        .upsert({
          where: { language_level_goal: { language, level, goal } },
          update: { contentJson: JSON.stringify(story) },
          create: { language, level, goal, contentJson: JSON.stringify(story) },
        })
        .catch(() => {});
      stories = [story];
    }

    const questions = buildTranslationQuestions(stories, 8);
    if (questions.length === 0) {
      return { error: "Materi terjemahan belum tersedia. Silakan coba lagi nanti." };
    }
    return { questions };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyiapkan latihan terjemahan." };
  }
}
