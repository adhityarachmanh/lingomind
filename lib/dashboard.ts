import { cache } from "react";
import { db } from "./db";
import type { CurriculumLevel, DailyMission, EngagementStats, LanguageCourse } from "./types";

// Target konten per level (default bulk pre-generation: bagian 1-3, modifier normal+hard+easy, 5 varian quiz + 5 exam).
export function computeLevelContentTargets(goalCount: number): { lessonTotal: number; quizTotal: number } {
  return { lessonTotal: goalCount * 9, quizTotal: goalCount * 5 + 5 };
}

// Level siap = lesson & quiz cache memenuhi target; level tanpa topik dianggap siap.
export function isLevelReady(lessonCount: number, quizCount: number, goalCount: number): boolean {
  if (goalCount <= 0) return true;
  const t = computeLevelContentTargets(goalCount);
  return lessonCount >= t.lessonTotal && quizCount >= t.quizTotal;
}

// Bahasa siap = SEMUA level (yang punya topik) lengkap kontennya.
export function isLanguageReady(levels: { goalCount: number; lessonCount: number; quizCount: number }[]): boolean {
  if (levels.length === 0) return false;
  return levels.every((l) => isLevelReady(l.lessonCount, l.quizCount, l.goalCount));
}

export function computeHeartRefill(
  hearts: number,
  lastRefill: Date | null,
  now: Date
): { hearts: number; lastRefill: Date | null } {
  if (hearts >= 5 || lastRefill === null) {
    if (hearts < 5 && lastRefill === null) {
      return { hearts, lastRefill: now };
    }
    return { hearts, lastRefill };
  }
  const diffHours = Math.floor((now.getTime() - lastRefill.getTime()) / (60 * 60 * 1000));
  if (diffHours < 4) return { hearts, lastRefill };

  const heartsToAdd = Math.floor(diffHours / 4);
  const newHearts = Math.min(5, hearts + heartsToAdd);
  if (newHearts === 5) return { hearts: newHearts, lastRefill: null };

  const advanced = new Date(lastRefill.getTime() + heartsToAdd * 4 * 60 * 60 * 1000);
  return { hearts: newHearts, lastRefill: advanced };
}

export async function getEngagementStats(email: string): Promise<EngagementStats | null> {
  const row = await db.userEngagementStat.findUnique({ where: { email } });
  if (!row) return null;

  const now = new Date();
  const { hearts, lastRefill } = computeHeartRefill(row.hearts ?? 0, row.lastHeartRefill, now);
  if (hearts !== (row.hearts ?? 0) || lastRefill?.getTime() !== row.lastHeartRefill?.getTime()) {
    await db.userEngagementStat.update({
      where: { email },
      data: { hearts, lastHeartRefill: lastRefill },
    });
  }

  return {
    current_streak: row.currentStreak ?? 0,
    longest_streak: row.longestStreak ?? 0,
    total_quiz_completed: row.totalQuizCompleted ?? 0,
    total_points_earned: row.totalPointsEarned ?? 0,
    coins: row.coins ?? 0,
    streak_freezes: row.streakFreezes ?? 0,
    previous_streak: row.previousStreak ?? 0,
    double_xp_until: row.doubleXpUntil,
    exam_retake_tickets: row.examRetakeTickets ?? 0,
    hearts,
    last_heart_refill: lastRefill,
    last_active_date: row.lastActiveDate,
    has_weekend_amulet: row.hasWeekendAmulet,
  };
}

export async function getDueFlashcardCount(email: string, language: string): Promise<number> {
  return db.flashcard.count({
    where: { email, language, dueAt: { lte: new Date() } },
  });
}

