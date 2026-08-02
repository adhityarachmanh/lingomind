import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { BattleItem } from "./types";

export function decideBattleWinner(myScore: number, opponentScore: number): "challenger" | "challenged" | "tie" {
  if (myScore > opponentScore) return "challenger";
  if (myScore < opponentScore) return "challenged";
  return "tie";
}

// normalisasi 0..100 agar perbandingan adil antar level (legacy: raw pts beda per level)
export function normalizeBattleScore(score: number, pts: number): number {
  const max = Math.max(1, pts * 5);
  return Math.round((Math.min(Math.max(0, score), max) / max) * 100);
}

export function decideBattleMessage(input: {
  amChallenger: boolean;
  bothPlayed: boolean;
  winner: "challenger" | "challenged" | "tie";
  amWinner: boolean;
}): string {
  const { amChallenger, bothPlayed, winner, amWinner } = input;
  if (!bothPlayed) {
    return amChallenger
      ? "Skor berhasil disimpan! Menunggu lawan menyelesaikan kuis."
      : "Skor berhasil disimpan!";
  }
  if (winner === "tie") return "Hasilnya SERI! Kalian berdua sama-sama hebat.";
  if (amWinner) return "Selamat! Anda menang dalam tantangan ini dan mendapat 50 Koin!";
  return "Anda kalah dalam tantangan ini. Coba lagi lain kali!";
}

export async function createBattle(
  challengerEmail: string,
  challengedEmail: string,
  language: string,
  goal: string
): Promise<void> {
  await db.quizBattle.create({
    data: { challengerEmail, challengedEmail, language, goal },
  });
}

export async function getActiveBattles(email: string): Promise<BattleItem[]> {
  const battles = await db.quizBattle.findMany({
    where: { OR: [{ challengerEmail: email }, { challengedEmail: email }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const oppEmails = battles.map((b) => (b.challengerEmail === email ? b.challengedEmail : b.challengerEmail));
  const users = await db.user.findMany({ where: { email: { in: oppEmails } } });
  const userMap = new Map(users.map((u) => [u.email, u]));
  return battles.map((b) => {
    const amChallenger = b.challengerEmail === email;
    return {
      id: b.id,
      challenger_email: b.challengerEmail,
      challenged_email: b.challengedEmail,
      language: b.language,
      goal: b.goal,
      status: b.status ?? "pending",
      my_score: amChallenger ? b.challengerScore : b.challengedScore,
      opponent_score: amChallenger ? b.challengedScore : b.challengerScore,
      opponent_name: userMap.get(amChallenger ? b.challengedEmail : b.challengerEmail)?.fullName ?? "",
      created_at: b.createdAt,
    };
  });
}

export async function submitBattleScore(battleId: number, email: string, score: number): Promise<string> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: number;
        status: string | null;
        challenger_email: string;
        challenged_email: string;
        challenger_score: number | null;
        challenged_score: number | null;
      }[]
    >(Prisma.sql`
      SELECT id, status, challenger_email, challenged_email, challenger_score, challenged_score
      FROM quiz_battles WHERE id = ${battleId} FOR UPDATE
    `);
    const battle = rows[0];
    if (!battle) throw new Error("Tantangan tidak ditemukan.");
    if (battle.status !== "pending") throw new Error("Tantangan sudah selesai atau dibatalkan.");
    const amChallenger = battle.challenger_email === email;
    const isParticipant = amChallenger || battle.challenged_email === email;
    if (!isParticipant) throw new Error("Anda tidak berpartisipasi dalam tantangan ini.");

    const opponentScore = amChallenger ? battle.challenged_score : battle.challenger_score;
    const bothPlayed = opponentScore !== null;

    await tx.quizBattle.update({
      where: { id: battleId },
      data: amChallenger ? { challengerScore: score } : { challengedScore: score },
    });

    if (!bothPlayed) {
      return decideBattleMessage({ amChallenger, bothPlayed: false, winner: "tie", amWinner: false });
    }

    const winner = decideBattleWinner(score, opponentScore ?? 0);
    const amWinner = amChallenger ? winner === "challenger" : winner === "challenged";
    const message = decideBattleMessage({ amChallenger, bothPlayed: true, winner, amWinner });

    await tx.quizBattle.update({ where: { id: battleId }, data: { status: "completed" } });
    if (winner !== "tie") {
      const winnerEmail = winner === "challenger" ? battle.challenger_email : battle.challenged_email;
      await tx.userEngagementStat
        .update({ where: { email: winnerEmail }, data: { coins: { increment: 50 } } })
        .catch(() => {});
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await tx.userDailyMission
        .upsert({
          where: { email_date: { email: winnerEmail, date: today } },
          create: { email: winnerEmail, date: today },
          update: {},
        })
        .catch(() => {});
      await tx.userDailyMission
        .update({
          where: { email_date: { email: winnerEmail, date: today } },
          data: { pvpWinsToday: { increment: 1 } },
        })
        .catch(() => {});
    }
    return message;
  });
}
