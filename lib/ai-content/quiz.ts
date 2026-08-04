import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { QuizContainer, QuizQuestion } from "../types";

const AMBIGUOUS_PATTERNS = ["all of the above", "semua jawaban benar", "both a and b"];
const SKILL_KEYWORDS: Record<string, string[]> = {
  listening: ["dengar", "listen", "audio", "pengucapan", "pendengaran", "suara"],
  vocabulary: ["kosakata", "arti kata", "sinonim", "terjemahan", "makna", "kata ini", "vocabulary"],
};

function stripChoicePrefix(s: string): string {
  return s.replace(/^\s*[A-H][.)]\s*/, "").trim();
}

export function normalizeQuiz(container: QuizContainer): QuizContainer {
  return {
    questions: container.questions.map((qq) => {
      const options = qq.options.map((o) => stripChoicePrefix(o));
      let correct = stripChoicePrefix(qq.correct_answer);
      if (!options.includes(correct)) {
        const match = options.find((o) => o.toLowerCase() === correct.toLowerCase());
        if (match) correct = match;
      }
      const questionType = (qq.question_type ?? "text").toLowerCase() === "listening" ? "listening" : "text";
      const listenText = (qq.listen_text ?? "").replace(/\s+/g, " ").trim();
      return {
        question: (qq.question ?? "").replace(/\s+/g, " ").trim(),
        question_type: questionType,
        listen_text: questionType === "text" && !listenText ? (qq.question ?? "").replace(/\s+/g, " ").trim() : listenText,
        options,
        correct_answer: correct,
        explanation: (qq.explanation ?? "").replace(/\s+/g, " ").trim(),
      };
    }),
  };
}

export function validateQuizShape(questions: QuizQuestion[], expectedCount: number, label = "quiz"): string[] {
  const errs: string[] = [];
  if (questions.length !== expectedCount) {
    errs.push(`Format ${label} tidak valid: wajib ${expectedCount} pertanyaan.`);
    return errs;
  }
  questions.forEach((qq, i) => {
    const n = i + 1;
    if (!qq.question) errs.push(`Format ${label} tidak valid: pertanyaan ke-${n} kosong.`);
    if (!qq.explanation) errs.push(`Format ${label} tidak valid: explanation pertanyaan ke-${n} kosong.`);
    if (!qq.options || qq.options.length !== 4) errs.push(`Format ${label} tidak valid: pertanyaan ke-${n} harus punya 4 opsi.`);
    else {
      if (qq.options.some((o) => !o.trim())) errs.push(`Format ${label} tidak valid: ada opsi kosong di pertanyaan ke-${n}.`);
      if (new Set(qq.options).size !== 4) errs.push(`Format ${label} tidak valid: ada opsi duplikat di pertanyaan ke-${n}.`);
    }
    if (!qq.correct_answer || !qq.options.includes(qq.correct_answer)) errs.push(`Format ${label} tidak valid: kunci jawaban pertanyaan ke-${n} tidak cocok dengan opsi.`);
    if (qq.question_type !== "text" && qq.question_type !== "listening") errs.push(`Format ${label} tidak valid: question_type pertanyaan ke-${n} harus 'text' atau 'listening'.`);
    if (qq.question_type === "listening" && (qq.listen_text ?? "").length < 6) errs.push(`Format ${label} tidak valid: listen_text pertanyaan listening ke-${n} terlalu singkat/kosong.`);
  });
  return errs;
}

function classifyQuestionSkill(qq: QuizQuestion): "listening" | "vocabulary" | "grammar" {
  const text = `${qq.question} ${qq.listen_text ?? ""} ${qq.explanation}`.toLowerCase();
  if (qq.question_type === "listening") return "listening";
  if (SKILL_KEYWORDS.listening.some((k) => text.includes(k))) return "listening";
  if (SKILL_KEYWORDS.vocabulary.some((k) => text.includes(k))) return "vocabulary";
  return "grammar";
}

