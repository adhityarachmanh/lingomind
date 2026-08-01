"use server";

import { getSession } from "../auth";
import { getActiveBattles, submitBattleScore } from "../battle";
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
  try {
    const message = await submitBattleScore(battleId, session.email, score);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim skor tantangan." };
  }
}
