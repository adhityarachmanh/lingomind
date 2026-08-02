"use server";

import { requireAdmin } from "../auth";
import {
  createLanguageAdmin, createLevelAdmin, createShopItemAdmin, createTopicAdmin,
  getAppConfigsAdmin, getLanguagesAdmin, getLevelsAdmin, getMissionConfigsAdmin,
  getShopItemsAdmin, getTopicsAdmin, getUsersAdmin, resetUserProgressAdmin,
  updateAppConfigAdmin, updateLanguageAdmin, updateLevelAdmin, updateMissionConfigAdmin,
  updateShopItemAdmin, updateTopicAdmin, updateUserRoleAdmin, updateUserStatsAdmin,
} from "../admin";
import type { AdminLanguageItem, AdminLevelItem } from "../types";

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
