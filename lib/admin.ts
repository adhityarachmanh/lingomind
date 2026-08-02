import { db } from "./db";
import type { AdminLanguageItem, AdminLevelItem, AdminMissionConfigItem, AdminShopItem, AdminTopicItem, AdminUserRow } from "./types";

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

export async function getLevelsAdmin(): Promise<AdminLevelItem[]> {
  const rows = await db.level.findMany({ orderBy: { orderIndex: "asc" } });
  return rows.map((l) => ({
    id: l.id, title: l.title, description: l.description,
    base_reward_points: l.baseRewardPoints, order_index: l.orderIndex,
  }));
}

export async function updateLevelAdmin(id: string, level: AdminLevelItem): Promise<void> {
  await db.level.update({
    where: { id },
    data: { title: level.title, description: level.description, baseRewardPoints: level.base_reward_points, orderIndex: level.order_index },
  });
}

export async function createLevelAdmin(level: AdminLevelItem): Promise<void> {
  await db.level.create({
    data: {
      id: level.id, title: level.title, description: level.description,
      baseRewardPoints: level.base_reward_points, orderIndex: level.order_index,
    },
  });
}

export async function getTopicsAdmin(levelId: string): Promise<AdminTopicItem[]> {
  const rows = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
  return rows.map((t) => ({ id: t.id, level_id: t.levelId, title: t.title, order_index: t.orderIndex }));
}

export async function updateTopicAdmin(id: number, title: string, orderIndex: number): Promise<void> {
  await db.topic.update({ where: { id }, data: { title, orderIndex } });
}

export async function createTopicAdmin(levelId: string, title: string, orderIndex: number): Promise<void> {
  await db.topic.create({ data: { levelId, title, orderIndex } });
}

export async function getAppConfigsAdmin(): Promise<{ key: string; value: string; description: string | null }[]> {
  const rows = await db.appConfig.findMany({ orderBy: { key: "asc" } });
  return rows.map((c) => ({ key: c.key, value: c.value, description: c.description }));
}

export async function updateAppConfigAdmin(key: string, value: string): Promise<void> {
  await db.appConfig.update({ where: { key }, data: { value } });
}

export async function getMissionConfigsAdmin(): Promise<AdminMissionConfigItem[]> {
  const rows = await db.missionConfig.findMany({ orderBy: { id: "asc" } });
  return rows.map((c) => ({
    id: c.id, name: c.name,
    lesson_target: c.lessonTarget ?? 1, quiz_target: c.quizTarget ?? 1,
    weakness_target: c.weaknessTarget ?? 3,
    flashcard_target_min: c.flashcardTargetMin ?? 5, flashcard_target_max: c.flashcardTargetMax ?? 15,
  }));
}

export async function updateMissionConfigAdmin(id: number, cfg: {
  lessonTarget: number; quizTarget: number; weaknessTarget: number;
  flashcardTargetMin: number; flashcardTargetMax: number;
}): Promise<void> {
  await db.missionConfig.update({
    where: { id },
    data: {
      lessonTarget: cfg.lessonTarget, quizTarget: cfg.quizTarget, weaknessTarget: cfg.weaknessTarget,
      flashcardTargetMin: cfg.flashcardTargetMin, flashcardTargetMax: cfg.flashcardTargetMax,
    },
  });
}

export type ContentUnit = { kind: "lesson" | "quiz"; goal: string; part: number; modifier: string };

export interface ContentWorkOptions {
  parts: number;
  lessonModifiers: string[];
  quizVariants: number;
  generalPracticeVariants: number;
}

// Jumlah varian pre-gen per level: quiz topik 5, exam 5, general practice 15 (pool besar agar variasi banyak).
export const CONTENT_EXAM_VARIANTS = 5;
export const CONTENT_GENERAL_PRACTICE_VARIANTS = 15;

// Work list deterministik untuk bulk pre-generation konten (language, level):
// lesson per (goal, part, modifier) + quiz per (goal, modifier "normal") + exam + general_practice.
export function buildContentWorkList(topics: string[], opts: ContentWorkOptions): ContentUnit[] {
  const units: ContentUnit[] = [];
  const { parts, lessonModifiers, quizVariants, generalPracticeVariants } = opts;
  for (const goal of topics) {
    for (const modifier of lessonModifiers) {
      for (let part = 1; part <= parts; part++) {
        units.push({ kind: "lesson", goal, part, modifier });
      }
    }
    for (let v = 1; v <= quizVariants; v++) {
      units.push({ kind: "quiz", goal, part: 0, modifier: "normal" });
    }
  }
  for (let v = 1; v <= CONTENT_EXAM_VARIANTS; v++) {
    units.push({ kind: "quiz", goal: "exam", part: 0, modifier: "normal" });
  }
  for (let v = 1; v <= generalPracticeVariants; v++) {
    units.push({ kind: "quiz", goal: "general_practice", part: 0, modifier: "normal" });
  }
  return units;
}
