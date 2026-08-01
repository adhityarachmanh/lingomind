import { generateQuizWithPrompt } from "./quiz";
import type { QuizContainer } from "../types";

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function nextCefrLevel(level: string): string {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return "C2";
  return LEVEL_ORDER[idx + 1];
}

export function buildExamPrompt(language: string, level: string, targetLevel: string, topicsStr: string): string {
  return [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    "",
    `Buat 8 soal ujian sertifikasi pilihan ganda tingkat lanjut bahasa ${language} untuk menguji kelayakan kelulusan dari level CEFR ${level} menuju ${targetLevel}.`,
    "Wajib kualitas (LEVEL UJIAN AKHIR):",
    `1) Soal WAJIB mencakup ke-4 topik ini: ${topicsStr}.`,
    "2) Setiap soal wajib memiliki 4 opsi yang sangat mengecoh, hanya 1 benar.",
    "3) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik murahan.",
    "4) Minimal 2 soal harus berupa 'reading comprehension' dengan paragraf/teks pendek di dalam question.",
    "5) Minimal 2 soal harus bertipe listening.",
    "6) Gunakan field JSON ini dengan konsisten:",
    "   - question_type: isi 'listening' atau 'text'.",
    "   - listen_text: wajib terisi untuk question_type='listening' (teks audio untuk TTS).",
    "   - question: untuk listening, hanya instruksi/pertanyaan tanpa transcript audio. WAJIB format HTML (contoh: gunakan <br><br> untuk baris baru, <b> untuk tebal, <i> untuk miring). Jangan bungkus dengan tag root.",
    "   - untuk question_type='text', listen_text boleh string kosong, dan question WAJIB format HTML (misal paragraf cerita panjang gunakan <br><br>).",
    `7) Explanation Bahasa Indonesia wajib komprehensif, minimal 3 kalimat mendalam tentang aturan grammar/kosakata mengapa opsi lain salah.`,
    `8) INGAT: Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text WAJIB FULL dalam bahasa target '${language}'. Explanation tetap dalam Bahasa Indonesia.`,
    "",
    'Kembalikan HANYA JSON valid dengan bentuk: {"questions": [{"question": string, "question_type": "text"|"listening", "listen_text": string, "options": [string x4], "correct_answer": string, "explanation": string}]}',
  ].join("\n");
}

export async function generateExam(params: {
  language: string;
  level: string;
  topicsStr: string;
}): Promise<QuizContainer> {
  const { language, level, topicsStr } = params;
  return generateQuizWithPrompt({
    prompt: buildExamPrompt(language, level, nextCefrLevel(level), topicsStr),
    expectedCount: 8,
    label: "exam",
  });
}
