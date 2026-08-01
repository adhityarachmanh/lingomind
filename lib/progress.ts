import { db } from "./db";
import { getUserProfile } from "./profile";
import { getCurriculum } from "./dashboard";
import { incrementMissionProgress } from "./mission";
import { evaluateAndAwardBadges } from "./badges";
import type { UserProfile } from "./types";

export interface StreakInput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  streakFreezes: number;
  hasWeekendAmulet: boolean | null;
}

export interface StreakOutput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastActiveDate: Date;
}

function dayNumber(dt: Date): number {
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function computeStreakAfterActivity(input: StreakInput, now: Date): StreakOutput {
  const today = dayNumber(now);
  const last = input.lastActiveDate ? dayNumber(input.lastActiveDate) : null;
  const diff = last === null ? Number.POSITIVE_INFINITY : Math.round((today - last) / 86400000);
  const dow = now.getUTCDay(); // 0=Sunday, 1=Monday, 6=Saturday
  const amulet = input.hasWeekendAmulet === true;

  let current: number;
  let previous = input.previousStreak;
  let freezes = input.streakFreezes;

  if (last === null) {
    current = 1;
  } else if (diff <= 0) {
    current = input.currentStreak; // same day
  } else if (diff === 1) {
    current = input.currentStreak + 1;
  } else if (freezes >= diff - 1) {
    current = input.currentStreak + 1;
    freezes -= diff - 1;
  } else if (amulet && dow === 1 && diff <= 3) {
    current = input.currentStreak + 1; // Monday, weekend amulet
  } else if (amulet && dow === 0 && diff <= 2) {
    current = input.currentStreak + 1; // Sunday, weekend amulet
  } else {
    previous = input.currentStreak;
    current = 1;
  }

  const longest = Math.max(input.longestStreak, current);
  return { currentStreak: current, previousStreak: previous, longestStreak: longest, streakFreezes: freezes, lastActiveDate: new Date(today) };
}

export interface QuizOutcomeInput {
  baseLevel: string;
  topicIdx: number;
  topicsInLevel: number;
  playedTopicIdx: number;
  ptsPerQuestion: number;
  scoreGained: number;
}

export function computeQuizOutcome(input: QuizOutcomeInput): { passed: boolean; newTopicIdx: number } {
  const requiredScore = input.ptsPerQuestion * 5;
  const passed = input.scoreGained >= requiredScore && input.playedTopicIdx === input.topicIdx;
  let newTopicIdx = input.topicIdx;
  if (passed && input.topicIdx < input.topicsInLevel) {
    newTopicIdx += 1;
  }
  return { passed, newTopicIdx };
}

export async function applyQuizResult(
  email: string,
  language: string,
  goal: string,
  scoreGained: number
): Promise<UserProfile> {
  const profile = await getUserProfile(email);
  if (!profile) throw new Error("User tidak ditemukan");

  const currentLevel = profile.current_level[language] ?? "A1.0";
  const baseLevel = currentLevel.split(".")[0] || "A1";
  const topicIdx = Number(currentLevel.split(".")[1] ?? 0);

  const curriculum = await getCurriculum();
  const levelData = curriculum.find((c) => c.level === baseLevel);
  const ptsPerQuestion = levelData?.base_reward_points ?? 20;
  const topicsInLevel = levelData?.topics.length ?? 4;

  const playedTopicIdx = levelData
    ? levelData.topics.findIndex((t) => t === goal)
    : -1;

  const { passed, newTopicIdx } = computeQuizOutcome({
    baseLevel,
    topicIdx,
    topicsInLevel,
    playedTopicIdx,
    ptsPerQuestion,
    scoreGained,
  });

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const doubleXp = !!stats?.doubleXpUntil && stats.doubleXpUntil >= new Date();
  const actualDelta = doubleXp ? scoreGained * 2 : scoreGained;

  await db.$transaction([
    db.userProgressLog.create({
      data: {
        email,
        language,
        activityType: "quiz",
        topic: goal,
        scoreGained,
        passed,
        baseLevel,
        topicIdx,
      },
    }),
    db.userLanguageProgress.upsert({
      where: { email_languageId: { email, languageId: language } },
      create: { email, languageId: language, baseLevel, topicIdx: newTopicIdx },
      update: { baseLevel, topicIdx: newTopicIdx },
    }),
    db.user.update({
      where: { email },
      data: { score: { increment: actualDelta } },
    }),
  ]);

  await incrementMissionProgress(email, "quiz");
  const updated = await getUserProfile(email);
  if (!updated) throw new Error("User tidak ditemukan");
  return updated;
}

export async function updateEngagementAfterQuiz(email: string, points: number): Promise<void> {
  const cfg = await db.appConfig.findUnique({ where: { key: "quiz_completion_coins" } });
  const coinReward = cfg ? (parseInt(cfg.value, 10) || 10) : 10;

  const now = new Date();
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const doubleXp = !!stats?.doubleXpUntil && stats.doubleXpUntil >= now;
  const pointsEarned = doubleXp ? points * 2 : points;

  if (!stats) {
    await db.userEngagementStat.create({
      data: {
        email,
        currentStreak: 1,
        longestStreak: 1,
        totalQuizCompleted: 1,
        totalPointsEarned: pointsEarned,
        lastActiveDate: now,
        coins: coinReward,
        streakFreezes: 0,
        previousStreak: 0,
        examRetakeTickets: 0,
        hearts: 5,
      },
    });
  } else {
    const streak = computeStreakAfterActivity(
      {
        currentStreak: stats.currentStreak,
        previousStreak: stats.previousStreak,
        longestStreak: stats.longestStreak,
        lastActiveDate: stats.lastActiveDate,
        streakFreezes: stats.streakFreezes,
        hasWeekendAmulet: stats.hasWeekendAmulet,
      },
      now
    );

    await db.userEngagementStat.update({
      where: { email },
      data: {
        currentStreak: streak.currentStreak,
        previousStreak: streak.previousStreak,
        longestStreak: streak.longestStreak,
        streakFreezes: streak.streakFreezes,
        lastActiveDate: streak.lastActiveDate,
        totalQuizCompleted: { increment: 1 },
        totalPointsEarned: { increment: pointsEarned },
        coins: { increment: coinReward },
      },
    });
  }

  await evaluateAndAwardBadges(email).catch(() => {});
}

export async function deductHeart(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const now = new Date();
  if (!stats) {
    await db.userEngagementStat.create({
      data: { email, hearts: 4, lastHeartRefill: now },
    });
    return { hearts: 4 };
  }
  if (stats.hearts <= 0) return { hearts: 0 };
  const hearts = stats.hearts - 1;
  await db.userEngagementStat.update({
    where: { email },
    data: { hearts, lastHeartRefill: hearts === 4 ? now : stats.lastHeartRefill },
  });
  return { hearts };
}

export function computeAddHeart(currentHearts: number): number {
  return Math.min(5, currentHearts + 1);
}

export async function addHeart(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("Data user tidak ditemukan.");
  if (stats.hearts >= 5) throw new Error("Nyawa sudah penuh!");
  const hearts = computeAddHeart(stats.hearts);
  await db.userEngagementStat.update({
    where: { email },
    data: { hearts, lastHeartRefill: hearts === 5 ? null : stats.lastHeartRefill },
  });
  return { hearts };
}

export interface ExamOutcomeInput {
  correctCount: number;
  total: number;
  ptsPerQuestion: number;
}

export function computeExamOutcome(input: ExamOutcomeInput): { passingScore: number; passed: boolean; scoreGained: number } {
  const passingScore = Math.ceil(input.total * 0.75);
  return {
    passingScore,
    passed: input.correctCount >= passingScore,
    scoreGained: input.correctCount * input.ptsPerQuestion,
  };
}

export function nextLevelAfterExam(levels: string[], currentBase: string): string {
  const idx = levels.indexOf(currentBase);
  if (idx < 0 || idx >= levels.length - 1) return currentBase;
  return levels[idx + 1];
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function submitExamResult(
  email: string,
  language: string,
  passed: boolean,
  scoreGained: number
): Promise<UserProfile> {
  const profile = await getUserProfile(email);
  if (!profile) throw new Error("User tidak ditemukan");

  await incrementMissionProgress(email, "quiz");

  const currentLevel = profile.current_level[language] ?? "A1.0";
  const oldBase = currentLevel.split(".")[0] || "A1";
  const oldTopicIdx = Number(currentLevel.split(".")[1] ?? 0);

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const multiplier = stats?.doubleXpUntil && stats.doubleXpUntil >= new Date() ? 2 : 1;
  const actualScoreGained = scoreGained * multiplier;

  const curriculum = await getCurriculum();
  const levelData = curriculum.find((c) => c.level === oldBase);
  const topicsInLevel = levelData?.topics.length ?? 4;

  let newBase = oldBase;
  let newTopicIdx = oldTopicIdx;
  if (passed && oldTopicIdx >= topicsInLevel) {
    newTopicIdx = 0;
    newBase = nextLevelAfterExam(CEFR_ORDER, oldBase);
  }

  const now = new Date();
  await db.$transaction([
    db.userProgressLog.create({
      data: {
        email, language, activityType: "exam", topic: "Level Exam",
        scoreGained: actualScoreGained, passed, baseLevel: oldBase, topicIdx: oldTopicIdx,
      },
    }),
    db.userLanguageProgress.upsert({
      where: { email_languageId: { email, languageId: language } },
      create: {
        email, languageId: language, baseLevel: newBase, topicIdx: newTopicIdx,
        examCooldownUntil: passed ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
      update: {
        baseLevel: newBase, topicIdx: newTopicIdx,
        examCooldownUntil: passed ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    }),
    db.user.update({ where: { email }, data: { score: { increment: actualScoreGained } } }),
  ]);

  const updated = await getUserProfile(email);
  if (!updated) throw new Error("User tidak ditemukan");
  return updated;
}
