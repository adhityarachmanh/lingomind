import { generateText } from "ai";
import { model } from "../ai";
import { parseAiArray, parseAiJson } from "./parse";
import type { PronunciationEvaluation } from "../types";

export function buildSentencePrompt(language: string, level: string): string {
  return [
    `Buat 5 kalimat dalam bahasa ${language} yang sesuai untuk level CEFR ${level} untuk latihan pronunciation.`,
    "Kembalikan dalam bentuk JSON array string. Jangan sertakan terjemahannya, hanya kalimat bahasa target. Panjang kalimat 4 hingga 12 kata.",
  ].join("\n");
}

export function parseSentenceArray(text: string): string[] | null {
  const arr = parseAiArray<string>(text);
  if (!arr || arr.length < 1) return null;
  if (!arr.every((s) => typeof s === "string" && s.trim().length > 0)) return null;
  return arr.map((s) => s.trim());
}

export function buildEvaluationPrompt(language: string, targetSentence: string, transcript: string): string {
  return [
    `Anda adalah ahli evaluasi pengucapan bahasa ${language}.`,
    `Kalimat target yang seharusnya diucapkan: '${targetSentence}'`,
    `Teks Speech-to-Text hasil ucapan pengguna: '${transcript}'`,
    "",
    "Evaluasi pengucapan pengguna. STT mungkin memiliki salah ejaan jika pengucapannya salah. Jika STT kosong, berarti gagal mendengarkan.",
    "Tentukan skor 0-100 dan berikan feedback singkat dalam bahasa Indonesia.",
    "Beri status tiap kata dari kalimat target: 'correct', 'incorrect', atau 'missing'.",
    "Kata-kata dalam array 'word_results' HARUS SAMA PERSIS dengan kata-kata di kalimat target secara berurutan. Abaikan tanda baca dalam field 'word'.",
    "",
    'Kembalikan HANYA JSON: {"score": number 0-100, "feedback": string, "word_results": [{"word": string, "status": "correct"|"incorrect"|"missing"}]}',
  ].join("\n");
}

const VALID_STATUS = ["correct", "incorrect", "missing"];

export function parseEvaluation(text: string): PronunciationEvaluation | null {
  const data = parseAiJson<PronunciationEvaluation>(text);
  if (!data) return null;
  if (typeof data.score !== "number" || data.score < 0 || data.score > 100) return null;
  if (typeof data.feedback !== "string" || !data.feedback.trim()) return null;
  if (!Array.isArray(data.word_results)) return null;
  if (!data.word_results.every((w) => w && typeof w.word === "string" && VALID_STATUS.includes(w.status))) return null;
  return data;
}

export async function generateSentences(params: { language: string; level: string }): Promise<string[]> {
  const { language, level } = params;
  let prompt = buildSentencePrompt(language, level);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 8192, temperature: 0.7 });
    const sentences = parseSentenceArray(text);
    if (sentences) return sentences;
    prompt += `\n\nRespons tidak valid. Kembalikan HANYA JSON array string (minimal 1 kalimat).`;
  }
  throw new Error("Gagal menghasilkan kalimat pronunciation yang valid.");
}

export async function evaluatePronunciation(params: { language: string; targetSentence: string; transcript: string }): Promise<PronunciationEvaluation> {
  const { language, targetSentence, transcript } = params;
  let prompt = buildEvaluationPrompt(language, targetSentence, transcript);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 8192, temperature: 0.2 });
    const evaluation = parseEvaluation(text);
    if (evaluation) return evaluation;
    prompt += `\n\nRespons tidak valid. Kembalikan HANYA JSON sesuai bentuk yang diminta.`;
  }
  throw new Error("Gagal mengevaluasi pronunciation.");
}
