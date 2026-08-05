"use server";

import { getSession } from "../auth";
import { db } from "../db";
import { trimPreview } from "../chat-utils";
import { SCENARIO_TEMPLATES } from "../templates";
import type { ActionResult } from "./types";

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  language: string;
  createdAt: Date;
  lastActivityAt: Date | null;
  hasActiveSession: boolean;
}

export interface SessionSummary {
  id: string;
  scenarioTitle: string;
  language: string;
  lastMessagePreview: string;
  messageCount: number;
  updatedAt: Date;
  active: boolean;
}

export async function createScenarioAction(input: {
  templateId?: string;
  title: string;
  description: string;
  language: string;
}): Promise<{ scenarioId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const title = input.title.trim();
  if (!title) return { error: "Judul skenario wajib diisi." };
  const language = input.language.trim();
  if (!language) return { error: "Pilih bahasa target." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const template = SCENARIO_TEMPLATES.find((t) => t.id === input.templateId);
  const scenario = await db.scenario.create({
    data: {
      userId: user.id,
      title,
      description: input.description.trim(),
      language,
      templateId: template?.id ?? null,
    },
  });
  return { scenarioId: scenario.id };
}

export async function getChatHomeAction(): Promise<{ scenarios: ScenarioSummary[]; history: SessionSummary[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };

  const scenarioRows = await db.scenario.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const sessionRows = await db.session.findMany({
    where: { userId: user.id, scenarioId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      scenario: { select: { title: true, language: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });

  const history: SessionSummary[] = sessionRows.map((s) => ({
    id: s.id,
    scenarioTitle: s.scenario?.title ?? "Percakapan",
    language: s.scenario?.language ?? s.language,
    lastMessagePreview: trimPreview(s.messages[0]?.content),
    messageCount: s._count.messages,
    updatedAt: s.messages[0]?.createdAt ?? s.createdAt,
    active: s.endedAt === null,
  }));

  const scenarios: ScenarioSummary[] = scenarioRows.map((sc) => {
    const scSessions = sessionRows.filter((s) => s.scenarioId === sc.id);
    const last = scSessions[0] ?? null;
    return {
      id: sc.id,
      title: sc.title,
      description: sc.description,
      language: sc.language,
      createdAt: sc.createdAt,
      lastActivityAt: last ? (last.messages[0]?.createdAt ?? last.createdAt) : null,
      hasActiveSession: scSessions.some((s) => s.endedAt === null),
    };
  });

  return { scenarios, history };
}

export interface ChatMessageDto {
  id: string;
  role: "user" | "ai";
  content: string;
  analysisJson: unknown;
  createdAt: Date;
}

export interface SessionDto {
  id: string;
  scenarioTitle: string;
  language: string;
  active: boolean;
}

export async function getSessionMessagesAction(sessionId: string): Promise<{ session: SessionDto; messages: ChatMessageDto[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const s = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!s) return { error: "Percakapan tidak ditemukan." };
  const messages = await db.message.findMany({
    where: { sessionId: s.id },
    orderBy: { createdAt: "asc" },
  });
  return {
    session: {
      id: s.id,
      scenarioTitle: s.scenario?.title ?? "Percakapan",
      language: s.scenario?.language ?? s.language,
      active: s.endedAt === null,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "ai",
      content: m.content ?? "",
      analysisJson: m.analysisJson,
      createdAt: m.createdAt,
    })),
  };
}

export async function resumeSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return { error: "Akses ditolak." };
  await db.session.update({ where: { id: existing.id }, data: { endedAt: null } });
  return { message: "ok" };
}

export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return { error: "Akses ditolak." };
  await db.session.delete({ where: { id: existing.id } });
  return { message: "ok" };
}

export async function clearChatHistoryAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  await db.session.deleteMany({ where: { userId: user.id, scenarioId: { not: null } } });
  return { message: "ok" };
}
