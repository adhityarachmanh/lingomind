import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { ExampleSentence, LessonContainer, VocabularyItem } from "../types";

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

export function buildLessonContext(
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
    `Buat satu materi pelajaran untuk bahasa ${language} level CEFR ${level} dengan tujuan belajar: ${goal}.`,
    `Serial materi: Bagian ke-${part}. ${partNote}${modifierPrompt}`,
    "Pedoman level:",
    "- A1/A2: konkret, sederhana, fokus pola dasar.",
    "- B1/B2: lebih variatif, kontras penggunaan, situasi nyata.",
    "- C1/C2: nuansa makna, register formal/informal, konteks natural.",
    "Kualitas wajib:",
    "- content harus cukup detail untuk belajar mandiri 10-15 menit.",
    "- content tulis dalam Bahasa Indonesia.",
    "- hindari penjelasan terlalu umum.",
    "",
  ].join("\n");
}

function buildContentPrompt(
  language: string,
  level: string,
  goal: string,
  part: number,
  modifier: string
): string {
  return [
    buildLessonContext(language, level, goal, part, modifier),
    "Pada respons ini, hasilkan hanya judul dan isi materi.",
    "- field 'content' WAJIB diformat menggunakan HTML (Gunakan tag seperti <br> untuk baris baru, <b> untuk tebal, <i> untuk miring, atau list HTML <ul><li> jika perlu) agar tampil rapi di UI.",
    "- content WAJIB dipisah rapi dengan judul bagian (misal dibungkus <b> atau <h3>):",
    "Konsep Inti",
    "Pola",
    "Kesalahan Umum",
    "Tips Praktik.",
    "- content WAJIB minimal 700 karakter.",
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"title\": string, \"content\": string}",
  ].join("\n");
}

function buildVocabularyPrompt(
  language: string,
  level: string,
  goal: string,
  part: number,
  modifier: string
): string {
  return [
    buildLessonContext(language, level, goal, part, modifier),
    `Pada respons ini, hasilkan hanya kosakata inti materi: minimal 8 item. PENTING: field 'word' WAJIB diisi dengan kata dalam bahasa target (${language}), sedangkan field 'meaning' WAJIB diisi terjemahannya dalam Bahasa Indonesia.`,
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"vocabulary\": [{\"word\": string, \"meaning\": string}]}",
  ].join("\n");
}

function buildSentencesPrompt(
  language: string,
  level: string,
  goal: string,
  part: number,
  modifier: string
): string {
  return [
    buildLessonContext(language, level, goal, part, modifier),
    `Pada respons ini, hasilkan hanya contoh kalimat materi: minimal 8 kalimat. PENTING: field 'target' WAJIB diisi dengan kalimat dalam bahasa ${language}, sedangkan field 'meaning' WAJIB diisi terjemahannya dalam Bahasa Indonesia.`,
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"example_sentences\": [{\"target\": string, \"meaning\": string}]}",
  ].join("\n");
}

export function mergeLessonParts(
  contentJson: string,
  vocabJson: string,
  sentencesJson: string
): LessonContainer | null {
  const content = parseAiJson<{ title: unknown; content: unknown }>(contentJson);
  const vocab = parseAiJson<{ vocabulary: unknown }>(vocabJson);
  const sentences = parseAiJson<{ example_sentences: unknown }>(sentencesJson);
  if (!content || !vocab || !sentences) return null;
  if (typeof content.title !== "string" || content.title.trim() === "") return null;
  if (typeof content.content !== "string" || content.content.length < 700) return null;
  if (!Array.isArray(vocab.vocabulary) || vocab.vocabulary.length < 6) return null;
  if (!Array.isArray(sentences.example_sentences) || sentences.example_sentences.length < 6) return null;
  return {
    title: content.title,
    content: content.content,
    vocabulary: vocab.vocabulary as VocabularyItem[],
    example_sentences: sentences.example_sentences as ExampleSentence[],
  };
}

export async function generateLesson(params: {
  language: string;
  level: string;
  goal: string;
  part: number;
  modifier: string;
}): Promise<LessonContainer> {
  const { language, level, goal, part, modifier } = params;

  // path cepat: 3 generateText paralel (konten / kosakata / kalimat)
  const [contentRes, vocabRes, sentencesRes] = await Promise.all([
    generateText({ model, prompt: buildContentPrompt(language, level, goal, part, modifier), maxOutputTokens: 4096 }),
    generateText({ model, prompt: buildVocabularyPrompt(language, level, goal, part, modifier), maxOutputTokens: 2048 }),
    generateText({ model, prompt: buildSentencesPrompt(language, level, goal, part, modifier), maxOutputTokens: 2048 }),
  ]);

  const merged = mergeLessonParts(contentRes.text, vocabRes.text, sentencesRes.text);
  if (merged) return merged;

  // fallback (jarang): pipeline legacy single call + retry dengan instruksi JSON
  let prompt = buildLessonPrompt(language, level, goal, part, modifier);
  let lesson: LessonContainer | null = null;
  for (let attempt = 1; attempt <= 3 && !lesson; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 8192 });
    lesson = parseAiJson<LessonContainer>(text);
    if (!lesson) {
      prompt +=
        "\n\nRespons sebelumnya BUKAN JSON yang valid. Kembalikan HANYA JSON valid sesuai bentuk yang diminta, tanpa teks lain apa pun.";
    }
  }
  if (!lesson) throw new Error("Gagal parsing respons lesson: respons bukan JSON valid.");
  if (!lesson.title || !lesson.content) {
    throw new Error("Respons lesson tidak valid: judul atau konten kosong.");
  }
  return lesson;
}
