"use server";

import { getSession } from "../auth";
import { incrementMissionProgress } from "../mission";
import type { ActionResult } from "./types";

export async function incrementMissionAction(
  activityType: "lesson" | "quiz" | "weakness" | "flashcard"
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await incrementMissionProgress(session.email, activityType);
  return { message: "ok" };
}
