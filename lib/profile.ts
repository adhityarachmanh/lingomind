import { db } from "./db";
import type { UserProfile } from "./types";

export async function getUserProfile(email: string): Promise<UserProfile | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const progress = await db.userLanguageProgress.findMany({ where: { email } });
  const current_level: Record<string, string> = {};
  for (const p of progress) {
    current_level[p.languageId] = `${p.baseLevel}.${p.topicIdx}`;
  }

  return {
    email: user.email,
    full_name: user.fullName ?? "",
    preferred_language: user.preferredLanguage ?? "English",
    score: user.score ?? 0,
    current_level,
    role: user.role ?? "user",
  };
}
