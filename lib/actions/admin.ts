"use server";

import bcrypt from "bcryptjs";
import { requireAdmin } from "../auth";
import { db } from "../db";
import {
  CONTENT_EXAM_VARIANTS, CONTENT_GENERAL_PRACTICE_VARIANTS, CONTENT_PARTS, CONTENT_QUIZ_VARIANTS,
  createLanguageAdmin, createLevelAdmin, createShopItemAdmin, createTopicAdmin,
  findNextUndoneUnit, generateOneContentUnit, getAppConfigsAdmin, getLanguagesAdmin, getLevelsAdmin, getMissionConfigsAdmin,
  getShopItemsAdmin, getTopicsAdmin, getUsersAdmin, resetFailedContentUnits, resetUserProgressAdmin,
  resolveLanguageContentStatus, updateAppConfigAdmin, updateLanguageAdmin, updateLevelAdmin, updateMissionConfigAdmin,
  updateShopItemAdmin, updateTopicAdmin, updateUserRoleAdmin, updateUserStatsAdmin,
} from "../admin";
import type { AdminLanguageItem, AdminLevelItem } from "../types";
import type { ContentUnit, LanguageContentStatus } from "../admin";

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


function contentUnitLabel(u: ContentUnit, levelTitle?: string): string {
  const prefix = levelTitle ? `${levelTitle} — ` : "";
  if (u.kind === "lesson") return `${prefix}Lesson: ${u.goal} — Bagian ${u.part} (${u.modifier})`;
  return `${prefix}Quiz: ${u.goal}`;
}

export async function getContentGenerationStatusAction(input: {
  language: string;
}): Promise<AdminResult<{ ok: boolean; status: LanguageContentStatus; failedCount: number }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const [status, failedCount] = await Promise.all([
    resolveLanguageContentStatus(input.language),
    db.failedContentUnit.count({ where: { language: input.language } }),
  ]);
  return { ok: true, status, failedCount };
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

  const unit = await findNextUndoneUnit(input.language, level.levelId);
  if (!unit) return { ok: true, done: status.done, total: status.total, label: null, generated: false };

  const label = contentUnitLabel(unit, level.title);
  try {
    await generateOneContentUnit(input.language, unit, level.levelId);
  } catch (e) {
    return { error: `Gagal generate "${label}": ${e instanceof Error ? e.message : "error tidak diketahui"}` };
  }

  return { ok: true, done: status.done + 1, total: status.total, label, generated: true };
}

export async function resetFailedContentUnitsAction(language: string): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await resetFailedContentUnits(language);
  return { ok: true };
}

// Generate SATU unit konten spesifik (incremental 1-per-1, bukan bulk).
export async function generateSpecificUnitAction(input: {
  language: string;
  level: string;
  kind: "lesson" | "quiz" | "exam" | "general_practice";
  goal?: string;
  part?: number;
  modifier?: string;
}): Promise<AdminResult<{ ok: boolean; label: string }>> {
  const g = await guard();
  if (typeof g !== "string") return g;

  const languages = await getLanguagesAdmin();
  if (!languages.some((l) => l.id === input.language)) return { error: "Bahasa tidak ditemukan." };

  const levels = await getLevelsAdmin();
  const levelRow = levels.find((l) => l.id === input.level);
  if (!levelRow) return { error: "Level tidak ditemukan." };

  const topics = await getTopicsAdmin(levelRow.id);

  // bangun unit + cek target/cap
  let unit: ContentUnit;
  let targetVariantCap: number | null = null;
  if (input.kind === "lesson") {
    const part = Math.min(CONTENT_PARTS, Math.max(1, input.part ?? 1));
    const modifier = input.modifier && ["normal", "hard", "easy"].includes(input.modifier) ? input.modifier : "normal";
    const goal = (input.goal ?? "").trim();
    if (!goal) return { error: "Goal (topik) wajib diisi untuk lesson." };
    if (!topics.some((t) => t.title === goal)) return { error: "Goal tidak ditemukan di level ini." };
    const existing = await db.cachedLesson.findFirst({ where: { language: input.language, level: input.level, goal, part, modifier } });
    if (existing) return { error: "Konten ini sudah digenerate." };
    unit = { kind: "lesson", goal, part, modifier };
  } else {
    const goal = input.kind === "exam" ? "exam" : input.kind === "general_practice" ? "general_practice" : (input.goal ?? "").trim();
    if (input.kind === "quiz") {
      if (!goal) return { error: "Goal (topik) wajib diisi untuk quiz." };
      if (!topics.some((t) => t.title === goal)) return { error: "Goal tidak ditemukan di level ini." };
      targetVariantCap = CONTENT_QUIZ_VARIANTS;
    } else if (input.kind === "exam") {
      targetVariantCap = CONTENT_EXAM_VARIANTS;
    } else {
      targetVariantCap = CONTENT_GENERAL_PRACTICE_VARIANTS;
    }
    const count = await db.cachedQuiz.count({ where: { language: input.language, level: input.level, goal, modifier: "normal" } });
    if (count >= targetVariantCap) return { error: `Varian untuk konten ini sudah penuh (${targetVariantCap}).` };
    unit = { kind: "quiz", goal, part: 0, modifier: "normal" };
  }

  const label = contentUnitLabel(unit, levelRow.title);
  try {
    await generateOneContentUnit(input.language, unit, input.level);
  } catch (e) {
    return { error: `Gagal generate "${label}": ${e instanceof Error ? e.message : "error tidak diketahui"}` };
  }
  return { ok: true, label };
}
