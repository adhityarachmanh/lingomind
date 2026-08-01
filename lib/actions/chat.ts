"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { fetchHistory, findOrCreateSession, normalizeSetting } from "../chat";
import { buildOpeningPrompt, buildReplySystemPrompt, generateChatReply } from "../ai-content/chat";
import { db } from "../db";
import type { ChatMessageItem } from "../types";

export async function getOrCreateChatSessionAction(
  goal: string,
  setting?: string
): Promise<{ sessionId: number; messages: ChatMessageItem[]; language: string; level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  let resolvedSetting: string;
  try {
    resolvedSetting = setting ? normalizeSetting(setting) : normalizeSetting(goal);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nama skenario tidak valid." };
  }

  const { sessionId, messages } = await findOrCreateSession(session.email, language, level, goal, resolvedSetting);

  if (messages.length === 0) {
    const isTopicBased = resolvedSetting === goal && goal !== "Bebas";
    const prompts = buildOpeningPrompt(language, level, goal, resolvedSetting, isTopicBased);
    let opening: string;
    try {
      opening = await generateChatReply({
        system: prompts.system,
        history: [],
        lastUserMessage: prompts.user,
        temperature: 0.8,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Gagal membuka sesi chat." };
    }
    await db.chatMessage.create({
      data: { sessionId, sender: "ai", content: opening },
    });
  }

  return { sessionId, messages: await fetchHistory(sessionId, 120), language, level };
}

export async function sendChatMessageAction(
  sessionId: number,
  message: string
): Promise<{ messages: ChatMessageItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!message.trim()) return { error: "Pesan tidak boleh kosong." };

  const chatSession = await db.chatSession.findFirst({ where: { id: sessionId, email: session.email } });
  if (!chatSession) return { error: "Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi." };

  await db.chatMessage.create({
    data: { sessionId, sender: "user", content: message.trim() },
  });

  const window = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = window.reverse().map((m) => ({ sender: m.sender as "user" | "ai", content: m.content }));

  const isTopicBased = chatSession.roleplaySetting === chatSession.goal && chatSession.goal !== "Bebas";
  const system = buildReplySystemPrompt(chatSession.language, chatSession.level, chatSession.goal, chatSession.roleplaySetting, isTopicBased);
  let reply: string;
  try {
    reply = await generateChatReply({ system, history, lastUserMessage: message.trim(), temperature: 0.7 });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim pesan." };
  }

  await db.chatMessage.create({
    data: { sessionId, sender: "ai", content: reply },
  });

  return { messages: await fetchHistory(sessionId, 120) };
}
