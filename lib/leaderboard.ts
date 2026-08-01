import { db } from "./db";
import type { LeaderboardRow, LeagueMemberRow } from "./types";

const DIVISIONS = ["Bronze", "Silver", "Gold", "Diamond"];

export function weekStartOf(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // 1=Senin..7=Minggu
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d;
}

export function daysLeftInWeek(now: Date): number {
  const isoDow = ((now.getUTCDay() + 6) % 7) + 1;
  return 7 - isoDow;
}

export function decideNextDivision(prevIdx: number | null, prevRank: number | null): number {
  if (prevIdx === null || prevRank === null) return 0;
  if (prevRank <= 5) return Math.min(3, prevIdx + 1);
  if (prevRank >= 26) return Math.max(0, prevIdx - 1);
  return prevIdx;
}

export async function getWeeklyLeague(
  email: string,
  now: Date = new Date()
): Promise<{ division: string; daysLeft: number; members: LeagueMemberRow[] }> {
  const weekStart = weekStartOf(now);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
  const daysLeft = daysLeftInWeek(now);

  const existing = await db.userLeagueMember.findFirst({
    where: { email },
    include: { group: true },
  });
  let groupId: number;
  let division: string;

  if (existing && existing.group.weekStartDate.getTime() === weekStart.getTime()) {
    groupId = existing.groupId;
    division = existing.group.division;
  } else {
    const assigned = await db.$transaction(async (tx) => {
      let nextDivisionIdx = 0;
      const prev = await tx.$queryRaw<{ division: string; rnk: number }[]>`
        WITH RankedMembers AS (
          SELECT m.email, m.group_id, g.division,
                 ROW_NUMBER() OVER(PARTITION BY m.group_id ORDER BY m.league_score DESC) as rnk
          FROM user_league_members m
          JOIN league_groups g ON m.group_id = g.id
          WHERE m.email = ${email} AND g.week_start_date = ${prevWeekStart}
        )
        SELECT division, rnk FROM RankedMembers LIMIT 1`;
      if (prev.length > 0) {
        const prevIdx = DIVISIONS.indexOf(prev[0].division);
        nextDivisionIdx = decideNextDivision(prevIdx >= 0 ? prevIdx : null, prev[0].rnk);
      }
      const divisionName = DIVISIONS[nextDivisionIdx];

      const groups = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM league_groups
        WHERE division = ${divisionName} AND week_start_date = ${weekStart} AND member_count < 30
        LIMIT 1 FOR UPDATE`;

      let gid: number;
      if (groups.length > 0) {
        gid = groups[0].id;
        await tx.leagueGroup.update({ where: { id: gid }, data: { memberCount: { increment: 1 } } });
      } else {
        const created = await tx.leagueGroup.create({
          data: { division: divisionName, weekStartDate: weekStart, memberCount: 1 },
        });
        gid = created.id;
      }
      await tx.userLeagueMember.create({ data: { email, groupId: gid, leagueScore: 0 } });
      return { gid, divisionName };
    });
    groupId = assigned.gid;
    division = assigned.divisionName;
  }

  const rows = await db.userLeagueMember.findMany({
    where: { groupId },
    orderBy: { leagueScore: "desc" },
    include: { user: { select: { fullName: true } } },
  });
  const emails = rows.map((r) => r.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));

  const members: LeagueMemberRow[] = rows.map((r, i) => {
    const rank = i + 1;
    const stats = statsMap.get(r.email);
    return {
      email: r.email,
      full_name: r.user.fullName ?? "",
      league_score: r.leagueScore ?? 0,
      active_frame: stats?.activeFrame ?? null,
      active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null,
      rank,
      zone: rank <= 5 ? "promosi" : rank >= 26 ? "degradasi" : "aman",
    };
  });

  return { division, daysLeft, members };
}

export async function getGlobalLeaderboard(limit: number): Promise<LeaderboardRow[]> {
  const safeLimit = Math.min(Math.max(limit, 10), 100);
  const users = await db.user.findMany({
    where: { role: { not: "admin" } },
    orderBy: { score: "desc" },
    take: safeLimit,
  });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
    };
  });
}

export async function getFollowingLeaderboard(email: string): Promise<LeaderboardRow[]> {
  const following = await db.follower.findMany({ where: { followerEmail: email } });
  const emails = [email, ...following.map((f) => f.followedEmail)];
  const users = await db.user.findMany({
    where: { email: { in: emails }, role: { not: "admin" } },
    orderBy: { score: "desc" },
  });
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
    };
  });
}
