import { db } from "./db";

const GRAMMAR_TENSE_KEYWORDS = ["tense", "past", "present", "future"];
const GRAMMAR_PREPOSITION_KEYWORDS = ["preposition", " in ", " on ", " at "];
const GRAMMAR_ARTICLE_KEYWORDS = ["article", " a ", " an ", " the "];
const VOCABULARY_KEYWORDS = ["vocabulary", "word choice"];
const SKILL_LISTENING = ["pengucapan", "pendengaran", "suara"];
const SKILL_VOCABULARY = ["kosakata", "arti kata", "sinonim", "terjemahan", "makna", "kata ini"];

// Topik kelemahan dari classifier — dipakai pre-gen pool latihan kelemahan (scripts/generate-weakness-pool.ts).
export const WEAKNESS_TOPICS = [
  "Grammar: Tense",
  "Grammar: Preposition",
  "Grammar: Article",
  "Vocabulary: Word Choice",
  "General: Answer Accuracy",
] as const;

function hasWord(text: string, keyword: string): boolean {
  return new RegExp(`\\b${keyword.trim()}\\b`).test(text);
}

export function classifyWeaknessTopic(explanation: string): string {
  const e = explanation.toLowerCase();
  if (GRAMMAR_TENSE_KEYWORDS.some((k) => hasWord(e, k))) return "Grammar: Tense";
  if (GRAMMAR_PREPOSITION_KEYWORDS.some((k) => hasWord(e, k))) return "Grammar: Preposition";
  if (GRAMMAR_ARTICLE_KEYWORDS.some((k) => hasWord(e, k))) return "Grammar: Article";
  if (VOCABULARY_KEYWORDS.some((k) => hasWord(e, k))) return "Vocabulary: Word Choice";
  return "General: Answer Accuracy";
}

export function classifySkill(
  question: string,
  explanation: string,
  questionType: string
): "listening" | "vocabulary" | "grammar" {
  const text = `${question} ${explanation}`.toLowerCase();
  if (questionType === "listening") return "listening";
  if (SKILL_LISTENING.some((k) => text.includes(k))) return "listening";
  if (SKILL_VOCABULARY.some((k) => text.includes(k))) return "vocabulary";
  return "grammar";
}

export async function logWeakness(email: string, language: string, topic: string, note: string): Promise<void> {
  if (!topic.trim() || !note.trim()) return;
  await db.weaknessLog.create({ data: { email, language, topic, note } });
}

export async function logSkillProgress(email: string, language: string, skill: string, isCorrect: boolean): Promise<void> {
  const s = skill.toLowerCase();
  if (!["grammar", "vocabulary", "listening"].includes(s)) return;
  await db.skillProgressLog.create({ data: { email, language, skill: s, isCorrect } });
}

export async function getTopWeaknesses(email: string, language: string, limit: number): Promise<{ topic: string; count: number }[]> {
  const safeLimit = limit <= 0 ? 3 : Math.min(limit, 10);
  const rows = await db.weaknessLog.groupBy({
    by: ["topic"],
    where: { email, language },
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: safeLimit,
  });
  return rows.map((r) => ({ topic: r.topic, count: r._count.topic }));
}

export async function getPriorityWeakness(email: string, language: string): Promise<string | null> {
  const rows = await db.weaknessLog.groupBy({
    by: ["topic"],
    where: { email, language },
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: 1,
  });
  return rows[0]?.topic ?? null;
}

import type { SkillProgressPoint, WeaknessAnalyticsItem } from "./types";

export async function getWeaknessAnalytics(email: string, language: string, limit: number): Promise<WeaknessAnalyticsItem[]> {
  const safeLimit = limit <= 0 ? 8 : Math.min(limit, 20);
  // Prisma groupBy tidak mendukung COUNT FILTER per rentang — ambil data 30 hari lalu hitung di JS
  const since7 = new Date(Date.now() - 7 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const logs = await db.weaknessLog.findMany({
    where: { email, language, createdAt: { gte: since30 } },
    select: { topic: true, createdAt: true },
  });
  const map = new Map<string, WeaknessAnalyticsItem>();
  for (const l of logs) {
    const item = map.get(l.topic) ?? { topic: l.topic, count_7d: 0, count_30d: 0 };
    if (l.createdAt && l.createdAt >= since7) item.count_7d += 1;
    if (l.createdAt && l.createdAt >= since30) item.count_30d += 1;
    map.set(l.topic, item);
  }
  return [...map.values()]
    .sort((a, b) => b.count_30d - a.count_30d || b.count_7d - a.count_7d)
    .slice(0, safeLimit);
}

export async function getSkillProgress7d(email: string, language: string): Promise<SkillProgressPoint[]> {
  const since = new Date(Date.now() - 7 * 86400000);
  const logs = await db.skillProgressLog.findMany({
    where: { email, language, createdAt: { gte: since } },
    select: { skill: true, isCorrect: true, createdAt: true },
  });
  const map = new Map<string, SkillProgressPoint>();
  for (const l of logs) {
    if (!l.isCorrect || !l.createdAt) continue;
    const day = l.createdAt.toISOString().slice(0, 10);
    const item = map.get(day) ?? { day, grammar: 0, vocabulary: 0, listening: 0 };
    if (l.skill === "grammar") item.grammar += 1;
    else if (l.skill === "vocabulary") item.vocabulary += 1;
    else if (l.skill === "listening") item.listening += 1;
    map.set(day, item);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}
