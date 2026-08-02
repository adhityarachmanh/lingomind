import { db } from "./db";
import type { AdminLanguageItem, AdminShopItem, AdminUserRow } from "./types";

export async function getUsersAdmin(): Promise<AdminUserRow[]> {
  const users = await db.user.findMany({ orderBy: { email: "asc" } });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email,
      full_name: u.fullName ?? "",
      role: u.role,
      is_verified: u.isVerified,
      score: u.score ?? 0,
      coins: stats?.coins ?? 0,
      streak_days: stats?.currentStreak ?? 0,
    };
  });
}

export async function updateUserStatsAdmin(email: string, coins: number, streak: number): Promise<void> {
  const existing = await db.userEngagementStat.findUnique({ where: { email } });
  if (existing) {
    await db.userEngagementStat.update({
      where: { email },
      data: {
        coins,
        currentStreak: streak,
        longestStreak: Math.max(existing.longestStreak, streak),
      },
    });
  } else {
    await db.userEngagementStat.create({
      data: { email, coins, currentStreak: streak, longestStreak: streak },
    });
  }
}

export async function resetUserProgressAdmin(email: string): Promise<void> {
  await db.$transaction([
    db.chatSession.deleteMany({ where: { email } }),
    db.flashcard.deleteMany({ where: { email } }),
    db.weaknessLog.deleteMany({ where: { email } }),
    db.userLanguageGoal.deleteMany({ where: { email } }),
    db.skillProgressLog.deleteMany({ where: { email } }),
    db.userEngagementStat.deleteMany({ where: { email } }),
    db.passwordReset.deleteMany({ where: { email } }),
    db.userBadge.deleteMany({ where: { email } }),
    db.emailVerificationToken.deleteMany({ where: { email } }),
    db.userProgressLog.deleteMany({ where: { email } }),
    db.userLanguageProgress.deleteMany({ where: { email } }),
    db.follower.deleteMany({ where: { OR: [{ followerEmail: email }, { followedEmail: email }] } }),
    db.quizBattle.deleteMany({ where: { OR: [{ challengerEmail: email }, { challengedEmail: email }] } }),
    db.user.update({ where: { email }, data: { score: 0, preferredLanguage: "English" } }),
  ]);
}

export async function updateUserRoleAdmin(email: string, newRole: string): Promise<void> {
  await db.user.update({ where: { email }, data: { role: newRole } });
}

export async function getShopItemsAdmin(): Promise<AdminShopItem[]> {
  const items = await db.shopItem.findMany({ orderBy: { cost: "asc" } });
  return items.map((i) => ({
    id: i.id, name: i.name, description: i.description, cost: i.cost,
    effect_type: i.effectType, icon_name: i.iconName,
  }));
}

export async function createShopItemAdmin(input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.create({
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function updateShopItemAdmin(id: number, input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.update({
    where: { id },
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function getLanguagesAdmin(): Promise<AdminLanguageItem[]> {
  const rows = await db.language.findMany({ orderBy: { name: "asc" } });
  return rows.map((l) => ({
    id: l.id, name: l.name, native_name: l.nativeName, flag: l.flag, description: l.description,
    theme_class: l.themeClass, button_class: l.buttonClass, category: l.category,
    tts_lang_code: l.ttsLangCode, edge_tts_voice: l.edgeTtsVoice,
  }));
}

export async function createLanguageAdmin(lang: AdminLanguageItem): Promise<void> {
  await db.language.create({
    data: {
      id: lang.id, name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice ?? "",
    },
  });
}

export async function updateLanguageAdmin(id: string, lang: AdminLanguageItem): Promise<void> {
  await db.language.update({
    where: { id },
    data: {
      name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice ?? "",
    },
  });
}
