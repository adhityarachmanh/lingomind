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

export interface TierDecision {
  ok: boolean;
  rewardCoins?: number;
  error?: string;
  message?: string;
  bonus?: "streak_freeze" | "double_xp";
}

export function decideTierRequirement(
  row: {
    quizzesCompleted: number;
    correctAnswersToday: number;
    pvpWinsToday: number;
    tier1Claimed: boolean;
    tier2Claimed: boolean;
    tier3Claimed: boolean;
  },
  tier: number
): TierDecision {
  if (tier === 1) {
    if (row.quizzesCompleted < 1) return { ok: false, error: "Selesaikan 1 Kuis terlebih dahulu!" };
    if (row.tier1Claimed) return { ok: false, error: "Peti Kayu sudah diklaim!" };
    return { ok: true, rewardCoins: 20, message: "Berhasil membuka Peti Kayu! Dapat 20 koin." };
  }
  if (tier === 2) {
    if (row.correctAnswersToday < 50) return { ok: false, error: "Jawab 50 pertanyaan dengan benar terlebih dahulu!" };
    if (row.tier2Claimed) return { ok: false, error: "Peti Perak sudah diklaim!" };
    return { ok: true, rewardCoins: 50, message: "Berhasil membuka Peti Perak! Dapat 50 koin." };
  }
  if (tier === 3) {
    if (row.pvpWinsToday < 3) return { ok: false, error: "Menangkan 3 PvP Battle terlebih dahulu!" };
    if (row.tier3Claimed) return { ok: false, error: "Peti Emas sudah diklaim!" };
    return { ok: true, rewardCoins: 100, message: "Berhasil membuka Peti Emas! Dapat 100 koin + Hadiah Misteri!", bonus: "double_xp" };
  }
  return { ok: false, error: "Tier tidak valid" };
}

export function decideMissionMysteryRoll(roll: number): "streak_freeze" | "double_xp" {
  return roll <= 50 ? "streak_freeze" : "double_xp";
}

export async function claimMissionReward(email: string, tier: number): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: today } } });
  if (!row) throw new Error("Misi belum dimulai");

  const decision = decideTierRequirement(
    {
      quizzesCompleted: row.quizzesCompleted ?? 0,
      correctAnswersToday: row.correctAnswersToday ?? 0,
      pvpWinsToday: row.pvpWinsToday ?? 0,
      tier1Claimed: row.tier1Claimed ?? false,
      tier2Claimed: row.tier2Claimed ?? false,
      tier3Claimed: row.tier3Claimed ?? false,
    },
    tier
  );
  if (!decision.ok) throw new Error(decision.error ?? "Tier tidak valid");

  const claimedField = tier === 1 ? "tier1Claimed" : tier === 2 ? "tier2Claimed" : "tier3Claimed";

  return db.$transaction(async (tx) => {
    const updated = await tx.userDailyMission.updateMany({
      where: { email, date: today, [claimedField]: false },
      data: { [claimedField]: true },
    });
    if (updated.count === 0) throw new Error("sudah diklaim");

    await tx.userEngagementStat.update({ where: { email }, data: { coins: { increment: decision.rewardCoins ?? 0 } } });

    let message = decision.message ?? "Berhasil!";
    if (decision.bonus && tier === 3) {
      const roll = Math.floor(Math.random() * 100) + 1;
      const bonus = decideMissionMysteryRoll(roll);
      if (bonus === "streak_freeze") {
        await tx.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
        message = `${message} Bonus: 1 Streak Freeze!`;
      } else {
        await tx.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(Date.now() + 3600000) } });
        message = `${message} Bonus: Double XP 1 Jam!`;
      }
    }
    return message;
  });
}
