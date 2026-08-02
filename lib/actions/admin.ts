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

const CONTENT_PARTS = 3;
const CONTENT_LESSON_MODIFIERS = ["normal", "hard", "easy"] as const;
const CONTENT_QUIZ_VARIANTS = 5;

export interface ContentGoalStatus {
  goal: string;
  lessonDone: number;
  lessonTotal: number;
  quizDone: number;
  quizTotal: number;
  done: number;
  total: number;
}

export interface ContentLevelStatus {
  levelId: string;
  title: string;
  lessonDone: number;
  lessonTotal: number;
  quizDone: number;
  quizTotal: number;
  done: number;
  total: number;
  goals: ContentGoalStatus[];
}

export interface LanguageContentStatus {
  levels: ContentLevelStatus[];
  done: number;
  total: number;
}

function contentUnitLabel(u: ContentUnit, levelTitle?: string): string {
  const prefix = levelTitle ? `${levelTitle} — ` : "";
  if (u.kind === "lesson") return `${prefix}Lesson: ${u.goal} — Bagian ${u.part} (${u.modifier})`;
  return `${prefix}Quiz: ${u.goal}`;
}

// Status kelengkapan konten per bahasa (SEMUA level; default: bagian 1-3, semua modifier, 5 varian quiz).
// Idempotent: dihitung dari baris cache yang sudah ada → resume aman dari posisi mana pun.
async function resolveLanguageContentStatus(language: string): Promise<LanguageContentStatus> {
  const [levels, topics, lessons, quizzes] = await Promise.all([
    db.level.findMany({ orderBy: { orderIndex: "asc" } }),
    db.topic.findMany({ orderBy: { orderIndex: "asc" } }),
    db.cachedLesson.findMany({ where: { language }, select: { level: true, goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language }, select: { level: true, goal: true, modifier: true } }),
  ]);

  const lessonKeys = new Set(lessons.map((l) => `${l.level}|${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.level}|${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }

  const levelStatuses: ContentLevelStatus[] = [];
  let totalDone = 0;
  let totalAll = 0;

  for (const level of levels) {
    const levelTopics = topics.filter((t) => t.levelId === level.id);
    if (levelTopics.length === 0) continue; // level tanpa topik tidak dihitung
    const units = buildContentWorkList(levelTopics.map((t) => t.title), {
      parts: CONTENT_PARTS,
      lessonModifiers: [...CONTENT_LESSON_MODIFIERS],
      quizVariants: CONTENT_QUIZ_VARIANTS,
    });

    const goalMap = new Map<string, ContentGoalStatus>();
    const quizPos = new Map<string, number>();
    let levelDone = 0;

    for (const u of units) {
      let g = goalMap.get(u.goal);
      if (!g) {
        g = { goal: u.goal, lessonDone: 0, lessonTotal: 0, quizDone: 0, quizTotal: 0, done: 0, total: 0 };
        goalMap.set(u.goal, g);
      }
      let isDone: boolean;
      if (u.kind === "lesson") {
        g.lessonTotal++;
        isDone = lessonKeys.has(`${level.id}|${u.goal}|${u.part}|${u.modifier}`);
        if (isDone) g.lessonDone++;
      } else {
        g.quizTotal++;
        const key = `${level.id}|${u.goal}|${u.modifier}`;
        const pos = (quizPos.get(key) ?? 0) + 1;
        quizPos.set(key, pos);
        isDone = pos <= (quizCounts.get(key) ?? 0);
        if (isDone) g.quizDone++;
      }
      if (isDone) levelDone++;
    }

    const goals = [...goalMap.values()].map((g) => ({
      ...g,
      done: g.lessonDone + g.quizDone,
      total: g.lessonTotal + g.quizTotal,
    }));
    levelStatuses.push({
      levelId: level.id,
      title: level.title,
      lessonDone: goals.reduce((s, g) => s + g.lessonDone, 0),
      lessonTotal: goals.reduce((s, g) => s + g.lessonTotal, 0),
      quizDone: goals.reduce((s, g) => s + g.quizDone, 0),
      quizTotal: goals.reduce((s, g) => s + g.quizTotal, 0),
      done: levelDone,
      total: units.length,
      goals,
    });
    totalDone += levelDone;
    totalAll += units.length;
  }

  return { levels: levelStatuses, done: totalDone, total: totalAll };
}

export async function getContentGenerationStatusAction(input: {
  language: string;
}): Promise<AdminResult<{ ok: boolean; status: LanguageContentStatus }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { ok: true, status: await resolveLanguageContentStatus(input.language) };
}

export async function generateContentChunkAction(input: {
  language: string;
}): Promise<AdminResult<{ ok: boolean; done: number; total: number; label: string | null; generated: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;

  const languages = await getLanguagesAdmin();
  if (!languages.some((l) => l.id === input.language)) return { error: "Bahasa tidak ditemukan." };

  const status = await resolveLanguageContentStatus(input.language);
  if (status.done >= status.total) return { ok: true, done: status.done, total: status.total, label: null, generated: false };

  // level pertama yang belum selesai (urutan orderIndex)
  const level = status.levels.find((l) => l.done < l.total);
  if (!level) return { ok: true, done: status.done, total: status.total, label: null, generated: false };

  const topics = await db.topic.findMany({ where: { levelId: level.levelId }, orderBy: { orderIndex: "asc" } });
  const units = buildContentWorkList(topics.map((t) => t.title), {
    parts: CONTENT_PARTS,
    lessonModifiers: [...CONTENT_LESSON_MODIFIERS],
    quizVariants: CONTENT_QUIZ_VARIANTS,
  });

  // unit pertama di level itu yang belum ada di cache
  const [lessons, quizzes] = await Promise.all([
    db.cachedLesson.findMany({ where: { language: input.language, level: level.levelId }, select: { goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language: input.language, level: level.levelId }, select: { goal: true, modifier: true } }),
  ]);
  const lessonKeys = new Set(lessons.map((l) => `${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }

  let unit: ContentUnit | null = null;
  const quizPos = new Map<string, number>();
  for (const u of units) {
    let isDone: boolean;
    if (u.kind === "lesson") {
      isDone = lessonKeys.has(`${u.goal}|${u.part}|${u.modifier}`);
    } else {
      const key = `${u.goal}|${u.modifier}`;
      const pos = (quizPos.get(key) ?? 0) + 1;
      quizPos.set(key, pos);
      isDone = pos <= (quizCounts.get(key) ?? 0);
    }
    if (!isDone) {
      unit = u;
      break;
    }
  }
  if (!unit) return { ok: true, done: status.done, total: status.total, label: null, generated: false };

  const label = contentUnitLabel(unit, level.title);
  try {
    if (unit.kind === "lesson") {
      const lesson = await generateLesson({
        language: input.language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier,
      });
      await db.cachedLesson.create({
        data: {
          language: input.language, level: level.levelId, goal: unit.goal,
          part: unit.part, modifier: unit.modifier, contentJson: JSON.stringify(lesson),
        },
      });
    } else if (unit.goal === "exam") {
      const topicsStr = topics.map((t) => t.title).join(", ") || "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening";
      const quiz = await generateExam({ language: input.language, level: level.levelId, topicsStr });
      await db.cachedQuiz.create({
        data: { language: input.language, level: level.levelId, goal: "exam", modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    } else if (unit.goal === "general_practice") {
      const quiz = await generateQuizWithPrompt({
        prompt: buildGeneralPracticePrompt(input.language, level.levelId),
        expectedCount: 5,
        label: "general practice quiz",
      });
      await db.cachedQuiz.create({
        data: { language: input.language, level: level.levelId, goal: "general_practice", modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    } else {
      const quiz = await generateQuizWithPrompt({
        prompt: buildQuizPrompt(input.language, level.levelId, unit.goal, "(belum ada riwayat kelemahan)"),
        expectedCount: 5,
        label: "quiz",
      });
      await db.cachedQuiz.create({
        data: { language: input.language, level: level.levelId, goal: unit.goal, modifier: "normal", contentJson: JSON.stringify(quiz) },
      });
    }
  } catch (e) {
    return { error: `Gagal generate "${label}": ${e instanceof Error ? e.message : "error tidak diketahui"}` };
  }

  return { ok: true, done: status.done + 1, total: status.total, label, generated: true };
}
