import { db } from "./db";

// Interval re-review (hari) per level mastery 1..5 — makin mahir, makin lama interval (SRS untuk materi).
export const MASTERY_INTERVALS = [1, 3, 7, 14, 30] as const;

export interface GoalMastery {
  level: number; // 0..5 — lesson dibuka + quiz lulus per topik
  nextReviewAt: Date | null;
  reviewDue: boolean;
}

// Pure: hitung mastery per topik dari progress logs (lesson + quiz lulus). Dipakai roadmap & dashboard.
export function computeGoalMastery(
  logs: { topic: string; activityType: string; passed: boolean; createdAt: Date | null }[],
  now: Date = new Date()
): Map<string, GoalMastery> {
  const acc = new Map<string, { lessons: number; quizzes: number; lastAt: number | null }>();
  for (const l of logs) {
    if (!l.topic) continue;
    const a = acc.get(l.topic) ?? { lessons: 0, quizzes: 0, lastAt: null };
    if (l.activityType === "lesson") a.lessons += 1;
    else if (l.activityType === "quiz" && l.passed) a.quizzes += 1;
    if (l.createdAt) a.lastAt = Math.max(a.lastAt ?? 0, l.createdAt.getTime());
    acc.set(l.topic, a);
  }

  const out = new Map<string, GoalMastery>();
  for (const [topic, a] of acc) {
    const level = Math.min(5, a.lessons + a.quizzes);
    let nextReviewAt: Date | null = null;
    if (level > 0 && a.lastAt !== null) {
      nextReviewAt = new Date(a.lastAt + MASTERY_INTERVALS[level - 1] * 86400000);
    }
    out.set(topic, {
      level,
      nextReviewAt,
      reviewDue: level > 0 && nextReviewAt !== null && nextReviewAt.getTime() <= now.getTime(),
    });
  }
  return out;
}

export async function getGoalMastery(email: string, language: string): Promise<Map<string, GoalMastery>> {
  const logs = await db.userProgressLog.findMany({
    where: { email, language, activityType: { in: ["lesson", "quiz"] } },
    select: { topic: true, activityType: true, passed: true, createdAt: true },
  });
  return computeGoalMastery(logs);
}
