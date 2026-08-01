import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { LessonContainer } from "../types";

const MODIFIER_SUFFIX: Record<string, string> = {
  hard: "Instruksi Adaptif: Pengguna memiliki performa yang sangat baik dan konsisten. Tingkatkan sedikit kerumitan tata bahasa dan gunakan kosakata yang lebih menantang (di ambang atas level ini).",
  easy: "Instruksi Adaptif: Pengguna sedang kesulitan menjaga konsistensi. Sederhanakan bahasa, gunakan kalimat yang lebih pendek, dan fokus pada konsep dasar agar lebih mudah dipahami.",
  normal: "",
};

export function buildLessonPrompt(
  language: string,
  level: string,
  goal: string,
  part: number,
  modifier: string
): string {
  const partNote = part <= 1
    ? "Ini bagian pertama."
    : "Ini materi lanjutan. Hindari mengulang penjelasan inti yang sama persis dengan bagian sebelumnya. Tambahkan variasi pola, konteks, dan contoh berbeda.";
  const modifierPrompt = MODIFIER_SUFFIX[modifier] ?? "";
  return [
    `TARGET BAHASA MATERI: ${language} (Penjelasan 'content' dalam bahasa Indonesia, TAPI isi 'vocabulary' dan kalimat target pada 'example_sentences' WAJIB dalam bahasa ${language}).`,
    "",
    `Buat satu materi pelajaran KOMPREHENSIF untuk bahasa ${language} level CEFR ${level} dengan tujuan belajar: ${goal}.`,
    `Serial materi: Bagian ke-${part}. ${partNote}${modifierPrompt}`,
    "Pedoman level:",
    "- A1/A2: konkret, sederhana, fokus pola dasar.",
    "- B1/B2: lebih variatif, kontras penggunaan, situasi nyata.",
    "- C1/C2: nuansa makna, register formal/informal, konteks natural.",
    "Kualitas wajib:",
    "- content harus cukup detail untuk belajar mandiri 10-15 menit.",
    "- content tulis dalam Bahasa Indonesia.",
    "- field 'content' WAJIB diformat menggunakan HTML (Gunakan tag seperti <br> untuk baris baru, <b> untuk tebal, <i> untuk miring, atau list HTML <ul><li> jika perlu) agar tampil rapi di UI.",
    "- content WAJIB dipisah rapi dengan judul bagian (misal dibungkus <b> atau <h3>):",
    "Konsep Inti",
    "Pola",
    "Kesalahan Umum",
    "Tips Praktik.",
    `- vocabulary minimal 8 item. PENTING: field 'word' WAJIB diisi dengan kata dalam bahasa target (${language}), sedangkan field 'meaning' WAJIB diisi terjemahannya dalam Bahasa Indonesia.`,
    `- example_sentences minimal 8 kalimat. PENTING: field 'target' WAJIB diisi dengan kalimat dalam bahasa ${language}, sedangkan field 'meaning' WAJIB diisi terjemahannya dalam Bahasa Indonesia.`,
    "- hindari penjelasan terlalu umum.",
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"title\": string, \"content\": string, \"vocabulary\": [{\"word\": string, \"meaning\": string}], \"example_sentences\": [{\"target\": string, \"meaning\": string}]}",
  ].join("\n");
}

export function isRichLesson(lesson: LessonContainer): boolean {
  return (
    lesson.content.length >= 700 &&
    lesson.vocabulary.length >= 6 &&
    lesson.example_sentences.length >= 6
  );
}

export async function generateLesson(params: {
  language: string;
  level: string;
  goal: string;
  part: number;
  modifier: string;
}): Promise<LessonContainer> {
  const { language, level, goal, part, modifier } = params;
  const prompt = buildLessonPrompt(language, level, goal, part, modifier);

  const first = await generateText({ model, prompt, maxOutputTokens: 8192 });
  let lesson = parseAiJson<LessonContainer>(first.text);
  if (!lesson) {
    const retry = await generateText({ model, prompt, maxOutputTokens: 8192 });
    lesson = parseAiJson<LessonContainer>(retry.text);
  }
  if (!lesson) throw new Error("Gagal parsing respons lesson: respons bukan JSON valid.");

  if (!isRichLesson(lesson)) {
    const enrichmentPrompt = `${prompt}\n\nRespons sebelumnya kurang lengkap. Perbaiki JSON berikut agar memenuhi semua syarat kualitas (content >= 700 karakter, vocabulary >= 6, example_sentences >= 6):\n${JSON.stringify(lesson)}`;
    const second = await generateText({ model, prompt: enrichmentPrompt, maxOutputTokens: 8192 });
    const improved = parseAiJson<LessonContainer>(second.text);
    if (improved) lesson = improved;
  }

  if (!lesson.title || !lesson.content) {
    throw new Error("Respons lesson tidak valid: judul atau konten kosong.");
  }
  return lesson;
}
