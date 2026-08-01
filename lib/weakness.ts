import { db } from "./db";

const GRAMMAR_TENSE_KEYWORDS = ["tense", "past", "present", "future"];
const GRAMMAR_PREPOSITION_KEYWORDS = ["preposition", " in ", " on ", " at "];
const GRAMMAR_ARTICLE_KEYWORDS = ["article", " a ", " an ", " the "];
const VOCABULARY_KEYWORDS = ["vocabulary", "word choice"];
const SKILL_LISTENING = ["pengucapan", "pendengaran", "suara"];
const SKILL_VOCABULARY = ["kosakata", "arti kata", "sinonim", "terjemahan", "makna", "kata ini"];

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
