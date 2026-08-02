import { db } from "./db";
import type { AdminLanguageItem, AdminLevelItem, AdminMissionConfigItem, AdminShopItem, AdminTopicItem, AdminUserRow } from "./types";
import { generateLesson } from "./ai-content/lesson";
import { GENERAL_PRACTICE_THEMES, buildGeneralPracticePrompt, buildQuizPrompt, generateQuizWithPrompt } from "./ai-content/quiz";
import { generateExam } from "./ai-content/exam";

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
export const CONTENT_PARTS = 3;
export const CONTENT_LESSON_MODIFIERS = ["normal", "hard", "easy"] as const;
export const CONTENT_QUIZ_VARIANTS = 5;

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

// ===== Engine bulk pre-generation (dipakai action manual + background workflow) =====

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

// Status kelengkapan konten per bahasa (SEMUA level; default: bagian 1-3, semua modifier, 5 varian quiz, 5 exam, 15 pool).
// Idempotent: dihitung dari baris cache yang sudah ada → resume aman dari posisi mana pun.
export async function resolveLanguageContentStatus(language: string): Promise<LanguageContentStatus> {
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
      generalPracticeVariants: CONTENT_GENERAL_PRACTICE_VARIANTS,
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

// Unit berikutnya yang belum ada di cache untuk (language, level) — atau null jika level selesai.
export async function findNextUndoneUnit(language: string, levelId: string): Promise<ContentUnit | null> {
  const topics = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
  const units = buildContentWorkList(topics.map((t) => t.title), {
    parts: CONTENT_PARTS,
    lessonModifiers: [...CONTENT_LESSON_MODIFIERS],
    quizVariants: CONTENT_QUIZ_VARIANTS,
    generalPracticeVariants: CONTENT_GENERAL_PRACTICE_VARIANTS,
  });

  const [lessons, quizzes] = await Promise.all([
    db.cachedLesson.findMany({ where: { language, level: levelId }, select: { goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language, level: levelId }, select: { goal: true, modifier: true } }),
  ]);
  const lessonKeys = new Set(lessons.map((l) => `${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }

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
    if (!isDone) return u;
  }
  return null;
}

// Generate satu unit konten (lesson / quiz goal / exam / general_practice) lalu simpan ke cache.
export async function generateOneContentUnit(language: string, unit: ContentUnit, levelId: string): Promise<void> {
  if (unit.kind === "lesson") {
    const lesson = await generateLesson({
      language, level: levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier,
    });
    await db.cachedLesson.create({
      data: { language, level: levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier, contentJson: JSON.stringify(lesson) },
    });
  } else if (unit.goal === "exam") {
    const topics = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
    const topicsStr = topics.map((t) => t.title).join(", ") || "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening";
    const quiz = await generateExam({ language, level: levelId, topicsStr });
    await db.cachedQuiz.create({
      data: { language, level: levelId, goal: "exam", modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  } else if (unit.goal === "general_practice") {
    // pool general practice: tema acak tiap varian agar variasi besar
    const theme = GENERAL_PRACTICE_THEMES[Math.floor(Math.random() * GENERAL_PRACTICE_THEMES.length)];
    const quiz = await generateQuizWithPrompt({
      prompt: buildGeneralPracticePrompt(language, levelId, theme),
      expectedCount: 5,
      label: "general practice quiz",
    });
    await db.cachedQuiz.create({
      data: { language, level: levelId, goal: "general_practice", modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  } else {
    const quiz = await generateQuizWithPrompt({
      prompt: buildQuizPrompt(language, levelId, unit.goal, "(belum ada riwayat kelemahan)"),
      expectedCount: 5,
      label: "quiz",
    });
    await db.cachedQuiz.create({
      data: { language, level: levelId, goal: unit.goal, modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  }
}

// Margin pengaman: berhenti mulai unit baru agar selalu ada waktu untuk update status + chainNext
// (function Vercel di-kill di batas durasi ~300s Hobby — jangan sampai chain putus kena kill).
const BATCH_SAFETY_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;

// Proses batch unit dalam batas waktu (default 4,5 menit — aman di bawah limit 5 menit Hobby).
// Unit yang gagal (mis. AI JSON tidak valid) TIDAK mematikan batch — dilanjutkan ke unit berikutnya;
// batch baru berhenti bila kegagalan beruntun >= 3 atau sisa waktu < margin pengaman.
export async function processContentBatch(language: string, maxMs = 270_000): Promise<{ done: number; total: number }> {
  const started = Date.now();
  let consecutiveFailures = 0;
  while (Date.now() - started < maxMs - BATCH_SAFETY_MS) {
    const status = await resolveLanguageContentStatus(language);
    if (status.done >= status.total) return { done: status.done, total: status.total };
    const level = status.levels.find((l) => l.done < l.total);
    if (!level) return { done: status.done, total: status.total };
    const unit = await findNextUndoneUnit(language, level.levelId);
    if (!unit) return { done: status.done, total: status.total };
    try {
      await generateOneContentUnit(language, unit, level.levelId);
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures++;
      const unitLabel = unit.kind === "lesson"
        ? `Lesson: ${unit.goal} — Bagian ${unit.part} (${unit.modifier})`
        : `Quiz: ${unit.goal}`;
      console.error(`[content-generation] unit gagal (${consecutiveFailures}x): ${unitLabel} — ${e instanceof Error ? e.message : e}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(
          `Gagal generate ${MAX_CONSECUTIVE_FAILURES} unit berturut-turut (terakhir: "${unitLabel}"): ${e instanceof Error ? e.message : "error tidak diketahui"}`
        );
      }
    }
  }
  const status = await resolveLanguageContentStatus(language);
  return { done: status.done, total: status.total };
}
