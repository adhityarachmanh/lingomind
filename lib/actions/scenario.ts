"use server";

import { getSession } from "../auth";
import { db } from "../db";
import { trimPreview } from "../chat-utils";
import { SCENARIO_TEMPLATES, type ScenarioType } from "../templates";
import { LANGUAGES } from "../languages";
import type { ActionResult } from "./types";

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  language: string;
  level: string;
  type: ScenarioType;
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

const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function createScenarioAction(input: {
  templateId?: string;
  title: string;
  description: string;
  language: string;
  level: string;
  type: ScenarioType;
}): Promise<{ scenarioId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const title = input.title.trim();
  if (!title) return { error: "Judul skenario wajib diisi." };
  const language = input.language.trim();
  const type = input.type === "general" ? "general" : "language";
  const level = VALID_LEVELS.includes(input.level) ? input.level : "A1";
  if (type !== "general" && !LANGUAGES.some((l) => l.id === language)) return { error: "Pilih bahasa target." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const template = SCENARIO_TEMPLATES.find((t) => t.id === input.templateId);
  if (template && template.type !== type) return { error: "Template tidak cocok dengan jenis skenario." };
  if (template) {
    const existing = type === "general"
      ? await db.scenario.findFirst({ where: { userId: user.id, templateId: template.id, type: "general" } })
      : await db.scenario.findFirst({ where: { userId: user.id, templateId: template.id, language } });
    if (existing) {
      return { error: type === "general" ? "Skenario dengan template ini sudah ada." : "Skenario dengan template dan bahasa ini sudah ada." };
    }
  }
  const scenario = await db.scenario.create({
    data: {
      userId: user.id,
      title,
      description: input.description.trim(),
      language,
      level,
      templateId: template?.id ?? null,
      type,
    },
  });
  return { scenarioId: scenario.id };
}

export async function updateScenarioAction(
  id: string,
  input: { title: string; description: string; level: string }
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const scenario = await db.scenario.findFirst({ where: { id, userId: user.id } });
  if (!scenario) return { error: "Akses ditolak." };
  const title = input.title.trim();
  if (!title) return { error: "Judul skenario wajib diisi." };
  await db.scenario.update({
    where: { id: scenario.id },
    data: {
      title,
      description: input.description.trim(),
      level: scenario.type === "general" ? scenario.level : VALID_LEVELS.includes(input.level) ? input.level : scenario.level,
    },
  });
  return { message: "ok" };
}

export async function getScenarioTemplatesUsedAction(): Promise<
  { used: { templateId: string | null; language: string }[] } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const scenarios = await db.scenario.findMany({
    where: { userId: user.id },
    select: { templateId: true, language: true },
  });
  return { used: scenarios.map((s) => ({ templateId: s.templateId, language: s.language })) };
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
      scenario: { select: { title: true, language: true, level: true, type: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });

  sessionRows.sort((a, b) => (b.messages[0]?.createdAt ?? b.createdAt).getTime() - (a.messages[0]?.createdAt ?? a.createdAt).getTime());

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
      level: sc.level,
      type: sc.type as ScenarioType,
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
  level: string;
  type: ScenarioType;
  active: boolean;
}

export async function getSessionMessagesAction(sessionId: string): Promise<{ session: SessionDto; messages: ChatMessageDto[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const s = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true, level: true, type: true } } },
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
      level: s.scenario?.level ?? s.level,
      type: (s.scenario?.type as ScenarioType | undefined) ?? "language",
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
