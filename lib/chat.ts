import { db } from "./db";
import type { ChatMessageItem } from "./types";

export function normalizeSetting(setting: string): string {
  const normalized = setting.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("Nama skenario tidak boleh kosong.");
  if (normalized.length > 50) throw new Error("Nama skenario maksimal 50 karakter.");
  return normalized;
}

export function splitKoreksi(content: string): { main: string; koreksi: string | null } {
  const idx = content.indexOf("Koreksi:");
  if (idx < 0) return { main: content, koreksi: null };
  return {
    main: content.slice(0, idx).trim(),
    koreksi: content.slice(idx + "Koreksi:".length).trim() || null,
  };
}

export async function fetchHistory(sessionId: number, limit: number): Promise<ChatMessageItem[]> {
  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((m) => ({ id: m.id, sender: (m.sender as "user" | "ai") ?? "user", content: m.content }));
}

export async function findOrCreateSession(
  email: string,
  language: string,
  level: string,
  goal: string,
  setting: string
): Promise<{ sessionId: number; messages: ChatMessageItem[] }> {
  const existing = await db.chatSession.findFirst({
    where: { email, language, level, goal, roleplaySetting: setting },
  });
  if (existing) {
    return { sessionId: existing.id, messages: await fetchHistory(existing.id, 120) };
  }
  const created = await db.chatSession.create({
    data: { email, language, level, goal, roleplaySetting: setting },
  });
  return { sessionId: created.id, messages: [] };
}
