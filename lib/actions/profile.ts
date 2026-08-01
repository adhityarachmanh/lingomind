"use server";

import { getSession } from "../auth";
import { getUserBadges } from "../badges";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { PublicProfile } from "../types";

export async function getPublicProfileAction(email: string): Promise<PublicProfile | { error: string }> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Pengguna tidak ditemukan" };

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const badges = await getUserBadges(email);

  return {
    email: user.email,
    full_name: user.fullName ?? "",
    score: user.score ?? 0,
    current_streak: stats?.currentStreak ?? 0,
    longest_streak: stats?.longestStreak ?? 0,
    active_frame: stats?.activeFrame ?? null,
    active_title: stats?.activeTitle ?? null,
    active_name_color: stats?.activeNameColor ?? null,
    joined_date: "Member",
    badges,
  };
}

async function equip(
  field: "activeFrame" | "activeTitle" | "activeNameColor",
  value: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await db.userEngagementStat.update({
    where: { email: session.email },
    data: { [field]: value === "" ? null : value },
  });
  return { message: "ok" };
}

export async function equipFrameAction(value: string): Promise<ActionResult> {
  return equip("activeFrame", value);
}
export async function equipTitleAction(value: string): Promise<ActionResult> {
  return equip("activeTitle", value);
}
export async function equipColorAction(value: string): Promise<ActionResult> {
  return equip("activeNameColor", value);
}
