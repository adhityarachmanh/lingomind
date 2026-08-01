"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getFollowingLeaderboard, getGlobalLeaderboard, getWeeklyLeague } from "../leaderboard";
import { createBattle as createBattleRecord } from "../battle";
import { searchUsers, toggleFollow } from "../social";
import type { ActionResult } from "./types";
import type { LeaderboardRow, LeagueMemberRow, SearchUserRow } from "../types";

export async function getLeaderboardSummaryAction(): Promise<{
  weekly: { division: string; daysLeft: number; members: LeagueMemberRow[] } | null;
  global: LeaderboardRow[]; following: LeaderboardRow[];
} | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const weekly = await getWeeklyLeague(session.email).catch(() => null);
  const [global, following] = await Promise.all([
    getGlobalLeaderboard(10),
    getFollowingLeaderboard(session.email),
  ]);
  return { weekly, global, following };
}

export async function searchUsersAction(query: string): Promise<{ users: SearchUserRow[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const q = query.trim();
  if (q.length < 3) return { error: "Ketik minimal 3 huruf..." };
  const users = await searchUsers(q, session.email);
  return { users };
}

export async function toggleFollowAction(followedEmail: string, follow: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await toggleFollow(session.email, followedEmail, follow);
  return { message: "ok" };
}

export async function createBattleAction(challengedEmail: string, goal: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const g = goal.trim();
  if (!g) return { error: "Topik kuis tidak boleh kosong!" };
  await createBattleRecord(session.email, challengedEmail, profile.preferred_language, g);
  return { message: "Tantangan berhasil dikirim! Tutup jendela ini." };
}