export function qualityIssues(questions: QuizQuestion[], expectedCount: number, weaknessFocus?: string): string[] {
  const issues: string[] = [];
  questions.forEach((qq, i) => {
    const n = i + 1;
    const seen = questions.findIndex((x, j) => j < i && x.question === qq.question);
    if (seen >= 0) issues.push(`Pertanyaan ke-${n} terduplikasi.`);
    if (qq.question.length < 15) issues.push(`Pertanyaan ke-${n} terlalu pendek.`);
    if (qq.explanation.length < 40) issues.push(`Explanation pertanyaan ke-${n} terlalu singkat.`);
    if (qq.options.some((o) => AMBIGUOUS_PATTERNS.some((p) => o.toLowerCase().includes(p))))
      issues.push(`Pertanyaan ke-${n} mengandung pola opsi ambigu.`);
  });
  const skills = new Set(questions.map(classifyQuestionSkill));
  if (skills.size < 2) issues.push("Komposisi skill kurang variatif (minimal 2 skill berbeda).");
  const listeningCount = questions.filter((x) => x.question_type === "listening").length;
  const minListening = expectedCount >= 5 ? 2 : 1;
  if (listeningCount < minListening) issues.push(`Jumlah soal listening kurang: minimal ${minListening} dari ${expectedCount} soal.`);
  const positions = questions.map((x) => x.options.indexOf(x.correct_answer)).filter((p) => p >= 0);
  if (positions.length > 0) {
    const counts = positions.reduce<Record<number, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {});
    if (Math.max(...Object.values(counts)) >= Math.max(2, questions.length - 1))
      issues.push("Posisi jawaban benar terlalu bias pada pilihan yang sama.");
  }
  if (weaknessFocus && expectedCount > 1) {
    const tokens = weaknessFocus.toLowerCase().split(/\s+/);
    const focused = questions.filter((x) => tokens.some((t) => x.question.toLowerCase().includes(t) || x.explanation.toLowerCase().includes(t))).length;
    if (focused < Math.max(1, expectedCount - 1)) issues.push("Soal belum cukup fokus pada topik weakness yang ditargetkan.");
  }
  return issues;
}

export interface ExistingQuestion {
  question: string;
  listenText?: string;
}

// Contoh soal yang SUDAH ADA di cache — disuntikkan ke prompt agar AI tidak meniru/memparafrase.
// Ambil maks `max` soal terbaru agar token tetap hemat.
export function formatExistingQuestions(existing: ExistingQuestion[], max = 10): string {
  const list = existing.slice(-max);
  if (list.length === 0) return "";
  const lines = list.map((q, i) => {
    const audio = q.listenText ? ` (audio: ${q.listenText})` : "";
    return `${i + 1}) ${q.question}${audio}`;
  });
  return [
    "DILARANG KERAS membuat soal yang sama, hampir sama, atau memparafrase soal-soal varian yang sudah ada berikut ini (termasuk audio listeningnya):",
    ...lines,
  ].join("\n");
}

export function buildQuizPrompt(
  language: string,
  level: string,
  goal: string,
  weaknessContext: string,
  existingQuestions?: ExistingQuestion[]
): string {
  const context = weaknessContext || "(belum ada riwayat kelemahan)";
  const prompt = [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    `Buat 5 soal kuis pilihan ganda bahasa ${language} untuk level CEFR ${level} dengan topik pembelajaran/goal: '${goal}'.`,
    `1) SEMUA SOAL WAJIB menguji kosakata, tata bahasa, atau pemahaman bahasa terkait erat dengan topik '${goal}'. HANYA fokus pada pembelajaran bahasa untuk topik ini! DILARANG KERAS membuat soal pengetahuan umum (trivia)!`,
    "2) Setiap soal 4 opsi, hanya 1 benar.",
    "3) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik ambigu.",
    "4) Explanation wajib dalam Bahasa Indonesia minimal 2 kalimat singkat dan spesifik.",
    "5) Variasikan tipe soal: grammar, vocabulary, contextual comprehension, dan listening.",
    "6) WAJIB sertakan minimal 2 soal bertipe listening dan minimal 1 soal khusus Vocabulary (terjemahan, sinonim, atau makna kata).",
    "7) Pertahankan kosakata sesuai level CEFR.",
    "8) Sertakan minimal 1 soal model cloze (isian) dengan placeholder '__'.",
    "9) question_type: 'listening' atau 'text'; listen_text: teks audio TTS untuk listening; question untuk listening = instruksi TANPA transcript, WAJIB format HTML (<br>, <b>, <i>, jangan tag root); text → listen_text boleh kosong, question WAJIB HTML (misal '<b>A:</b> Hello<br><b>B:</b> Hi!').",
    "10) question, options, correct_answer, listen_text WAJIB FULL bahasa target; explanation tetap Bahasa Indonesia.",
    `11) Konteks kelemahan user: ${context}. Gunakan untuk menyesuaikan soal remedial ringan.`,
    "12) DILARANG KERAS mengulang soal atau meniru pola soal dari varian quiz yang sudah ada. Setiap varian harus berisi soal yang benar-benar baru.",
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"questions\": [{\"question\": string, \"question_type\": \"text\"|\"listening\", \"listen_text\": string, \"options\": [string x4], \"correct_answer\": string, \"explanation\": string}]}",
  ].join("\n");
  const existingBlock = formatExistingQuestions(existingQuestions ?? []);
  return existingBlock ? `${prompt}\n\n${existingBlock}` : prompt;
}

