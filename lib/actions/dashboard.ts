"use server";

import { getSession } from "../auth";
import { getLanguages } from "../dashboard";
import { db } from "../db";
import type { ActionResult } from "./types";

export async function updatePreferredLanguageAction(languageId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  // hanya bahasa dengan konten SIAP (pre-generated via panel admin) yang boleh dipilih
  const readyLanguages = await getLanguages();
  const found = readyLanguages.find((l) => l.id.toLowerCase() === languageId.trim().toLowerCase());
  if (!found) return { error: "Bahasa belum tersedia." };

  await db.user.update({
    where: { email: session.email },
    data: { preferredLanguage: found.id },
  });
  return { message: "ok" };
}
