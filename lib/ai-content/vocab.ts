import { generateText } from "ai";
import { model } from "../ai";
import { parseAiArray } from "./parse";

export interface VocabItem {
  word: string;
  meaning: string;
}

// Parse hasil ekstraksi AI → maks 3 item, filter kosong/panjang, dedupe case-insensitive.
export function parseVocabList(text: string): VocabItem[] {
  const data = parseAiArray<{ word?: string; meaning?: string }>(text);
  if (!data) return [];
  const seen = new Set<string>();
  const out: VocabItem[] = [];
  for (const item of data) {
    if (out.length >= 3) break;
    const word = (item?.word ?? "").trim();
    const meaning = (item?.meaning ?? "").trim();
    if (!word || !meaning) continue;
    if (word.length > 50 || meaning.length > 200) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word, meaning });
  }
  return out;
}

export function buildVocabExtractionPrompt(
  language: string,
  level: string,
  userMessage: string,
  aiReply: string
): string {
  return [
    `Ambil maksimal 3 kosakata PALING BERGUNA dari percakapan bahasa ${language} di bawah ini.`,
    `Level user: CEFR ${level}.`,
    "Aturan:",
    "1) Pilih kata/frasa yang penting dikuasai user dan sesuai level (bukan kata super dasar seperti 'hello', 'yes' — kecuali level A1).",
    "2) Setiap item: {\"word\": string (dalam bahasa target), \"meaning\": string (arti Bahasa Indonesia)}.",
    "3) Kembalikan HANYA JSON array, contoh: [{\"word\": \"apartment\", \"meaning\": \"apartemen\"}].",
    "",
    `Pesan user: "${userMessage.slice(0, 500)}"`,
    `Balasan AI: "${aiReply.slice(0, 800)}"`,
  ].join("\n");
}

// Ekstraksi kosakata dari satu pertukaran chat — dipanggil latar belakang (fire-and-forget),
// kegagalan apa pun → daftar kosong (tidak menggagalkan chat).
export async function extractVocabularyFromChat(params: {
  language: string;
  level: string;
  userMessage: string;
  aiReply: string;
}): Promise<VocabItem[]> {
  const { language, level, userMessage, aiReply } = params;
  try {
    const { text } = await generateText({
      model,
      prompt: buildVocabExtractionPrompt(language, level, userMessage, aiReply),
      maxOutputTokens: 1024,
      temperature: 0.2,
    });
    return parseVocabList(text);
  } catch {
    return [];
  }
}
