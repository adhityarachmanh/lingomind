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
  const session = await getSession();

  let ownedFrames: string[] = [];
  let ownedTitles: string[] = [];
  let ownedColors: string[] = [];
  if (session && session.email.toLowerCase() === email.toLowerCase()) {
    const inventory = await db.userInventory.findMany({ where: { email } });
    ownedFrames = inventory.filter((i) => i.itemType.startsWith("profile_frame_")).map((i) => i.itemValue);
    ownedTitles = inventory.filter((i) => i.itemType.startsWith("title_")).map((i) => i.itemValue);
    ownedColors = inventory.filter((i) => i.itemType.startsWith("name_color_")).map((i) => i.itemValue);
  }

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
    owned_frames: ownedFrames,
    owned_titles: ownedTitles,
    owned_colors: ownedColors,
  };
}

const FIELD_TO_ITEM_TYPE = {
  activeFrame: "profile_frame_",
  activeTitle: "title_",
  activeNameColor: "name_color_",
} as const;

function itemTypeFor(field: keyof typeof FIELD_TO_ITEM_TYPE, value: string): string {
  return `${FIELD_TO_ITEM_TYPE[field]}${value}`;
}

async function equip(
  field: "activeFrame" | "activeTitle" | "activeNameColor",
  value: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    if (value !== "") {
      const owned = await db.userInventory.findFirst({
        where: { email: session.email, itemType: itemTypeFor(field, value), itemValue: value },
      });
      if (!owned) return { error: "Anda belum memiliki item ini." };
    }
    await db.userEngagementStat.update({
      where: { email: session.email },
      data: { [field]: value === "" ? null : value },
    });
    return { message: "ok" };
  } catch {
    return { error: "Gagal menyimpan kosmetik." };
  }
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
