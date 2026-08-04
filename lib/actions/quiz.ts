"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getEngagementStats, getCurriculum } from "../dashboard";
import { logSkillProgress, logWeakness, classifySkill, classifyWeaknessTopic } from "../weakness";
import { shuffleQuiz } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { addFlashcards } from "../flashcards";
import { applyQuizResult, deductHeart, updateEngagementAfterQuiz } from "../progress";
import { incrementCorrectAnswers } from "../mission";
import { db } from "../db";
import type { QuizContainer, UserProfile } from "../types";

export interface RecordAnswerInput {
  language: string;
  question: string;
  selected: string;
  correct: string;
  explanation: string;
  questionType: string;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Cache-only: quiz di-pre-generate via panel admin (bukan AI on-demand dari user).
export async function getQuizAction(goal: string): Promise<{ quiz: QuizContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  const variants = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier: "normal" } });

  if (variants.length > 0) {
    const picked = randomPick(variants);
    const quiz = parseAiJson<QuizContainer>(picked.contentJson);
    if (quiz && quiz.questions && quiz.questions.length > 0) {
      return { quiz: shuffleQuiz(quiz), language };
    }
  }

  return { error: "Kuis belum tersedia. Konten sedang disiapkan, silakan coba lagi nanti." };
}

export async function recordAnswerAction(input: RecordAnswerInput): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const { language, question, selected, correct, explanation, questionType } = input;

  const plainQuestion = question.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  await addFlashcards(session.email, [
    { language, front_text: plainQuestion, back_text: `Jawaban benar: ${correct} | Penjelasan: ${explanation}` },
  ]);

  const isCorrect = selected === correct;
  const skill = classifySkill(question, explanation, questionType);

  if (isCorrect) {
    await logSkillProgress(session.email, language, skill, true);
    return { hearts: (await getEngagementStats(session.email))?.hearts ?? 5 };
  }

  await logWeakness(
    session.email,
    language,
    classifyWeaknessTopic(explanation),
    `Q: ${question} | Selected: ${selected} | Correct: ${correct}`
  );
  await logSkillProgress(session.email, language, skill, false);
  const { hearts } = await deductHeart(session.email);
  return { hearts };
}

export async function submitQuizResultAction(input: {
  goal: string;
  language: string;
  score: number;
  correctCount: number;
}): Promise<{ profile: UserProfile } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const baseLevel = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const curriculum = await getCurriculum();
  const pts = curriculum.find((c) => c.level === baseLevel)?.base_reward_points ?? 10;
  const clampedScore = Math.min(Math.max(0, input.score), pts * 5);
  const clampedCorrect = Math.min(Math.max(0, input.correctCount), 5);

  await incrementCorrectAnswers(session.email, clampedCorrect);
  const updated = await applyQuizResult(session.email, language, input.goal, clampedScore);
  await updateEngagementAfterQuiz(session.email, clampedScore);
  return { profile: updated };
}