// Tema acak untuk variasi general practice (anti-monoton / anti-hafalan).
export const GENERAL_PRACTICE_THEMES = [
  "kafe dan restoran",
  "perjalanan dan transportasi",
  "pekerjaan dan kantor",
  "sekolah dan belajar",
  "belanja dan pasar",
  "kesehatan dan dokter",
  "teknologi dan internet",
  "cuaca dan musim",
  "hobi dan waktu luang",
  "keluarga dan rumah",
] as const;

export function buildGeneralPracticePrompt(
  language: string,
  level: string,
  theme?: string,
  existingQuestions?: ExistingQuestion[]
): string {
  const themeLine = theme
    ? `Konteks variasi (gunakan sebagai warna latar kosakata/skenario, tetap uji kemampuan umum level ${level}): '${theme}'.`
    : "";
  const prompt = [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    "",
    `Buat 5 soal kuis latihan acak (general practice) pilihan ganda bahasa ${language} untuk level CEFR ${level}.`,
    "Wajib kualitas:",
    `1) Ini adalah latihan acak kemampuan bahasa. HANYA uji kosakata (vocabulary), tata bahasa (grammar), dan pemahaman (comprehension) sesuai level ${level}. DILARANG KERAS membuat soal pengetahuan umum (trivia)!`,
    "2) KESULITAN: soal WAJIB menantang, di ambang ATAS level CEFR ini (upper edge). Hindari soal yang bisa ditebak atau terlalu mudah/trivial untuk level tersebut. Gunakan kosakata yang lebih jarang namun masih dalam cakupan level, struktur kalimat yang lebih kompleks, dan opsi pengecoh (distractor) yang masuk akal dan mirip.",
    "3) VARIASI: variasikan tema, struktur kalimat, tipe soal, dan topik antar soal dalam satu set. JANGAN mengulang pola soal yang sama persis dari set sebelumnya; gunakan sudut skenario berbeda setiap kali. Jangan memakai kata/kalimat yang sama persis di beberapa soal sekaligus.",
    "4) Setiap soal 4 opsi, hanya 1 benar.",
    "5) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik ambigu.",
    "6) Explanation wajib dalam Bahasa Indonesia minimal 2 kalimat singkat dan spesifik menjelaskan mengapa opsi tersebut benar.",
    "7) WAJIB sertakan minimal 2 soal bertipe listening dan minimal 1 soal khusus Vocabulary (terjemahan, sinonim, atau makna kata).",
    "8) Gunakan field JSON ini dengan konsisten:",
    "   - question_type: isi 'listening' atau 'text'.",
    "   - listen_text: khusus listening, isi teks audio yang akan dibacakan TTS (kalimat/dialog pendek).",
    "   - question: untuk listening, isi instruksi/pertanyaan TANPA menyalin transcript listen_text. WAJIB format HTML (contoh: gunakan <br> untuk baris baru, <b> untuk tebal, <i> untuk miring). Jangan bungkus dengan tag root.",
    "   - untuk question_type='text', listen_text boleh diisi string kosong, dan question WAJIB format HTML.",
    `9) INGAT: Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text WAJIB FULL dalam bahasa target '${language}'. Explanation tetap dalam Bahasa Indonesia.`,
    themeLine,
    "",
    'Kembalikan HANYA JSON valid dengan bentuk: {"questions": [{"question": string, "question_type": "text"|"listening", "listen_text": string, "options": [string x4], "correct_answer": string, "explanation": string}]}',
  ].join("\n");
  const existingBlock = formatExistingQuestions(existingQuestions ?? []);
  return existingBlock ? `${prompt}\n\n${existingBlock}` : prompt;
}

