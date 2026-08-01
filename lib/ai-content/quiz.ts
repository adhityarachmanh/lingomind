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

export function validateQuizShape(questions: QuizQuestion[], expectedCount: number): string[] {
  const errs: string[] = [];
  if (questions.length !== expectedCount) {
    errs.push(`Format quiz tidak valid: wajib ${expectedCount} pertanyaan.`);
    return errs;
  }
  questions.forEach((qq, i) => {
    const n = i + 1;
    if (!qq.question) errs.push(`Format quiz tidak valid: pertanyaan ke-${n} kosong.`);
    if (!qq.explanation) errs.push(`Format quiz tidak valid: explanation pertanyaan ke-${n} kosong.`);
    if (!qq.options || qq.options.length !== 4) errs.push(`Format quiz tidak valid: pertanyaan ke-${n} harus punya 4 opsi.`);
    else {
      if (qq.options.some((o) => !o.trim())) errs.push(`Format quiz tidak valid: ada opsi kosong di pertanyaan ke-${n}.`);
      if (new Set(qq.options).size !== 4) errs.push(`Format quiz tidak valid: ada opsi duplikat di pertanyaan ke-${n}.`);
    }
    if (!qq.correct_answer || !qq.options.includes(qq.correct_answer)) errs.push(`Format quiz tidak valid: kunci jawaban pertanyaan ke-${n} tidak cocok dengan opsi.`);
    if (qq.question_type !== "text" && qq.question_type !== "listening") errs.push(`Format quiz tidak valid: question_type pertanyaan ke-${n} harus 'text' atau 'listening'.`);
    if (qq.question_type === "listening" && (qq.listen_text ?? "").length < 6) errs.push(`Format quiz tidak valid: listen_text pertanyaan listening ke-${n} terlalu singkat/kosong.`);
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

export function buildQuizPrompt(language: string, level: string, goal: string, weaknessContext: string): string {
  const context = weaknessContext || "(belum ada riwayat kelemahan)";
  return [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    `Buat 5 soal kuis pilihan ganda bahasa ${language} untuk level CEFR ${level} dengan topik pembelajaran/goal: '${goal}'.`,
    "1) SEMUA SOAL WAJIB menguji kosakata, tata bahasa, atau pemahaman bahasa terkait erat dengan topik '${goal}'. HANYA fokus pada pembelajaran bahasa untuk topik ini! DILARANG KERAS membuat soal pengetahuan umum (trivia)!",
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
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"questions\": [{\"question\": string, \"question_type\": \"text\"|\"listening\", \"listen_text\": string, \"options\": [string x4], \"correct_answer\": string, \"explanation\": string}]}",
  ].join("\n");
}

function qualityScore(issues: string[]): number {
  return Math.max(0, 100 - issues.length * 10);
}

export async function generateQuiz(params: {
  language: string;
  level: string;
  goal: string;
  weaknessContext: string;
}): Promise<QuizContainer> {
  const { language, level, goal, weaknessContext } = params;
  let prompt = buildQuizPrompt(language, level, goal, weaknessContext);
  let best: QuizContainer | null = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 8192, temperature: 0.6 });
    const parsed = parseAiJson<QuizContainer>(text);
    if (!parsed) {
      prompt += `\n\nRespons tidak valid (bukan JSON). Kembalikan HANYA JSON.`;
      continue;
    }
    const normalized = normalizeQuiz(parsed);
    const shapeErrors = validateQuizShape(normalized.questions, 5);
    const issues = shapeErrors.length > 0 ? shapeErrors : qualityIssues(normalized.questions, 5);
    const score = qualityScore(issues);
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
    if (issues.length === 0 || score >= 92) {
      return normalized;
    }
    prompt += `\n\nRespons sebelumnya bermasalah: ${issues.join("; ")}. Perbaiki JSON sesuai syarat.`;
  }

  if (best) return best;
  throw new Error("Gagal menghasilkan quiz yang valid setelah beberapa percobaan.");
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
