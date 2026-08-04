"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { deductHeart, submitExamResult } from "../progress";
import { getCurriculum } from "../dashboard";
import { shuffleQuiz } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { QuizContainer, UserProfile } from "../types";

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function requireLevel(sessionEmail: string, level: string): Promise<{ profile: UserProfile; language: string } | { error: string }> {
  const profile = await getUserProfile(sessionEmail);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const language = profile.preferred_language;
  const current = profile.current_level[language] ?? "A1.0";
  const base = current.split(".")[0];
  const topicIdx = Number(current.split(".")[1] ?? 0);
  const curriculum = await getCurriculum();
  const topicsInLevel = curriculum.find((c) => c.level === level)?.topics.length ?? 4;
  if (base !== level || topicIdx < topicsInLevel) {
    return { error: `Anda belum menyelesaikan semua topik di level ${level} untuk mengambil ujian ini.` };
  }
  return { profile, language };
}

export async function checkExamCooldownAction(level: string): Promise<{ onCooldown: boolean; message: string; tickets: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  const row = await db.userLanguageProgress.findUnique({
    where: { email_languageId: { email: session.email, languageId: gate.language } },
  });
  let onCooldown = false;
  let message = "";
  if (row?.examCooldownUntil && row.examCooldownUntil > new Date()) {
    onCooldown = true;
    const diffMs = row.examCooldownUntil.getTime() - Date.now();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    message = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
  }
  const stats = await db.userEngagementStat.findUnique({ where: { email: session.email } });
  return { onCooldown, message, tickets: stats?.examRetakeTickets ?? 0 };
}

export async function consumeRetakeTicketAction(level: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.userEngagementStat.updateMany({
        where: { email: session.email, examRetakeTickets: { gt: 0 } },
        data: { examRetakeTickets: { decrement: 1 } },
      });
      if (updated.count === 0) {
        const stats = await tx.userEngagementStat.findUnique({ where: { email: session.email } });
        if (!stats) throw new Error("Data user tidak ditemukan.");
        throw new Error("Anda tidak memiliki tiket retake exam.");
      }
      await tx.userLanguageProgress.update({
        where: { email_languageId: { email: session.email, languageId: gate.language } },
        data: { examCooldownUntil: null },
      });
    });
    return { message: "ok" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menggunakan tiket." };
  }
}

export async function getExamAction(level: string): Promise<{ quiz: QuizContainer; language: string; ptsPerQuestion: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  const variants = await db.cachedQuiz.findMany({ where: { language: gate.language, level, goal: "exam", modifier: "normal" } });
  let quiz: QuizContainer | null = null;
  if (variants.length > 0) {
    quiz = parseAiJson<QuizContainer>(randomPick(variants).contentJson);
  }
  // Cache-only: soal ujian di-pre-generate via panel admin (bukan AI on-demand dari user).
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return { error: "Soal ujian belum tersedia. Konten sedang disiapkan, silakan coba lagi nanti." };
  }

  const levelData = await db.level.findUnique({ where: { id: level } });
  return { quiz: shuffleQuiz(quiz), language: gate.language, ptsPerQuestion: levelData?.baseRewardPoints ?? 10 };
}

export async function deductExamHeartAction(): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const { hearts } = await deductHeart(session.email);
  return { hearts };
}

export async function submitExamResultAction(input: {
  passed: boolean;
  score: number;
  correctCount: number;
  total: number;
}): Promise<{ profile: UserProfile } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const language = profile.preferred_language;
  const baseLevel = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const curriculum = await getCurriculum();
  const pts = curriculum.find((c) => c.level === baseLevel)?.base_reward_points ?? 10;
  // anti-cheat: pastikan jumlah benar & skor konsisten dengan jawaban benar
  if (!Number.isInteger(input.correctCount) || input.correctCount < 0 || !Number.isInteger(input.total) || input.total <= 0) {
    return { error: "Skor tidak valid." };
  }
  if (input.correctCount > input.total || input.score !== input.correctCount * pts) {
    return { error: "Skor tidak valid." };
  }
  const clampedScore = Math.min(Math.max(0, input.score), 8 * pts);
  const updated = await submitExamResult(session.email, language, input.passed, clampedScore);
  return { profile: updated };
}
