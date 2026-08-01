import { db } from "./db";
import type { BadgeItem } from "./types";

export interface BadgeStats {
  current_streak: number;
  total_quiz_completed: number;
  coins: number;
}

interface BadgeCandidate {
  id: number;
  requirement_type: string;
  requirement_value: number;
  name: string;
}

export function evaluateBadgeMatches(stats: BadgeStats, badges: BadgeCandidate[]): { id: number; name: string }[] {
  const earned: { id: number; name: string }[] = [];
  for (const b of badges) {
    let met = false;
    if (b.requirement_type === "quiz_completed") met = stats.total_quiz_completed >= b.requirement_value;
    else if (b.requirement_type === "streak") met = stats.current_streak >= b.requirement_value;
    else if (b.requirement_type === "coins") met = stats.coins >= b.requirement_value;
    if (met) earned.push({ id: b.id, name: b.name });
  }
  return earned;
}

export async function evaluateAndAwardBadges(email: string): Promise<void> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) return;

  const allBadges = await db.badge.findMany();
  const owned = await db.userBadge.findMany({ where: { email } });
  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const candidates = allBadges.filter((b) => !ownedIds.has(b.id)).map((b) => ({
    id: b.id,
    requirement_type: b.requirementType,
    requirement_value: b.requirementValue,
    name: b.name,
  }));

  const earned = evaluateBadgeMatches(
    { current_streak: stats.currentStreak, total_quiz_completed: stats.totalQuizCompleted, coins: stats.coins },
    candidates
  );

  if (earned.length === 0) return;

  for (const b of earned) {
    const created = await db.userBadge.create({ data: { email, badgeId: b.id } }).catch(() => null);
    if (created) {
      await db.socialFeed.create({
        data: { email, activityType: "badge_earned", content: `Mendapatkan lencana baru: ${b.name}!` },
      }).catch(() => {});
    }
  }
}

export async function getUserBadges(email: string): Promise<BadgeItem[]> {
  const rows = await db.userBadge.findMany({
    where: { email },
    orderBy: { earnedAt: "desc" },
    include: { badge: true },
  });
  return rows.map((r) => ({
    id: r.badge.id,
    name: r.badge.name,
    description: r.badge.description,
    icon_name: r.badge.iconName,
    requirement_type: r.badge.requirementType,
    requirement_value: r.badge.requirementValue,
  }));
}
