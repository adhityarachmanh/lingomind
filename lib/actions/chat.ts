"use server";

import { generateText } from "ai";
import { model } from "../ai";
import { getSession } from "../auth";
import { db } from "../db";
import { buildGeneralOpeningPrompt, buildGeneralStreamPrompt, buildPolyglotOpeningPrompt, buildPolyglotUserMessage } from "../ai-content/chat";
import { parseAiJson } from "../ai-content/parse";
import { mapHistoryToAiMessages, normalizeSuggestedReplies, type SuggestedReply } from "../chat-helpers";
import type { ActionResult } from "./types";

export interface PolyglotAnalysis {
  scores: { grammar: number; fluency: string };
  detailed_analysis: {
    original_segment: string;
    corrected_segment: string;
    corrected_romanization?: string;
    rule: string;
    explanation_in_indonesian: string;
  }[];
  native_rephrasing: {
    formal: string;
    formal_meaning_in_indonesian: string;
    formal_romanization?: string;
    casual: string;
    casual_meaning_in_indonesian: string;
    casual_romanization?: string;
  };
  vocab_highlight: {
    word_target: string;
    meaning_in_indonesian: string;
    romanization?: string;
  };
  reply_in_target_language: string;
  reply_translation_in_indonesian: string;
  reply_romanization?: string;
  suggested_replies?: SuggestedReply[];
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
    where: { userId, scenarioId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (existing.endedAt !== null) {
      await db.session.update({ where: { id: existing.id }, data: { endedAt: null } });
    }
    return existing.id;
  }
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
    include: { scenario: { select: { title: true, language: true, type: true } } },
  });
  if (!dbSession) return { error: "Percakapan tidak ditemukan." };
  if (dbSession.scenario?.type === "general") return { error: "Mode skenario tidak didukung." };
  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";
  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = mapHistoryToAiMessages(history);
  const trailingUserPopped =
    aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user";
  if (trailingUserPopped) {
    aiMessages.pop();
  }

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

  if (!trailingUserPopped) {
    await db.message.create({
      data: { sessionId, role: "user", content: userMessage.trim() },
    });
  }
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

export interface FlashcardDto {
  id: string;
  frontText: string;
  backText: string;
  language: string;
  createdAt: Date;
}

export async function getAllFlashcardsAction(): Promise<{ cards: FlashcardDto[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const cards = await db.flashcard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return {
    cards: cards.map((c) => ({
      id: c.id,
      frontText: c.frontText,
      backText: c.backText,
      language: c.language,
      createdAt: c.createdAt,
    })),
  };
}

export async function deleteFlashcardAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.flashcard.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Akses ditolak." };
  await db.flashcard.delete({ where: { id: existing.id } });
  return { message: "ok" };
}

export interface OpenSessionResult {
  sessionId: string;
  messageId: string;
  reply: string;
  translation: string;
  suggestedReplies: SuggestedReply[];
}

export async function openSessionAction(
  scenarioId: string,
  language: string
): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const scenario = await db.scenario.findFirst({
    where: { id: scenarioId, userId: user.id },
    select: { title: true, description: true, type: true },
  });
  if (!scenario) return { error: "Akses ditolak." };
  const isGeneral = scenario.type === "general";

  const sessionId = await getOrCreateSession(user.id, language, scenarioId);
  if (!sessionId) return { error: "Pengguna tidak ditemukan." };

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const role = scenario.title;
  const context = scenario.description ? `${scenario.title} — ${scenario.description}` : scenario.title;
  const { instructions, messages } = isGeneral
    ? buildGeneralOpeningPrompt(role, context)
    : buildPolyglotOpeningPrompt(language, level, scenario.title);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 2048, temperature: 0.8 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan pembuka percakapan." };
  }

  const parsed = isGeneral
    ? { reply_in_target_language: text }
    : parseAiJson<{ reply_in_target_language?: string; reply_translation_in_indonesian?: string; suggested_replies?: unknown }>(text);

  if (!parsed || !parsed.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: parsed.reply_in_target_language,
      analysisJson: isGeneral ? undefined : (parsed as never),
    },
  });

  return {
    sessionId,
    messageId: aiMsg.id,
    reply: parsed.reply_in_target_language,
    translation: isGeneral ? "" : (parsed.reply_translation_in_indonesian ?? ""),
    suggestedReplies: isGeneral ? [] : normalizeSuggestedReplies(parsed.suggested_replies).slice(0, 3),
  };
}

export interface AnalyzeResult {
  messageId: string;
  analysis: PolyglotAnalysis;
}

export async function analyzeChatMessageAction(
  sessionId: string,
  userMessage: string,
  streamedReply: string,
  streamedRomanization?: string
): Promise<AnalyzeResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!streamedReply.trim()) return { error: "Balasan kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true, type: true } } },
  });
  if (!dbSession) return { error: "Akses ditolak." };
  if (dbSession.scenario?.type === "general") return { error: "Mode skenario tidak didukung." };

  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";

  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = mapHistoryToAiMessages(history);
  if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user") {
    aiMessages.pop();
  }

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

  if (streamedRomanization) {
    analysis.reply_romanization = streamedRomanization;
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: streamedReply.trim(),
      analysisJson: analysis as never,
    },
  });

  return { messageId: aiMsg.id, analysis };
}

export async function saveStreamedMessageAction(
  sessionId: string,
  content: string
): Promise<{ messageId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!content.trim()) return { error: "Balasan kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!dbSession) return { error: "Akses ditolak." };
  const aiMsg = await db.message.create({
    data: { sessionId, role: "ai", content: content.trim() },
  });
  return { messageId: aiMsg.id };
}

export async function sendGeneralMessageAction(
  sessionId: string,
  userMessage: string
): Promise<{ messageId: string; reply: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!userMessage.trim()) return { error: "Pesan tidak boleh kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, description: true, type: true } } },
  });
  if (!dbSession) return { error: "Akses ditolak." };
  if (dbSession.scenario?.type !== "general") {
    return { error: "Mode skenario tidak didukung." };
  }

  const role = dbSession.scenario?.title ?? "Asisten";
  const context = dbSession.scenario?.description
    ? `${dbSession.scenario.title} — ${dbSession.scenario.description}`
    : dbSession.scenario?.title ?? "Percakapan";

  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = mapHistoryToAiMessages(history);
  const trailingUserPopped =
    aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user";
  if (trailingUserPopped) {
    aiMessages.pop();
  }

  const { instructions, messages } = buildGeneralStreamPrompt(role, context, userMessage.trim(), aiMessages);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 2048, temperature: 0.7 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan balasan AI." };
  }
  if (!text) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  if (!trailingUserPopped) {
    await db.message.create({
      data: { sessionId, role: "user", content: userMessage.trim() },
    });
  }
  const aiMsg = await db.message.create({
    data: { sessionId, role: "ai", content: text },
  });

  return { messageId: aiMsg.id, reply: text };
}

