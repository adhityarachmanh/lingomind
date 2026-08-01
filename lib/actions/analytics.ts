"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getSkillProgress7d, getWeaknessAnalytics } from "../weakness";
import type { SkillProgressPoint, WeaknessAnalyticsItem } from "../types";

export async function getAnalyticsAction(): Promise<{ weakness: WeaknessAnalyticsItem[]; skills: SkillProgressPoint[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const [weakness, skills] = await Promise.all([
    getWeaknessAnalytics(session.email, language, 8),
    getSkillProgress7d(session.email, language),
  ]);
  return { weakness, skills };
}
