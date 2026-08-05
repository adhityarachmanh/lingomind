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
  userId: string,
  language: string,
  scenarioId: string
): Promise<string | null> {
  const existing = await db.session.findFirst({
    where: { userId, scenarioId, endedAt: null },
  });
  if (existing) return existing.id;
  const level = "A1";
  const created = await db.session.create({
    data: { userId, language, level, scenarioId },
  });
  return created.id;
}

export async function sendPolyglotMessageAction(
  sessionId: string,
  userMessage: string
): Promise<ChatResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!userMessage.trim()) return { error: "Pesan tidak boleh kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!dbSession) return { error: "Percakapan tidak ditemukan." };
  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";
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
  const { instructions, messages } = buildPolyglotUserMessage(userMessage.trim(), language, level, scenario, aiMessages);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 4096, temperature: 0.7 });
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
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  await db.flashcard.create({
    data: { userId: user.id, frontText, backText, language },
  });
  return { message: "ok" };
}

export async function getFlashcardsAction(
  language: string
): Promise<{ cards: { id: string; frontText: string; backText: string }[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const cards = await db.flashcard.findMany({
    where: { userId: user.id, language },
    orderBy: { createdAt: "desc" },
  });
  return { cards: cards.map((c) => ({ id: c.id, frontText: c.frontText, backText: c.backText })) };
}

export async function endChatSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  await db.session.update({
    where: { id: sessionId, userId: user.id },
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
  scenarioId: string,
  language: string
): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const scenario = await db.scenario.findFirst({ where: { id: scenarioId, userId: user.id }, select: { title: true } });
  if (!scenario) return { error: "Akses ditolak." };

  const sessionId = await getOrCreateSession(user.id, language, scenarioId);
  if (!sessionId) return { error: "Pengguna tidak ditemukan." };

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const { instructions, messages } = buildPolyglotOpeningPrompt(language, level, scenario.title);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 2048, temperature: 0.8 });
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
      analysisJson: parsed as never,
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