export function buildWeaknessPrompt(
  language: string,
  level: string,
  weaknessTopic: string,
  weaknessContext: string
): string {
  const context = weaknessContext || "(belum ada catatan detail)";
  return [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    "",
    `Buat 3 soal latihan weakness-focused bahasa ${language} level CEFR ${level}.`,
    `Topik kelemahan utama: ${weaknessTopic}.`,
    `Data konteks kesalahan user terbaru: ${context}`,
    "Aturan:",
    "1) Semua soal harus fokus pada topik kelemahan di atas.",
    "2) Kesulitan bertahap: soal 1 mudah, soal 2 menengah, soal 3 menengah+ (masih sesuai level).",
    "3) Tiap soal 4 opsi, 1 kunci benar.",
    "4) Minimal 1 soal harus bertipe listening yang tetap relevan dengan topik kelemahan.",
    "5) Gunakan field JSON ini dengan konsisten:",
    "   - question_type: isi 'listening' atau 'text'.",
    "   - listen_text: wajib terisi untuk question_type='listening' (teks audio untuk TTS).",
    "   - question: untuk listening, hanya instruksi/pertanyaan tanpa transcript audio. WAJIB format HTML (contoh: gunakan <br> untuk baris baru, <b> untuk tebal, <i> untuk miring). Jangan bungkus dengan tag root.",
    "   - untuk question_type='text', listen_text boleh string kosong, dan question WAJIB format HTML.",
    `6) INGAT: Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text WAJIB FULL dalam bahasa target '${language}'. Explanation tetap dalam Bahasa Indonesia.`,
    "7) Explanation Bahasa Indonesia minimal 2 kalimat, jelaskan kenapa user biasanya salah.",
    "8) Hindari opsi ambigu dan hindari pengulangan pola soal yang sama.",
    "",
    'Kembalikan HANYA JSON valid dengan bentuk: {"questions": [{"question": string, "question_type": "text"|"listening", "listen_text": string, "options": [string x4], "correct_answer": string, "explanation": string}]}',
  ].join("\n");
}

export function buildWeaknessContext(notes: string[]): string {
  const lines: string[] = [];
  for (const note of notes) {
    const normalized = note.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const short = normalized.length > 140 ? normalized.slice(0, 140) : normalized;
    lines.push(`- ${short}`);
  }
  return lines.join("\n");
}

function qualityScore(issues: string[]): number {
  return Math.max(0, 100 - issues.length * 10);
}

// Budget token generasi — cukup 4096 untuk 3-5 soal (output ringkas, latensi turun drastis).
export function quizMaxTokens(expectedCount: number, override?: number): number {
  if (override !== undefined) return override;
  return 4096;
}

export async function generateQuizWithPrompt(params: {
  prompt: string;
  expectedCount: number;
  label: string;
  weaknessFocus?: string;
  maxTokens?: number;
}): Promise<QuizContainer> {
  const { prompt, expectedCount, label, weaknessFocus } = params;
  let currentPrompt = prompt;
  let best: QuizContainer | null = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text } = await generateText({
      model,
      prompt: currentPrompt,
      maxOutputTokens: quizMaxTokens(expectedCount, params.maxTokens),
      temperature: 0.6,
    });
    const parsed = parseAiJson<QuizContainer>(text);
    if (!parsed) {
      currentPrompt += `\n\nRespons tidak valid (bukan JSON). Kembalikan HANYA JSON.`;
      continue;
    }
    const normalized = normalizeQuiz(parsed);
    const shapeErrors = validateQuizShape(normalized.questions, expectedCount, label);
    const issues = shapeErrors.length > 0 ? shapeErrors : qualityIssues(normalized.questions, expectedCount, weaknessFocus);
    const score = qualityScore(issues);
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
    if (issues.length === 0 || score >= 92) {
      return normalized;
    }
    currentPrompt += `\n\nRespons sebelumnya bermasalah: ${issues.join("; ")}. Perbaiki JSON sesuai syarat.`;
  }

  if (best) return best;
  throw new Error(`Gagal menghasilkan ${label} yang valid setelah beberapa percobaan.`);
}

export async function generateQuiz(params: {
  language: string;
  level: string;
  goal: string;
  weaknessContext: string;
}): Promise<QuizContainer> {
  return generateQuizWithPrompt({
    prompt: buildQuizPrompt(params.language, params.level, params.goal, params.weaknessContext),
    expectedCount: 5,
    label: "quiz",
  });
}

export function shuffleOptions(container: QuizContainer): QuizContainer {
  return {
    questions: container.questions.map((qq) => {
      const options = [...qq.options];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return { ...qq, options };
    }),
  };
}

// Acak urutan SOAL + opsi tiap soal saat disajikan ke user — anti-hafalan posisi & urutan.
// correct_answer tetap string, penilaian aman; input tidak diubah.
export function shuffleQuiz(container: QuizContainer): QuizContainer {
  const questions = [...container.questions];
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  return {
    questions: questions.map((qq) => {
      const options = [...qq.options];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return { ...qq, options };
    }),
  };
}
