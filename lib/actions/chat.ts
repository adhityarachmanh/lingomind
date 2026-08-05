"use server";

import { generateText } from "ai";
import { model } from "../ai";
import { getSession } from "../auth";
import { db } from "../db";
import { buildPolyglotOpeningPrompt, buildPolyglotUserMessage } from "../ai-content/chat";
import { parseAiJson } from "../ai-content/parse";
import type { ActionResult } from "./types";

export interface PolyglotAnalysis {
  scores: { grammar: number; fluency: string };
  detailed_analysis: {
    original_segment: string;
    corrected_segment: string;
    rule: string;
    explanation_in_indonesian: string;
  }[];
  native_rephrasing: { formal: string; casual: string };
  vocab_highlight: { word_target: string; meaning_in_indonesian: string };
  reply_in_target_language: string;
  reply_translation_in_indonesian: string;
  suggested_replies?: string[];
}

export interface ChatResult {
  analysis: PolyglotAnalysis;
  sessionId: string;
  messageId: string;
}

async function getOrCreateSession(
  email: string,
  language: string,
  scenario: string
): Promise<string> {
  const existing = await db.session.findFirst({
    where: { userId: email, language, scenario, endedAt: null },
  });
  if (existing) return existing.id;
  const level = "A1";
  const created = await db.session.create({
    data: { userId: email, language, level, scenario },
  });
  return created.id;
}

export async function sendPolyglotMessageAction(
  scenario: string,
  language: string,
  userMessage: string
): Promise<ChatResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!userMessage.trim()) return { error: "Pesan tidak boleh kosong." };

  const email = session.email;
  const sessionId = await getOrCreateSession(email, language, scenario);

  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = history
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "ai" ? (m.analysisJson ? (m.analysisJson as unknown as { reply_in_target_language?: string }).reply_in_target_language : m.content) ?? "" : m.content ?? "",
    }))
    .filter((m) => m.content.trim() !== "");

  aiMessages.push({ role: "user", content: userMessage.trim() });

  const level = "A1";
  const { messages } = buildPolyglotUserMessage(userMessage.trim(), language, level, scenario, aiMessages);

  let text: string;
  try {
    const result = await generateText({ model, messages, maxOutputTokens: 4096, temperature: 0.7 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan balasan AI." };
  }

  const analysis = parseAiJson<PolyglotAnalysis>(text);
  if (!analysis || !analysis.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  await db.message.create({
    data: { sessionId, role: "user", content: userMessage.trim() },
  });
  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: analysis.reply_in_target_language,
      analysisJson: analysis as never,
    },
  });

  return { analysis, sessionId, messageId: aiMsg.id };
}

export async function saveFlashcardAction(
  frontText: string,
  backText: string,
  language: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await db.flashcard.create({
    data: { userId: session.email, frontText, backText, language },
  });
  return { message: "ok" };
}

export async function getFlashcardsAction(
  language: string
): Promise<{ cards: { id: string; frontText: string; backText: string }[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const cards = await db.flashcard.findMany({
    where: { userId: session.email, language },
    orderBy: { createdAt: "desc" },
  });
  return { cards: cards.map((c) => ({ id: c.id, frontText: c.frontText, backText: c.backText })) };
}

export async function endChatSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await db.session.update({
    where: { id: sessionId, userId: session.email },
    data: { endedAt: new Date() },
  });
  return { message: "ok" };
}

export interface OpenSessionResult {
  sessionId: string;
  messageId: string;
  reply: string;
  translation: string;
  suggestedReplies: string[];
}

export async function openSessionAction(
  scenario: string,
  language: string
): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const email = session.email;
  const sessionId = await getOrCreateSession(email, language, scenario);

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const { messages } = buildPolyglotOpeningPrompt(language, level, scenario);

  let text: string;
  try {
    const result = await generateText({ model, messages, maxOutputTokens: 2048, temperature: 0.8 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan pembuka percakapan." };
  }

  const parsed = parseAiJson<{
    reply_in_target_language?: string;
    reply_translation_in_indonesian?: string;
    suggested_replies?: string[];
  }>(text);

  if (!parsed || !parsed.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: parsed.reply_in_target_language,
    },
  });

  return {
    sessionId,
    messageId: aiMsg.id,
    reply: parsed.reply_in_target_language,
    translation: parsed.reply_translation_in_indonesian ?? "",
    suggestedReplies: Array.isArray(parsed.suggested_replies) ? parsed.suggested_replies.slice(0, 3) : [],
  };
}
