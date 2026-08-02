"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getCurriculum } from "../dashboard";
import { getActiveBattles, normalizeBattleScore, submitBattleScore } from "../battle";
import type { ActionResult } from "./types";
import type { BattleItem } from "../types";

export async function getActiveBattlesAction(): Promise<{ battles: BattleItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  return { battles: await getActiveBattles(session.email) };
}

export async function submitBattleScoreAction(battleId: number, score: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const language = profile.preferred_language;
  const baseLevel = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const curriculum = await getCurriculum();
  const pts = curriculum.find((c) => c.level === baseLevel)?.base_reward_points ?? 10;
  const clampedScore = Math.min(Math.max(0, score), pts * 5);
  const normalized = normalizeBattleScore(clampedScore, pts);
  try {
    const message = await submitBattleScore(battleId, session.email, normalized);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim skor tantangan." };
  }
}
