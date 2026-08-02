"use server";

import bcrypt from "bcryptjs";
import { requireAdmin } from "../auth";
import { db } from "../db";
import {
  buildContentWorkList, createLanguageAdmin, createLevelAdmin, createShopItemAdmin, createTopicAdmin,
  getAppConfigsAdmin, getLanguagesAdmin, getLevelsAdmin, getMissionConfigsAdmin,
  getShopItemsAdmin, getTopicsAdmin, getUsersAdmin, resetUserProgressAdmin,
  updateAppConfigAdmin, updateLanguageAdmin, updateLevelAdmin, updateMissionConfigAdmin,
  updateShopItemAdmin, updateTopicAdmin, updateUserRoleAdmin, updateUserStatsAdmin,
} from "../admin";
import type { AdminLanguageItem, AdminLevelItem } from "../types";
import type { ContentUnit } from "../admin";
import { generateLesson } from "../ai-content/lesson";
import { buildGeneralPracticePrompt, buildQuizPrompt, generateQuizWithPrompt } from "../ai-content/quiz";
import { generateExam } from "../ai-content/exam";

type AdminResult<T> = T | { error: string };

async function guard(): Promise<string | { error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Akses ditolak." };
  return admin.email;
}

export async function getUsersAdminAction(): Promise<AdminResult<{ users: Awaited<ReturnType<typeof getUsersAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { users: await getUsersAdmin() };
}

export async function updateUserStatsAdminAction(input: { email: string; coins: number; streak: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateUserStatsAdmin(input.email, input.coins, input.streak);
  return { ok: true };
}

export async function resetUserProgressAdminAction(email: string): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await resetUserProgressAdmin(email);
  return { ok: true };
}

export async function updateUserRoleAdminAction(input: { email: string; role: string }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateUserRoleAdmin(input.email, input.role);
  return { ok: true };
}

export async function getShopItemsAdminAction(): Promise<AdminResult<{ items: Awaited<ReturnType<typeof getShopItemsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { items: await getShopItemsAdmin() };
}

export async function createShopItemAdminAction(input: { name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createShopItemAdmin(input);
  return { ok: true };
}

export async function updateShopItemAdminAction(input: { id: number; name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const { id, ...rest } = input;
  await updateShopItemAdmin(id, rest);
  return { ok: true };
}

export async function getLanguagesAdminAction(): Promise<AdminResult<{ languages: Awaited<ReturnType<typeof getLanguagesAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { languages: await getLanguagesAdmin() };
}

export async function createLanguageAdminAction(lang: AdminLanguageItem): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createLanguageAdmin(lang);
  return { ok: true };
}

export async function updateLanguageAdminAction(input: { id: string; lang: AdminLanguageItem }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateLanguageAdmin(input.id, input.lang);
  return { ok: true };
}

export async function getLevelsAdminAction(): Promise<AdminResult<{ levels: Awaited<ReturnType<typeof getLevelsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { levels: await getLevelsAdmin() };
}

export async function updateLevelAdminAction(input: { id: string; level: AdminLevelItem }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateLevelAdmin(input.id, input.level);
  return { ok: true };
}

export async function createLevelAdminAction(level: AdminLevelItem): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createLevelAdmin(level);
  return { ok: true };
}

export async function getTopicsAdminAction(levelId: string): Promise<AdminResult<{ topics: Awaited<ReturnType<typeof getTopicsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { topics: await getTopicsAdmin(levelId) };
}