export async function getDailyMission(email: string, language: string): Promise<DailyMission> {
  const dueCount = await getDueFlashcardCount(email, language);
  const weak7d = await db.weaknessLog.count({
    where: { email, language, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  let lesson_target = 1;
  let quiz_target = 1;
  let baseWeaknessTarget = 3;
  let fcMin = 5;
  let fcMax = 15;

  const cfg = await db.missionConfig.findFirst({ where: { name: "Daily Standard" } });
  if (cfg) {
    lesson_target = cfg.lessonTarget ?? lesson_target;
    quiz_target = cfg.quizTarget ?? quiz_target;
    baseWeaknessTarget = cfg.weaknessTarget ?? baseWeaknessTarget;
    fcMin = cfg.flashcardTargetMin ?? fcMin;
    fcMax = cfg.flashcardTargetMax ?? fcMax;
  }

  const flashTarget = dueCount <= 0 ? fcMin : Math.min(dueCount, fcMax);
  const weaknessTarget = weak7d >= 10 ? baseWeaknessTarget + 2 : baseWeaknessTarget;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.userDailyMission.upsert({
    where: { email_date: { email, date: today } },
    create: { email, date: today },
    update: {},
  });

  const row = await db.userDailyMission.findUnique({
    where: { email_date: { email, date: today } },
  });

  let isCompleted = row?.isCompleted ?? false;
  if (!isCompleted && (row?.lessonsCompleted ?? 0) >= lesson_target && (row?.quizzesCompleted ?? 0) >= quiz_target &&
      (row?.weaknessPracticesCompleted ?? 0) >= weaknessTarget && (row?.flashcardsReviewed ?? 0) >= flashTarget) {
    isCompleted = true;
    await db.userDailyMission.update({
      where: { email_date: { email, date: today } },
      data: { isCompleted: true },
    });
  }

  return {
    lessons_completed: row?.lessonsCompleted ?? 0,
    quizzes_completed: row?.quizzesCompleted ?? 0,
    weakness_practices_completed: row?.weaknessPracticesCompleted ?? 0,
    flashcards_reviewed: row?.flashcardsReviewed ?? 0,
    is_completed: isCompleted,
    reward_claimed: row?.rewardClaimed ?? false,
    lesson_target,
    quiz_target,
    weakness_target: weaknessTarget,
    flashcard_target: flashTarget,
    correct_answers_today: row?.correctAnswersToday ?? 0,
    pvp_wins_today: row?.pvpWinsToday ?? 0,
    tier1_claimed: row?.tier1Claimed ?? false,
    tier2_claimed: row?.tier2Claimed ?? false,
    tier3_claimed: row?.tier3Claimed ?? false,
  };
}

// Hanya bahasa dengan konten SIAP (semua level lengkap) yang ditampilkan ke user —
// konten lesson/quiz di-pre-generate via panel admin, bukan on-demand.
export const getLanguages = cache(async (): Promise<LanguageCourse[]> => {
  const rows = await db.language.findMany({ orderBy: { name: "asc" } });
  if (rows.length === 0) return [];

  const [lessons, quizzes, levels, topics] = await Promise.all([
    db.cachedLesson.groupBy({ by: ["language", "level"], _count: true }),
    db.cachedQuiz.groupBy({ by: ["language", "level"], _count: true }),
    db.level.findMany({ orderBy: { orderIndex: "asc" } }),
    db.topic.findMany({ orderBy: { orderIndex: "asc" } }),
  ]);
  const lessonCounts = new Map(lessons.map((l) => [`${l.language}|${l.level}`, l._count]));
  const quizCounts = new Map(quizzes.map((q) => [`${q.language}|${q.level}`, q._count]));
  const goalCounts = new Map<string, number>();
  for (const t of topics) goalCounts.set(t.levelId, (goalCounts.get(t.levelId) ?? 0) + 1);

  const readyIds = new Set<string>();
  for (const lang of rows) {
    const status = levels.map((l) => ({
      goalCount: goalCounts.get(l.id) ?? 0,
      lessonCount: lessonCounts.get(`${lang.id}|${l.id}`) ?? 0,
      quizCount: quizCounts.get(`${lang.id}|${l.id}`) ?? 0,
    }));
    if (isLanguageReady(status)) readyIds.add(lang.id);
  }

  return rows
    .filter((r) => readyIds.has(r.id))
    .map((r) => ({
      id: r.id, name: r.name, native_name: r.nativeName, flag: r.flag,
      description: r.description, theme_class: r.themeClass, button_class: r.buttonClass,
      category: r.category, tts_lang_code: r.ttsLangCode, edge_tts_voice: r.edgeTtsVoice,
    }));
});

export async function getCurriculum(): Promise<CurriculumLevel[]> {
  const levels = await db.level.findMany({ orderBy: { orderIndex: "asc" } });
  const topics = await db.topic.findMany({ orderBy: { orderIndex: "asc" } });
  return levels.map((l) => ({
    level: l.id,
    title: l.title,
    description: l.description,
    base_reward_points: l.baseRewardPoints,
    topics: topics.filter((t) => t.levelId === l.id).map((t) => t.title),
  }));
}
