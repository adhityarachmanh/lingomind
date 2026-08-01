"use server";

import { generateText } from "ai";
import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { model } from "../ai";
import { buildPlacementPrompt, formatPlacementHistory, parseCefrLevel } from "../ai-content/placement";
import { db } from "../db";

export async function evaluatePlacementAction(
  messages: { role: string; text: string }[]
): Promise<{ level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const userCount = messages.filter((m) => m.role === "User").length;
  if (userCount < 3) return { error: "Percakapan belum cukup. Jawab minimal 3 pertanyaan." };

  const language = profile.preferred_language;
  const prompt = buildPlacementPrompt(language, formatPlacementHistory(messages));

  const { text } = await generateText({ model, prompt, maxOutputTokens: 8192 });
  const level = parseCefrLevel(text);

  await db.userLanguageProgress.upsert({
    where: { email_languageId: { email: session.email, languageId: language } },
    create: { email: session.email, languageId: language, baseLevel: level, topicIdx: 0, examCooldownUntil: null },
    update: { baseLevel: level, topicIdx: 0 },
  });

  return { level };
}
