import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { StoryData, StorySegment } from "../types";

export function buildStoryPrompt(language: string, level: string, goal: string): string {
  return [
    `Buatkan sebuah cerita pendek interaktif (Interactive Story) untuk melatih Listening Comprehension dalam bahasa ${language} level CEFR ${level} dengan tema/topik '${goal}'.`,
    "Aturan:",
    "1. Cerita dibagi menjadi persis 4 segmen pendek.",
    `2. Teks cerita (text) dan speaker WAJIB dalam bahasa ${language}.`,
    "3. Setiap segmen HARUS memiliki pertanyaan komprehensi (question) yang relevan dengan segmen tersebut.",
    "4. Pertanyaan (question_text), opsi jawaban (options), dan jawaban benar (correct_answer) WAJIB dalam bahasa Indonesia.",
    "5. 'translation' adalah terjemahan bahasa Indonesia untuk teks cerita di segmen tersebut.",
    "6. Hanya boleh ada 1 jawaban benar di antara 4 opsi.",
    'Keluarkan dalam format JSON murni tanpa markdown fence.',
    "",
    'Bentuk JSON: {"title": string, "title_translation": string, "segments": [{"text": string, "speaker": string|null, "translation": string, "question": {"question_text": string, "options": [string x4], "correct_answer": string, "explanation": string}|null}]}',
  ].join("\n");
}

function isValidSegment(s: StorySegment): boolean {
  if (!s.text || !s.text.trim()) return false;
  if (s.question) {
    const q = s.question;
    if (!q.question_text || !q.explanation) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (new Set(q.options).size !== 4) return false;
    if (!q.options.includes(q.correct_answer)) return false;
  }
  return true;
}

export function parseStoryData(text: string): StoryData | null {
  const data = parseAiJson<StoryData>(text);
  if (!data) return null;
  if (!data.title || !data.title_translation) return null;
  if (!Array.isArray(data.segments) || data.segments.length < 1) return null;
  if (!data.segments.every(isValidSegment)) return null;
  return data;
}

export async function generateStory(params: {
  language: string;
  level: string;
  goal: string;
}): Promise<StoryData> {
  const { language, level, goal } = params;
  let prompt = buildStoryPrompt(language, level, goal);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 8192, temperature: 0.7 });
    const story = parseStoryData(text);
    if (story) return story;
    prompt += `\n\nRespons sebelumnya tidak valid. Kembalikan HANYA JSON dengan bentuk yang diminta (4 segmen, tiap segmen punya question dengan 4 opsi dan 1 jawaban benar).`;
  }
  throw new Error("Gagal menghasilkan cerita yang valid setelah beberapa percobaan.");
}
