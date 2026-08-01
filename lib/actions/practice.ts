"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getPriorityWeakness, logWeakness } from "../weakness";
import { addHeart, updateEngagementAfterQuiz } from "../progress";
import { buildGeneralPracticePrompt, buildWeaknessContext, buildWeaknessPrompt, generateQuizWithPrompt, shuffleOptions } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { QuizContainer } from "../types";

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function cacheOrGenerate(params: {
  language: string;
  level: string;
  goal: string;
  modifier: string;
  generate: () => Promise<QuizContainer>;
}): Promise<QuizContainer> {
  const { language, level, goal, modifier, generate } = params;
  const variants = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier } });
  if (variants.length >= 5) {
    const parsed = parseAiJson<QuizContainer>(randomPick(variants).contentJson);
    if (parsed) return parsed;
  }
  const quiz = await generate();
  await db.cachedQuiz.create({
    data: { language, level, goal, modifier, contentJson: JSON.stringify(quiz) },
  });
  return quiz;
}

export async function getGeneralPracticeAction(): Promise<{ quiz: QuizContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  const quiz = await cacheOrGenerate({
    language, level, goal: "general_practice", modifier: "normal",
    generate: () => generateQuizWithPrompt({
      prompt: buildGeneralPracticePrompt(language, level),
      expectedCount: 5,
      label: "general practice quiz",
    }),
  });
  return { quiz: shuffleOptions(quiz), language };
}

export async function getWeaknessPracticeAction(goal: string): Promise<{ quiz: QuizContainer; language: string; topic: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const priority = await getPriorityWeakness(session.email, language);
  const topic = priority ?? goal;

  const notes = await db.weaknessLog.findMany({
    where: { email: session.email, language, topic },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const weaknessContext = buildWeaknessContext(notes.map((n) => n.note));

  const quiz = await cacheOrGenerate({
    language, level, goal: "weakness", modifier: topic,
    generate: () => generateQuizWithPrompt({
      prompt: buildWeaknessPrompt(language, level, topic, weaknessContext),
      expectedCount: 3,
      label: "practice quiz",
      weaknessFocus: topic,
    }),
  });
  return { quiz: shuffleOptions(quiz), language, topic };
}

export async function logPracticeAnswerAction(input: {
  topic: string;
  question: string;
  selected: string;
  correct: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  await logWeakness(
    session.email,
    profile.preferred_language,
    input.topic,
    `Practice Q: ${input.question} | Selected: ${input.selected} | Correct: ${input.correct}`
  );
  return { message: "ok" };
}

export async function submitGeneralPracticeResultAction(input: { perfect: boolean }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (input.perfect) {
    await addHeart(session.email).catch(() => {}); // "Nyawa sudah penuh!" → abaikan (fire-and-forget legacy)
    await updateEngagementAfterQuiz(session.email, 15);
  } else {
    await updateEngagementAfterQuiz(session.email, 10);
  }
  return { message: "ok" };
}
