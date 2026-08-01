import { db } from "./db";

const COLUMN_BY_ACTIVITY = {
  lesson: "lessonsCompleted",
  quiz: "quizzesCompleted",
  weakness: "weaknessPracticesCompleted",
  flashcard: "flashcardsReviewed",
} as const;

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function incrementMissionProgress(
  email: string,
  activityType: "lesson" | "quiz" | "weakness" | "flashcard"
): Promise<void> {
  const column = COLUMN_BY_ACTIVITY[activityType];
  await db.userDailyMission.upsert({
    where: { email_date: { email, date: todayLocal() } },
    create: { email, date: todayLocal() },
    update: {},
  });
  // Prisma tidak bisa increment field dinamis; baca lalu set
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: todayLocal() } } });
  if (!row) return;
  await db.userDailyMission.update({
    where: { email_date: { email, date: todayLocal() } },
    data: { [column]: (row[column] ?? 0) + 1 },
  });
}

export async function incrementCorrectAnswers(email: string, count: number): Promise<void> {
  if (count <= 0) return;
  const today = todayLocal();
  await db.userDailyMission.upsert({
    where: { email_date: { email, date: today } },
    create: { email, date: today },
    update: {},
  });
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: today } } });
  if (!row) return;
  await db.userDailyMission.update({
    where: { email_date: { email, date: today } },
    data: { correctAnswersToday: (row.correctAnswersToday ?? 0) + count },
  });
}
