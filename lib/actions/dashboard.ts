"use server";

import { getSession } from "../auth";
import { db } from "../db";
import type { ActionResult } from "./types";

export async function updatePreferredLanguageAction(languageId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const lang = await db.language.findMany();
  const found = lang.find((l) => l.id.toLowerCase() === languageId.trim().toLowerCase());
  if (!found) return { error: "Bahasa tidak valid." };

  await db.user.update({
    where: { email: session.email },
    data: { preferredLanguage: found.id },
  });
  return { message: "ok" };
}