export async function updateTopicAdminAction(input: { id: number; title: string; orderIndex: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateTopicAdmin(input.id, input.title, input.orderIndex);
  return { ok: true };
}

export async function createTopicAdminAction(input: { levelId: string; title: string; orderIndex: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createTopicAdmin(input.levelId, input.title, input.orderIndex);
  return { ok: true };
}

export async function getAppConfigsAdminAction(): Promise<AdminResult<{ configs: Awaited<ReturnType<typeof getAppConfigsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { configs: await getAppConfigsAdmin() };
}

export async function updateAppConfigAdminAction(input: { key: string; value: string }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateAppConfigAdmin(input.key, input.value);
  return { ok: true };
}

export async function getMissionConfigsAdminAction(): Promise<AdminResult<{ configs: Awaited<ReturnType<typeof getMissionConfigsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { configs: await getMissionConfigsAdmin() };
}

export async function updateMissionConfigAdminAction(input: { id: number; lessonTarget: number; quizTarget: number; weaknessTarget: number; flashcardTargetMin: number; flashcardTargetMax: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const { id, ...rest } = input;
  await updateMissionConfigAdmin(id, rest);
  return { ok: true };
}

export async function checkAdminRoleAction(): Promise<{ isAdmin: boolean } | { error: string }> {
  const admin = await requireAdmin();
  return { isAdmin: admin !== null };
}

export async function changeAdminPasswordAction(input: { currentPassword: string; newPassword: string }): Promise<{ ok: boolean } | { error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Akses ditolak." };
  const user = await db.user.findUnique({ where: { email: admin.email } });
  if (!user || !user.passwordHash) return { error: "Akses ditolak." };
  const match = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!match) return { error: "Password lama salah." };
  if (input.newPassword.trim().length < 6) return { error: "Password baru minimal harus berukuran 6 karakter." };
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db.user.update({ where: { email: admin.email }, data: { passwordHash } });
  return { ok: true };
}

const LESSON_MODIFIERS_ALLOWED = ["normal", "hard", "easy"] as const;

interface ContentProgress {
  units: ContentUnit[];
  topics: Awaited<ReturnType<typeof getTopicsAdmin>>;
  done: number;
  total: number;
  nextIndex: number;
}

// Hitung progress bulk pre-generation per (language, level) berdasarkan baris cache yang sudah ada.
// Idempotent: unit yang sudah ada di cache di-skip → resume aman dari posisi mana pun.
async function resolveContentProgress(
  language: string,
  level: string,
  parts: number,
  lessonModifiers: string[],
  quizVariants: number
): Promise<ContentProgress | { error: string }> {
  const levels = await getLevelsAdmin();
  const levelRow = levels.find((l) => l.id === level);
  if (!levelRow) return { error: "Level tidak ditemukan." };
  const topics = await getTopicsAdmin(levelRow.id);
  const units = buildContentWorkList(topics.map((t) => t.title), { parts, lessonModifiers, quizVariants });

  const [lessons, quizzes] = await Promise.all([
    db.cachedLesson.findMany({ where: { language, level }, select: { goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language, level }, select: { goal: true, modifier: true } }),
  ]);
  const lessonKeys = new Set(lessons.map((l) => `${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }

  let done = 0;
  let nextIndex = -1;
  const quizPos = new Map<string, number>();
  units.forEach((u, i) => {
    let isDone: boolean;
    if (u.kind === "lesson") {
      isDone = lessonKeys.has(`${u.goal}|${u.part}|${u.modifier}`);
    } else {
      const key = `${u.goal}|${u.modifier}`;
      const pos = (quizPos.get(key) ?? 0) + 1;
      quizPos.set(key, pos);
      isDone = pos <= (quizCounts.get(key) ?? 0);
    }
    if (isDone) done++;
    else if (nextIndex === -1) nextIndex = i;
  });
  return { units, topics, done, total: units.length, nextIndex };
}

function contentUnitLabel(u: ContentUnit): string {
  if (u.kind === "lesson") return `Lesson: ${u.goal} — Bagian ${u.part} (${u.modifier})`;
  return `Quiz: ${u.goal}`;
}

function sanitizeContentOptions(input: { parts?: number; lessonModifiers?: string[]; quizVariants?: number }) {
  const parts = Math.min(5, Math.max(1, input.parts ?? 3));
  const lessonModifiers = (input.lessonModifiers ?? ["normal"]).filter((m) =>
    (LESSON_MODIFIERS_ALLOWED as readonly string[]).includes(m)
  );
  const quizVariants = Math.min(5, Math.max(1, input.quizVariants ?? 5));
  return { parts, lessonModifiers, quizVariants };
}

export async function getContentGenerationStatusAction(input: {
  language: string;
  level: string;
  parts?: number;
  lessonModifiers?: string[];
  quizVariants?: number;
}): Promise<AdminResult<{ ok: boolean; done: number; total: number; label: string | null }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const opts = sanitizeContentOptions(input);
  const prog = await resolveContentProgress(input.language, input.level, opts.parts, opts.lessonModifiers, opts.quizVariants);
  if ("error" in prog) return prog;
  const label = prog.nextIndex === -1 ? null : contentUnitLabel(prog.units[prog.nextIndex]);
  return { ok: true, done: prog.done, total: prog.total, label };
}

export async function generateContentChunkAction(input: {
  language: string;
  level: string;
  parts?: number;
  lessonModifiers?: string[];
  quizVariants?: number;
}): Promise<
  AdminResult<{ ok: boolean; done: number; total: number; label: string | null; generated: boolean }>
> {
  const g = await guard();
  if (typeof g !== "string") return g;

  const languages = await getLanguagesAdmin();
  if (!languages.some((l) => l.id === input.language)) return { error: "Bahasa tidak ditemukan." };

  const opts = sanitizeContentOptions(input);
  const prog = await resolveContentProgress(input.language, input.level, opts.parts, opts.lessonModifiers, opts.quizVariants);
  if ("error" in prog) return prog;
  if (prog.nextIndex === -1) return { ok: true, done: prog.done, total: prog.total, label: null, generated: false };

  const unit = prog.units[prog.nextIndex];
  try {
    if (unit.kind === "lesson") {
      const lesson = await generateLesson({
        language: input.language, level: input.level, goal: unit.goal, part: unit.part, modifier: unit.modifier,
      });
      await db.cachedLesson.create({
        data: {
          language: input.language, level: input.level, goal: unit.goal,
          part: unit.part, modifier: unit.modifier, contentJson: JSON.stringify(lesson),
        },
      });
    } else if (unit.goal === "exam") {
      const topicsStr = prog.topics.map((t) => t.title).join(", ") || "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening";
      const quiz = await generateExam({ language: input.language, level: input.level, topicsStr });
      await db.cachedQuiz.create({
        data: { language: input.language, level: input.level, goal: "exam", modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    } else if (unit.goal === "general_practice") {
      const quiz = await generateQuizWithPrompt({
        prompt: buildGeneralPracticePrompt(input.language, input.level),
        expectedCount: 5,
        label: "general practice quiz",
      });
      await db.cachedQuiz.create({
        data: { language: input.language, level: input.level, goal: "general_practice", modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    } else {
      const quiz = await generateQuizWithPrompt({
        prompt: buildQuizPrompt(input.language, input.level, unit.goal, "(belum ada riwayat kelemahan)"),
        expectedCount: 5,
        label: "quiz",
      });
      await db.cachedQuiz.create({
        data: { language: input.language, level: input.level, goal: unit.goal, modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    }
  } catch (e) {
    return { error: `Gagal generate "${contentUnitLabel(unit)}": ${e instanceof Error ? e.message : "error tidak diketahui"}` };
  }

  return { ok: true, done: prog.done + 1, total: prog.total, label: contentUnitLabel(unit), generated: true };
}
