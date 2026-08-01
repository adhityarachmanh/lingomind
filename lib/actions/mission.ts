"use server";

import { getSession } from "../auth";
import { claimMissionReward, incrementMissionProgress } from "../mission";
import type { ActionResult } from "./types";

export async function incrementMissionAction(
  activityType: "lesson" | "quiz" | "weakness" | "flashcard"
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await incrementMissionProgress(session.email, activityType);
  return { message: "ok" };
}

export async function claimMissionRewardAction(tier: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    const message = await claimMissionReward(session.email, tier);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal klaim misi." };
  }
}
