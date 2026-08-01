# LingoMind Fase 2b — Practice + Exam + Placement — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport 4 fitur sisa siklus belajar ke Next.js: general practice (5 soal acak, hadiah nyawa+poin), weakness practice (3 soal fokus kelemahan), exam kenaikan tingkat (8 soal, 75% lulus, cooldown+tiket, naik level CEFR), dan placement test (chat → evaluasi AI → level tersimpan), plus integrasi tombol exam di roadmap dan CTA di dashboard.

**Architecture:** Refactor kecil `lib/ai-content/quiz.ts` → pipeline generic `generateQuizWithPrompt({prompt, expectedCount, label, weaknessFocus})` yang dipakai semua fitur (prompt per fitur diport verbatim dari `dioxus/src/services/gemini/{quiz,exam,placement}.rs`). Logika murni baru (exam outcome math, next-level mapping, parser CEFR, weakness context builder) diuji vitest. Server actions baru di `lib/actions/{practice,exam,placement}.ts` dengan `getSession()`; UI client dengan pola `.then()`+`cancelled` (lint react-hooks/set-state-in-effect).

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), Vercel AI SDK (opencode.ai, model `OPENCODE_AI_MODEL`), vitest, sanitize-html, Web Speech API.

**Referensi kode lama (sumber kebenaran):**
- General practice: `dioxus/src/views/general_practice.rs` (finish flow 542-563), `dioxus/src/services/gemini/quiz.rs:656-675` (prompt)
- Weakness practice: `dioxus/src/views/weakness_practice.rs` (fallback goal 212, log 532-543, finish 577-583), `quiz.rs:340-370` (prompt), `:415-451` (context)
- Exam: `dioxus/src/views/exam.rs`, `dioxus/src/services/gemini/exam.rs` (prompt 6-40), `dioxus/src/services/auth.rs:607-732` (submit_exam_result), `dioxus/src/services/curriculum.rs:107-204` (cooldown+tiket)
- Placement: `dioxus/src/views/placement_test.rs`, `dioxus/src/services/gemini/placement.rs` (prompt 29-34, parsing, persist 56-84)
- Engagement: `dioxus/src/services/engagement.rs` (add_heart)

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis legacy (dikutip di tiap task).
- **Prisma** delegate singular + camelCase: `db.userLanguageProgress` (upsert where `email_languageId`), `db.userEngagementStat`, `db.weaknessLog`, `db.userProgressLog` (fields `activityType`, `scoreGained`, `passed`, `baseLevel`, `topicIdx`), `db.topic` (fields `levelId`, `title`, `orderIndex`), `db.level` (`id`, `baseRewardPoints`), `db.cachedQuiz` (`contentJson`), `db.userDailyMission` (`email_date`).
- **Setiap server action yang butuh user memanggil `getSession()`**; error session = `Sesi berakhir. Silakan login kembali.`
- **HTML AI wajib `sanitizeHtml`** sebelum `dangerouslySetInnerHTML`.
- **Tanpa perubahan skema/migration**; `npx prisma migrate status` tetap up to date.
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`** (verifikasi lint/tsc/test/build); fire-and-forget action dari client selalu `.catch(() => {})`.
- Opsi kuis di-shuffle server-side sebelum dikirim client.
- AI: `maxOutputTokens: 8192` (model deepseek-v4-flash habiskan ~3000 token untuk reasoning — pelajaran Task 6 2a); quiz/practice/exam `temperature: 0.6`; placement tanpa temperature.
- Pipeline generate: loop maks 3 percobaan dengan feedback; early return bila 0 issue atau score ≥ 92; fallback best; throw `Gagal menghasilkan {label} yang valid setelah beberapa percobaan.`
- Cache kuis: ≤5 varian per (language, level, goal, modifier), pilih acak bila penuh, parse gagal → generate.
- Skor/`passed` exam dipercaya dari client (legacy parity; tercatat untuk audit 2b).

---

### Task 1: Refactor pipeline quiz → generic + prompt builders practice (TDD)

**Files:**
- Modify: `lib/ai-content/quiz.ts`, `lib/ai-content/quiz.test.ts`

**Interfaces:**
- Consumes: `generateText`, `model`, `parseAiJson`, tipe `QuizContainer`/`QuizQuestion`
- Produces:
  ```ts
  export async function generateQuizWithPrompt(params: {
    prompt: string; expectedCount: number; label: string; weaknessFocus?: string;
  }): Promise<QuizContainer>
  // generateQuiz({language, level, goal, weaknessContext}) TETAP (API lama, dipakai lib/actions/quiz.ts)
  // → internal: generateQuizWithPrompt({ prompt: buildQuizPrompt(...), expectedCount: 5, label: "quiz" })
  export function validateQuizShape(questions: QuizQuestion[], expectedCount: number, label?: string): string[]
  // label default "quiz"; string error: `Format ${label} tidak valid: ...`
  export function buildGeneralPracticePrompt(language: string, level: string): string
  export function buildWeaknessPrompt(language: string, level: string, weaknessTopic: string, weaknessContext: string): string
  export function buildWeaknessContext(notes: string[]): string
  // normalize ws tiap note, skip kosong, truncate 140 char, "- {short}", join "\n" (newline asli — perbaikan quirk legacy "\\n")
  ```

- [ ] **Step 1: Tulis tes gagal**

Tambah ke `lib/ai-content/quiz.test.ts` (impor `buildGeneralPracticePrompt, buildWeaknessContext, buildWeaknessPrompt`):

```ts
describe("buildGeneralPracticePrompt", () => {
  it("memuat target bahasa dan level", () => {
    const p = buildGeneralPracticePrompt("English", "A2");
    expect(p).toContain("TARGET BAHASA SOAL: English");
    expect(p).toContain("level CEFR A2");
  });
  it("melarang trivia", () => {
    expect(buildGeneralPracticePrompt("English", "A1")).toContain("DILARANG KERAS membuat soal pengetahuan umum");
  });
});

describe("buildWeaknessPrompt", () => {
  it("memuat topik dan konteks", () => {
    const p = buildWeaknessPrompt("English", "A1", "Grammar: Tense", "- Past tense keliru");
    expect(p).toContain("Topik kelemahan utama: Grammar: Tense");
    expect(p).toContain("Past tense keliru");
  });
  it("3 soal, minimal 1 listening", () => {
    const p = buildWeaknessPrompt("English", "A1", "X", "");
    expect(p).toContain("3 soal latihan weakness-focused");
    expect(p).toContain("Minimal 1 soal harus bertipe listening");
  });
});

describe("buildWeaknessContext", () => {
  it("truncate 140 char", () => {
    const long = "x".repeat(200);
    const out = buildWeaknessContext([long]);
    expect(out.length).toBeLessThanOrEqual(150); // "- " + 140 + possible
    expect(out).toBe("- " + "x".repeat(140));
  });
  it("skip kosong + join newline", () => {
    expect(buildWeaknessContext(["  a  b ", "", "c"])).toBe("- a b\n- c");
  });
  it("semua kosong → string kosong", () => {
    expect(buildWeaknessContext(["", "  "])).toBe("");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/quiz.test.ts`
Expected: FAIL (fungsi baru belum ada).

- [ ] **Step 3: Refactor `lib/ai-content/quiz.ts`**

Ubah `validateQuizShape` — tambah param label dengan default `"quiz"`, ganti string `Format quiz tidak valid:` → `Format ${label} tidak valid:` (di semua 8 baris pesan).

Tambah generic pipeline — refactor body `generateQuiz` menjadi:

```ts
export async function generateQuizWithPrompt(params: {
  prompt: string;
  expectedCount: number;
  label: string;
  weaknessFocus?: string;
}): Promise<QuizContainer> {
  const { prompt, expectedCount, label, weaknessFocus } = params;
  let currentPrompt = prompt;
  let best: QuizContainer | null = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { text } = await generateText({ model, prompt: currentPrompt, maxOutputTokens: 8192, temperature: 0.6 });
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
```

Tambahkan prompt builders (verbatim port):

```ts
export function buildGeneralPracticePrompt(language: string, level: string): string {
  return [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    "",
    `Buat 5 soal kuis latihan acak (general practice) pilihan ganda bahasa ${language} untuk level CEFR ${level}.`,
    "Wajib kualitas:",
    `1) Ini adalah latihan acak kemampuan bahasa. HANYA uji kosakata (vocabulary), tata bahasa (grammar), dan pemahaman (comprehension) sesuai level ${level}. DILARANG KERAS membuat soal pengetahuan umum (trivia)!`,
    "2) Setiap soal 4 opsi, hanya 1 benar.",
    "3) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik ambigu.",
    "4) Explanation wajib dalam Bahasa Indonesia minimal 2 kalimat singkat dan spesifik menjelaskan mengapa opsi tersebut benar.",
    "5) WAJIB sertakan minimal 2 soal bertipe listening dan minimal 1 soal khusus Vocabulary (terjemahan, sinonim, atau makna kata).",
    "6) Pertahankan kosakata sesuai level CEFR.",
    "7) Gunakan field JSON ini dengan konsisten:",
    "   - question_type: isi 'listening' atau 'text'.",
    "   - listen_text: khusus listening, isi teks audio yang akan dibacakan TTS (kalimat/dialog pendek).",
    "   - question: untuk listening, isi instruksi/pertanyaan TANPA menyalin transcript listen_text. WAJIB format HTML (contoh: gunakan <br> untuk baris baru, <b> untuk tebal, <i> untuk miring). Jangan bungkus dengan tag root.",
    "   - untuk question_type='text', listen_text boleh diisi string kosong, dan question WAJIB format HTML.",
    `8) INGAT: Pertanyaan (question), opsi (options), kunci jawaban (correct_answer), dan listen_text WAJIB FULL dalam bahasa target '${language}'. Explanation tetap dalam Bahasa Indonesia.`,
    "",
    'Kembalikan HANYA JSON valid dengan bentuk: {"questions": [{"question": string, "question_type": "text"|"listening", "listen_text": string, "options": [string x4], "correct_answer": string, "explanation": string}]}',
  ].join("\n");
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
```

- [ ] **Step 4: Run — harus lulus**

Run: `npx vitest run lib/ai-content/quiz.test.ts` — semua pass (16 lama + 7 baru).
Run: `npm test` — 73 pass (66 + 7).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/ai-content/quiz.ts lib/ai-content/quiz.test.ts
git commit -m "feat: generic quiz pipeline with practice prompt builders (TDD)"
```

---

### Task 2: lib/ai-content/exam.ts — prompt + generateExam (TDD)

**Files:**
- Create: `lib/ai-content/exam.ts`, `lib/ai-content/exam.test.ts`

**Interfaces:**
- Consumes: `generateQuizWithPrompt` (Task 1)
- Produces:
  ```ts
  export function nextCefrLevel(level: string): string
  // A1→A2, A2→B1, B1→B2, B2→C1, C1→C2, lainnya (incl. C2) → C2
  export function buildExamPrompt(language: string, level: string, targetLevel: string, topicsStr: string): string
  export async function generateExam(params: { language: string; level: string; topicsStr: string }): Promise<QuizContainer>
  // generateQuizWithPrompt({ prompt: buildExamPrompt(language, level, nextCefrLevel(level), topicsStr), expectedCount: 8, label: "exam" })
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/ai-content/exam.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildExamPrompt, nextCefrLevel } from "./exam";

describe("nextCefrLevel", () => {
  it("naik satu tingkat", () => {
    expect(nextCefrLevel("A1")).toBe("A2");
    expect(nextCefrLevel("B1")).toBe("B2");
    expect(nextCefrLevel("C1")).toBe("C2");
  });
  it("cap di C2", () => {
    expect(nextCefrLevel("C2")).toBe("C2");
    expect(nextCefrLevel("unknown")).toBe("C2");
  });
});

describe("buildExamPrompt", () => {
  it("memuat level, target, dan topik", () => {
    const p = buildExamPrompt("English", "A1", "A2", "Greetings, Numbers");
    expect(p).toContain("8 soal ujian sertifikasi");
    expect(p).toContain("dari level CEFR A1 menuju A2");
    expect(p).toContain("ke-4 topik ini: Greetings, Numbers");
  });
  it("minimal 2 reading + 2 listening + explanation 3 kalimat", () => {
    const p = buildExamPrompt("English", "A1", "A2", "X");
    expect(p).toContain("Minimal 2 soal harus berupa 'reading comprehension'");
    expect(p).toContain("Minimal 2 soal harus bertipe listening");
    expect(p).toContain("minimal 3 kalimat");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/exam.test.ts` — FAIL (module tidak ada).

- [ ] **Step 3: Implementasi `lib/ai-content/exam.ts`**

Prompt verbatim dari `dioxus/src/services/gemini/exam.rs:6-40` (+ baris penutup JSON):

```ts
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
```

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 78 pass (73 + 5).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: AI smoke (1 panggilan, boleh)**

```powershell
npx tsx --env-file=.env -e "import { generateExam } from './lib/ai-content/exam'; generateExam({ language: 'English', level: 'A1', topicsStr: 'Greetings & Introductions, Basic Numbers & Time, Everyday Vocabulary, Simple Sentences' }).then(z => { console.log('EXAM OK:', z.questions.length, 'questions'); process.exit(0); }).catch(e => { console.error('EXAM FAIL:', e.message); process.exit(1); })"
```
Expected: `EXAM OK: 8 questions`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai-content/exam.ts lib/ai-content/exam.test.ts
git commit -m "feat: exam generation (prompt port, next level mapping)"
```

---

### Task 3: lib/ai-content/placement.ts — prompt + parseCefrLevel (TDD)

**Files:**
- Create: `lib/ai-content/placement.ts`, `lib/ai-content/placement.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  export function buildPlacementPrompt(language: string, historyStr: string): string
  export function parseCefrLevel(text: string): string
  // scan contains pertama dari ["A1","A2","B1","B2","C1","C2"]; default "A1"
  export function formatPlacementHistory(messages: { role: string; text: string }[]): string
  // "{role}: {text}\n" per pesan
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/ai-content/placement.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildPlacementPrompt, formatPlacementHistory, parseCefrLevel } from "./placement";

describe("parseCefrLevel", () => {
  it("biasa", () => {
    expect(parseCefrLevel("B1")).toBe("B1");
    expect(parseCefrLevel("Level pengguna adalah A2.")).toBe("A2");
  });
  it("default A1 saat tidak ada", () => {
    expect(parseCefrLevel("tidak tahu")).toBe("A1");
  });
  it("C2 terbaca (jangan tertangkap C1 dulu? urutan scan)", () => {
    expect(parseCefrLevel("C2")).toBe("C2");
  });
});

describe("formatPlacementHistory", () => {
  it("format role: pesan per baris", () => {
    const out = formatPlacementHistory([
      { role: "AI", text: "Halo" },
      { role: "User", text: "Hi" },
    ]);
    expect(out).toBe("AI: Halo\nUser: Hi\n");
  });
});

describe("buildPlacementPrompt", () => {
  it("memuat bahasa dan tugas", () => {
    const p = buildPlacementPrompt("English", "AI: Halo\n");
    expect(p).toContain("Evaluasi kemampuan bahasa English pengguna");
    expect(p).toContain("Hanya kembalikan dua karakter");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/placement.test.ts` — FAIL.

- [ ] **Step 3: Implementasi**

Prompt verbatim dari `dioxus/src/services/gemini/placement.rs:29-34`:

```ts
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function formatPlacementHistory(messages: { role: string; text: string }[]): string {
  return messages.map((m) => `${m.role}: ${m.text}\n`).join("");
}

export function buildPlacementPrompt(language: string, historyStr: string): string {
  return [
    `Evaluasi kemampuan bahasa ${language} pengguna berdasarkan percakapan berikut:`,
    "",
    historyStr,
    "Tugas: Tentukan level CEFR yang paling tepat (A1, A2, B1, B2, C1, atau C2). Hanya kembalikan dua karakter, yaitu kode level CEFR-nya (misalnya 'A1' atau 'B2'). Tanpa spasi, tanpa teks tambahan.",
  ].join("\n");
}

export function parseCefrLevel(text: string): string {
  const t = text.trim();
  for (const level of CEFR_LEVELS) {
    if (t.includes(level)) return level;
  }
  return "A1";
}
```

Catatan: urutan scan A1→C2 berarti "C2" tidak pernah tertangkap "C1" (C1 diperiksa lebih dulu dan C2 tidak mengandung "C1"). Test "C2 terbaca" memvalidasi ini.

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 81 pass (78 + 3).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: AI smoke (1 panggilan, boleh)**

```powershell
npx tsx --env-file=.env -e "import { generateText } from 'ai'; import { model } from '../lib/ai'; import { buildPlacementPrompt, parseCefrLevel } from './lib/ai-content/placement'; const history = formatPlacementHistory([{role:'AI',text:'Perkenalkan diri Anda'},{role:'User',text:'Hello, my name is John and I like reading books in English'}]); generateText({ model, prompt: buildPlacementPrompt('English', history), maxOutputTokens: 8192 }).then(r => { console.log('PLACEMENT RAW:', JSON.stringify(r.text)); console.log('LEVEL:', parseCefrLevel(r.text)); process.exit(0); }).catch(e => { console.error('PLACEMENT FAIL:', e.message); process.exit(1); })"
```
Expected: raw teks pendek + `LEVEL: <A1..C2>`. Kalau model memberi prosa panjang, parser tetap ambil kode pertama.

- [ ] **Step 6: Commit**

```bash
git add lib/ai-content/placement.ts lib/ai-content/placement.test.ts
git commit -m "feat: placement prompt and cefr parser (TDD)"
```

---

### Task 4: lib/progress.ts — addHeart + exam outcome math + submitExamResult (TDD)

**Files:**
- Modify: `lib/progress.ts`, `lib/progress.test.ts`

**Interfaces:**
- Consumes: `db`, `getUserProfile`, `getCurriculum`, `incrementMissionProgress`, `computeQuizOutcome` (tidak dipakai di exam — exam pakai computeExamOutcome)
- Produces:
  ```ts
  export function computeAddHeart(currentHearts: number): number
  // min(5, current + 1)
  export async function addHeart(email: string): Promise<{ hearts: number }>
  // stats null → create? (legacy: tak ada row → create hearts 1? VERIFIKASI: legacy add_heart baca row; null → return error "Data user tidak ditemukan." — port: throw "Data user tidak ditemukan.")
  // hearts >= 5 → throw "Nyawa sudah penuh!"
  // else update hearts+1; hearts+1 === 5 → lastHeartRefill null
  export interface ExamOutcomeInput {
    correctCount: number; total: number; ptsPerQuestion: number;
  }
  export function computeExamOutcome(input: ExamOutcomeInput): { passingScore: number; passed: boolean; scoreGained: number }
  // passingScore = Math.ceil(total * 0.75); passed = correctCount >= passingScore; scoreGained = correctCount * ptsPerQuestion
  export function nextLevelAfterExam(levels: string[], currentBase: string): string
  // index + 1 bila ada, else tetap
  export async function submitExamResult(email: string, language: string, passed: boolean, scoreGained: number): Promise<UserProfile>
  // port auth.rs:607-732 (detail di Step 4)
  ```

- [ ] **Step 1: Tulis tes gagal**

Tambah ke `lib/progress.test.ts`:
```ts
import { computeAddHeart, computeExamOutcome, nextLevelAfterExam } from "./progress";

describe("computeAddHeart", () => {
  it("naik satu, cap 5", () => {
    expect(computeAddHeart(3)).toBe(4);
    expect(computeAddHeart(5)).toBe(5);
  });
});

describe("computeExamOutcome", () => {
  it("8 soal, 6 benar → lulus (ceil 6), skor 6*pts", () => {
    const r = computeExamOutcome({ correctCount: 6, total: 8, ptsPerQuestion: 10 });
    expect(r).toEqual({ passingScore: 6, passed: true, scoreGained: 60 });
  });
  it("8 soal, 5 benar → tidak lulus", () => {
    expect(computeExamOutcome({ correctCount: 5, total: 8, ptsPerQuestion: 10 }).passed).toBe(false);
  });
  it("4 soal, 3 benar → lulus", () => {
    expect(computeExamOutcome({ correctCount: 3, total: 4, ptsPerQuestion: 20 }).passed).toBe(true);
  });
});

describe("nextLevelAfterExam", () => {
  it("naik ke level berikutnya", () => {
    expect(nextLevelAfterExam(["A1", "A2", "B1", "B2", "C1", "C2"], "A1")).toBe("A2");
  });
  it("C2 tetap C2", () => {
    expect(nextLevelAfterExam(["A1", "A2", "B1", "B2", "C1", "C2"], "C2")).toBe("C2");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/progress.test.ts` — FAIL.

- [ ] **Step 3: Implementasi fungsi murni + addHeart**

Tambah ke `lib/progress.ts`:
```ts
export function computeAddHeart(currentHearts: number): number {
  return Math.min(5, currentHearts + 1);
}

export interface ExamOutcomeInput {
  correctCount: number;
  total: number;
  ptsPerQuestion: number;
}

export function computeExamOutcome(input: ExamOutcomeInput): { passingScore: number; passed: boolean; scoreGained: number } {
  const passingScore = Math.ceil(input.total * 0.75);
  return {
    passingScore,
    passed: input.correctCount >= passingScore,
    scoreGained: input.correctCount * input.ptsPerQuestion,
  };
}

export function nextLevelAfterExam(levels: string[], currentBase: string): string {
  const idx = levels.indexOf(currentBase);
  if (idx < 0 || idx >= levels.length - 1) return currentBase;
  return levels[idx + 1];
}

export async function addHeart(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("Data user tidak ditemukan.");
  if (stats.hearts >= 5) throw new Error("Nyawa sudah penuh!");
  const hearts = computeAddHeart(stats.hearts);
  await db.userEngagementStat.update({
    where: { email },
    data: { hearts, lastHeartRefill: hearts === 5 ? null : stats.lastHeartRefill },
  });
  return { hearts };
}
```

- [ ] **Step 4: Implementasi `submitExamResult`** (port auth.rs:607-732; improvement: `$transaction`)

```ts
const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function submitExamResult(
  email: string,
  language: string,
  passed: boolean,
  scoreGained: number
): Promise<UserProfile> {
  const profile = await getUserProfile(email);
  if (!profile) throw new Error("User tidak ditemukan");

  await incrementMissionProgress(email, "quiz");

  const currentLevel = profile.current_level[language] ?? "A1.0";
  const oldBase = currentLevel.split(".")[0] || "A1";
  const oldTopicIdx = Number(currentLevel.split(".")[1] ?? 0);

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const multiplier = stats?.doubleXpUntil && stats.doubleXpUntil >= new Date() ? 2 : 1;
  const actualScoreGained = scoreGained * multiplier;

  const curriculum = await getCurriculum();
  const levelData = curriculum.find((c) => c.level === oldBase);
  const topicsInLevel = levelData?.topics.length ?? 4;

  let newBase = oldBase;
  let newTopicIdx = oldTopicIdx;
  if (passed && oldTopicIdx >= topicsInLevel) {
    newTopicIdx = 0;
    newBase = nextLevelAfterExam(CEFR_ORDER, oldBase);
  }

  const now = new Date();
  await db.$transaction([
    db.userProgressLog.create({
      data: {
        email, language, activityType: "exam", topic: "Level Exam",
        scoreGained: actualScoreGained, passed, baseLevel: oldBase, topicIdx: oldTopicIdx,
      },
    }),
    db.userLanguageProgress.upsert({
      where: { email_languageId: { email, languageId: language } },
      create: {
        email, languageId: language, baseLevel: newBase, topicIdx: newTopicIdx,
        examCooldownUntil: passed ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
      update: {
        baseLevel: newBase, topicIdx: newTopicIdx,
        examCooldownUntil: passed ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    }),
    db.user.update({ where: { email }, data: { score: { increment: actualScoreGained } } }),
  ]);

  return getUserProfile(email);
}
```

Catatan: `email_languageId` — verifikasi nama di `prisma/schema.prisma` (Task 2 2a sudah memakai ini, aman). Misi "quiz" di luar transaction (pola legacy, konsisten applyQuizResult). Level-up social log `log_activity_server` DILEWATI (fase 4).

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — 85 pass (81 + 4).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/progress.ts lib/progress.test.ts
git commit -m "feat: exam result pipeline (level-up, cooldown, hearts reward)"
```

---

### Task 5: Server actions — practice, exam, placement

**Files:**
- Create: `lib/actions/practice.ts`, `lib/actions/exam.ts`, `lib/actions/placement.ts`

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `getEngagementStats`, `getCurriculum`, `getPriorityWeakness` (lib/weakness.ts), `db`, `generateQuizWithPrompt` + builders (Task 1), `generateExam` (Task 2), `buildPlacementPrompt`/`parseCefrLevel`/`formatPlacementHistory` (Task 3), `addHeart`/`updateEngagementAfterQuiz`/`deductHeart`/`submitExamResult` (Task 4), `logWeakness` (lib/weakness.ts), `shuffleOptions`/`parseAiJson` (lib/ai-content/quiz.ts, parse.ts)
- Produces:
  ```ts
  // lib/actions/practice.ts
  export async function getGeneralPracticeAction(): Promise<{ quiz: QuizContainer; language: string } | { error: string }>
  // cache (goal "general_practice", modifier "normal") ≤5; generateQuizWithPrompt({prompt: buildGeneralPracticePrompt(lang, level), expectedCount: 5, label: "general practice quiz"}); shuffle
  export async function getWeaknessPracticeAction(goal: string): Promise<{ quiz: QuizContainer; language: string; topic: string } | { error: string }>
  // priority = getPriorityWeakness; topic = priority ?? goal; notes 6 terakhir (db.weaknessLog findMany orderBy createdAt desc take 6) → buildWeaknessContext; cache (goal "weakness", modifier topic) ≤5; generateQuizWithPrompt({prompt: buildWeaknessPrompt(...), expectedCount: 3, label: "practice quiz", weaknessFocus: topic}); shuffle
  export async function logPracticeAnswerAction(input: { topic: string; question: string; selected: string; correct: string }): Promise<ActionResult>
  // salah → logWeakness(email, lang, topic, `Practice Q: ${question} | Selected: ${selected} | Correct: ${correct}`); return { message: "ok" }
  export async function submitGeneralPracticeResultAction(input: { perfect: boolean }): Promise<ActionResult>
  // perfect → addHeart (catch "Nyawa sudah penuh!" → abaikan) + updateEngagementAfterQuiz(email, 15); else updateEngagementAfterQuiz(email, 10)

  // lib/actions/exam.ts
  export async function checkExamCooldownAction(level: string): Promise<{ onCooldown: boolean; message: string; tickets: number } | { error: string }>
  // profil gate: base === level && topicIdx >= 4 else { error: `Anda belum menyelesaikan semua topik di level ${level} untuk mengambil ujian ini.` }
  // ulp.examCooldownUntil > now → message "{h} jam {m} menit" / "{m} menit"; tickets dari stats ?? 0
  export async function consumeRetakeTicketAction(level: string): Promise<ActionResult>
  // $transaction: tickets > 0 → update -1 + ulp cooldown NULL; else throw "Anda tidak memiliki tiket retake exam." / "Data user tidak ditemukan."
  export async function getExamAction(level: string): Promise<{ quiz: QuizContainer; language: string; ptsPerQuestion: number } | { error: string }>
  // gate profil sama; topics = db.topic.findMany({where: {levelId: level}, orderBy: {orderIndex: "asc"}}) → titles join ", " fallback "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening"
  // cache (goal "exam", modifier "normal") ≤5; generateExam({language, level, topicsStr}); shuffle; ptsPerQuestion = level base_reward_points (find level by id)
  export async function deductExamHeartAction(): Promise<{ hearts: number } | { error: string }>
  // deductHeart(session.email)
  export async function submitExamResultAction(input: { level: string; passed: boolean; score: number }): Promise<{ profile: UserProfile } | { error: string }>
  // submitExamResult(email, lang, passed, score) → { profile }

  // lib/actions/placement.ts
  export async function evaluatePlacementAction(messages: { role: string; text: string }[]): Promise<{ level: string } | { error: string }>
  // prompt = buildPlacementPrompt(lang, formatPlacementHistory(messages)); generateText({ model, prompt, maxOutputTokens: 8192 });
  // level = parseCefrLevel(text); upsert user_language_progress (baseLevel: level, topicIdx: 0, examCooldownUntil: null); return { level }
  ```

- [ ] **Step 1: Implementasi `lib/actions/practice.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getPriorityWeakness, logWeakness } from "../weakness";
import { addHeart, updateEngagementAfterQuiz } from "../progress";
import { buildGeneralPracticePrompt, buildWeaknessContext, buildWeaknessPrompt, generateQuizWithPrompt, shuffleOptions } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { QuizContainer } from "../types";

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function cacheOrGenerate(params: {
  language: string;
  level: string;
  goal: string;
  modifier: string;
  generate: () => Promise<QuizContainer>;
}): Promise<QuizContainer> {
  const { language, level, goal, modifier, generate } = params;
  const variants = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier } });
  if (variants.length >= 5) {
    const parsed = parseAiJson<QuizContainer>(randomPick(variants).contentJson);
    if (parsed) return parsed;
  }
  const quiz = await generate();
  await db.cachedQuiz.create({
    data: { language, level, goal, modifier, contentJson: JSON.stringify(quiz) },
  });
  return quiz;
}

export async function getGeneralPracticeAction(): Promise<{ quiz: QuizContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  const quiz = await cacheOrGenerate({
    language, level, goal: "general_practice", modifier: "normal",
    generate: () => generateQuizWithPrompt({
      prompt: buildGeneralPracticePrompt(language, level),
      expectedCount: 5,
      label: "general practice quiz",
    }),
  });
  return { quiz: shuffleOptions(quiz), language };
}

export async function getWeaknessPracticeAction(goal: string): Promise<{ quiz: QuizContainer; language: string; topic: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const priority = await getPriorityWeakness(session.email, language);
  const topic = priority ?? goal;

  const notes = await db.weaknessLog.findMany({
    where: { email: session.email, language, topic },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const weaknessContext = buildWeaknessContext(notes.map((n) => n.note));

  const quiz = await cacheOrGenerate({
    language, level, goal: "weakness", modifier: topic,
    generate: () => generateQuizWithPrompt({
      prompt: buildWeaknessPrompt(language, level, topic, weaknessContext),
      expectedCount: 3,
      label: "practice quiz",
      weaknessFocus: topic,
    }),
  });
  return { quiz: shuffleOptions(quiz), language, topic };
}

export async function logPracticeAnswerAction(input: {
  topic: string;
  question: string;
  selected: string;
  correct: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  await logWeakness(
    session.email,
    profile.preferred_language,
    input.topic,
    `Practice Q: ${input.question} | Selected: ${input.selected} | Correct: ${input.correct}`
  );
  return { message: "ok" };
}

export async function submitGeneralPracticeResultAction(input: { perfect: boolean }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (input.perfect) {
    await addHeart(session.email).catch(() => {}); // "Nyawa sudah penuh!" → abaikan (fire-and-forget legacy)
    await updateEngagementAfterQuiz(session.email, 15);
  } else {
    await updateEngagementAfterQuiz(session.email, 10);
  }
  return { message: "ok" };
}
```

- [ ] **Step 2: Implementasi `lib/actions/exam.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { deductHeart, submitExamResult } from "../progress";
import { generateExam } from "../ai-content/exam";
import { shuffleOptions } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { QuizContainer, UserProfile } from "../types";

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function requireLevel(sessionEmail: string, level: string): Promise<{ profile: UserProfile; language: string } | { error: string }> {
  const profile = await getUserProfile(sessionEmail);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const language = profile.preferred_language;
  const current = profile.current_level[language] ?? "A1.0";
  const base = current.split(".")[0];
  const topicIdx = Number(current.split(".")[1] ?? 0);
  if (base !== level || topicIdx < 4) {
    return { error: `Anda belum menyelesaikan semua topik di level ${level} untuk mengambil ujian ini.` };
  }
  return { profile, language };
}

export async function checkExamCooldownAction(level: string): Promise<{ onCooldown: boolean; message: string; tickets: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  const row = await db.userLanguageProgress.findUnique({
    where: { email_languageId: { email: session.email, languageId: gate.language } },
  });
  let onCooldown = false;
  let message = "";
  if (row?.examCooldownUntil && row.examCooldownUntil > new Date()) {
    onCooldown = true;
    const diffMs = row.examCooldownUntil.getTime() - Date.now();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    message = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
  }
  const stats = await db.userEngagementStat.findUnique({ where: { email: session.email } });
  return { onCooldown, message, tickets: stats?.examRetakeTickets ?? 0 };
}

export async function consumeRetakeTicketAction(level: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  try {
    await db.$transaction(async (tx) => {
      const stats = await tx.userEngagementStat.findUnique({ where: { email: session.email } });
      if (!stats) throw new Error("Data user tidak ditemukan.");
      if (stats.examRetakeTickets <= 0) throw new Error("Anda tidak memiliki tiket retake exam.");
      await tx.userEngagementStat.update({
        where: { email: session.email },
        data: { examRetakeTickets: { decrement: 1 } },
      });
      await tx.userLanguageProgress.update({
        where: { email_languageId: { email: session.email, languageId: gate.language } },
        data: { examCooldownUntil: null },
      });
    });
    return { message: "ok" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menggunakan tiket." };
  }
}

export async function getExamAction(level: string): Promise<{ quiz: QuizContainer; language: string; ptsPerQuestion: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const gate = await requireLevel(session.email, level);
  if ("error" in gate) return { error: gate.error };

  const topics = await db.topic.findMany({
    where: { levelId: level },
    orderBy: { orderIndex: "asc" },
  });
  const topicsStr = topics.map((t) => t.title).join(", ") || "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening";

  const variants = await db.cachedQuiz.findMany({ where: { language: gate.language, level, goal: "exam", modifier: "normal" } });
  let quiz: QuizContainer | null = null;
  if (variants.length >= 5) {
    quiz = parseAiJson<QuizContainer>(randomPick(variants).contentJson);
  }
  if (!quiz) {
    quiz = await generateExam({ language: gate.language, level, topicsStr });
    await db.cachedQuiz.create({
      data: { language: gate.language, level, goal: "exam", modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  }

  const levelData = await db.level.findUnique({ where: { id: level } });
  return { quiz: shuffleOptions(quiz), language: gate.language, ptsPerQuestion: levelData?.baseRewardPoints ?? 10 };
}

export async function deductExamHeartAction(): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const { hearts } = await deductHeart(session.email);
  return { hearts };
}

export async function submitExamResultAction(input: { passed: boolean; score: number }): Promise<{ profile: UserProfile } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const updated = await submitExamResult(session.email, profile.preferred_language, input.passed, input.score);
  return { profile: updated };
}
```

Catatan: `submitExamResultAction` tidak butuh `level` param — level diturunkan dari profil (legacy: submit tak pakai level, ia baca progress). Konsisten.

- [ ] **Step 3: Implementasi `lib/actions/placement.ts`**

```ts
"use server";

import { generateText } from "ai";
import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { model } from "../ai";
import { buildPlacementPrompt, formatPlacementHistory, parseCefrLevel } from "../ai-content/placement";
import { db } from "../db";

export async function evaluatePlacementAction(
  messages: { role: string; text: string }[]
): Promise<{ level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const prompt = buildPlacementPrompt(language, formatPlacementHistory(messages));

  const { text } = await generateText({ model, prompt, maxOutputTokens: 8192 });
  const level = parseCefrLevel(text);

  await db.userLanguageProgress.upsert({
    where: { email_languageId: { email: session.email, languageId: language } },
    create: { email: session.email, languageId: language, baseLevel: level, topicIdx: 0, examCooldownUntil: null },
    update: { baseLevel: level, topicIdx: 0 },
  });

  return { level };
}
```

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit` — bersih.
Run: `npm test` — 85 pass.
Run: `npm run lint` — 0 error.
Smoke AI nyata (2 panggilan, boleh):
```powershell
npx tsx --env-file=.env -e "import { generateQuizWithPrompt, buildGeneralPracticePrompt } from './lib/ai-content/quiz'; generateQuizWithPrompt({ prompt: buildGeneralPracticePrompt('English', 'A1'), expectedCount: 5, label: 'general practice quiz' }).then(z => { console.log('GP OK:', z.questions.length); return import('./lib/ai-content/quiz').then(m => m.generateQuizWithPrompt({ prompt: m.buildWeaknessPrompt('English', 'A1', 'Grammar: Tense', ''), expectedCount: 3, label: 'practice quiz', weaknessFocus: 'Grammar: Tense' })); }).then(z2 => { console.log('WP OK:', z2.questions.length); process.exit(0); }).catch(e => { console.error('FAIL:', e.message); process.exit(1); })"
```
Expected: `GP OK: 5` dan `WP OK: 3`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/practice.ts lib/actions/exam.ts lib/actions/placement.ts
git commit -m "feat: practice/exam/placement server actions with caching and session guard"
```

---

### Task 6: Halaman general-practice + weakness-practice (PracticeView shared)

**Files:**
- Create: `components/PracticeView.tsx`, `app/(app)/general-practice/page.tsx`, `app/(app)/practice/[goal]/page.tsx`

**Interfaces:**
- Consumes: `getGeneralPracticeAction`/`getWeaknessPracticeAction`/`logPracticeAnswerAction`/`submitGeneralPracticeResultAction` (Task 5), `incrementMissionAction` (lib/actions/mission.ts), `sanitizeHtml`, `SpeakButton`
- Produces: dua halaman dengan state machine shared (mode general / weakness)

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/general-practice/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import PracticeView from "@/components/PracticeView";

export default async function GeneralPracticePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <PracticeView mode="general" language={langId} ttsLang={ttsLang} />;
}
```

Create `app/(app)/practice/[goal]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import PracticeView from "@/components/PracticeView";

export default async function PracticePage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <PracticeView mode="weakness" goal={decodeURIComponent(goal)} language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 2: `components/PracticeView.tsx`**

State machine shared (pola QuizView 2a — loading / error / answering / finished + mistakes count untuk general):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGeneralPracticeAction, getWeaknessPracticeAction, logPracticeAnswerAction, submitGeneralPracticeResultAction } from "@/lib/actions/practice";
import { incrementMissionAction } from "@/lib/actions/mission";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { QuizContainer } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"];

type Mode = "general" | "weakness";

const STRINGS: Record<Mode, { loading: string; loadingSub: string; badge: string; finished: string; finishedSub: string }> = {
  general: {
    loading: "Menyiapkan Latihan...",
    loadingSub: "Sedang merancang soal latihan umum untuk Anda. Mohon tunggu sebentar.",
    badge: "Latihan Acak",
    finished: "Latihan Selesai!",
    finishedSub: "Kamu berhasil menuntaskan latihan acak ini.",
  },
  weakness: {
    loading: "Menyiapkan Latihan Kelemahan...",
    loadingSub: "Sedang menganalisis riwayat kelemahan Anda dan menyusun soal latihan yang tepat.",
    badge: "Fokus Kelemahan",
    finished: "Latihan Selesai!",
    finishedSub: "Kamu berhasil menuntaskan latihan fokus kelemahan.",
  },
};

export default function PracticeView({
  mode,
  goal,
  language,
  ttsLang,
}: {
  mode: Mode;
  goal?: string;
  language: string;
  ttsLang: string;
}) {
  const [phase, setPhase] = useState<"loading" | "answering" | "finished">("loading");
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = mode === "general"
      ? getGeneralPracticeAction()
      : getWeaknessPracticeAction(goal ?? "General");
    load
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          setPhase("answering"); // layar error dirender lewat branch error di bawah
          return;
        }
        setQuiz(res.quiz);
        if ("topic" in res) setTopic(res.topic);
        setPhase("answering");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat latihan.");
        setPhase("answering");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, goal, reloadKey]);

  const question = quiz?.questions[idx];
  const strings = STRINGS[mode];

  function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    if (!isCorrect) {
      setMistakes((m) => m + 1);
      if (mode === "weakness" && topic) {
        logPracticeAnswerAction({
          topic,
          question: question.question,
          selected,
          correct: question.correct_answer,
        }).catch(() => {});
      }
    }
    setShowExplanation(true);
  }

  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    if (mode === "general") {
      const res = await submitGeneralPracticeResultAction({ perfect: mistakes === 0 });
      if ("error" in res) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      setReward(mistakes === 0 ? "1 Nyawa ❤️ & 15 Poin + Koin 🪙" : "10 Poin + Koin 🪙");
    } else {
      await incrementMissionAction("weakness").catch(() => {});
    }
    setSubmitting(false);
    setPhase("finished");
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Latihan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setPhase("loading"); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (phase === "loading" || !quiz) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">{strings.loading}</p>
        <p className="text-sm text-slate-400">{strings.loadingSub}</p>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">{strings.finished}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{strings.finishedSub}</p>
        {mode === "general" && reward && (
          <div className="bg-teal-500/10 border border-teal-500/40 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hadiah Didapatkan</p>
            <p className="font-bold text-teal-700 dark:text-teal-400 mt-1">{reward}</p>
          </div>
        )}
        {mode === "weakness" && topic && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topik Fokus</p>
            <p className="font-bold text-amber-700 dark:text-amber-400 mt-1">{topic}</p>
          </div>
        )}
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const isLast = idx === quiz.questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">{strings.badge}</span>
          {mode === "weakness" && topic && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">Fokus Kelemahan: {topic}</span>
          )}
          {question.question_type === "listening" && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">Listening Test</span>
          )}
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${((idx + 1) / quiz.questions.length) * 100}%` }} />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz.questions.length}</p>

      {question.question_type === "listening" && (
        <div className="flex items-center gap-3 mb-4">
          <SpeakButton text={question.listen_text} lang={ttsLang} rate={0.95} />
          <span className="text-xs text-slate-400">Dengarkan audio, lalu pilih jawaban</span>
        </div>
      )}

      <div className="text-lg font-bold mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }} />

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrectOpt = showExplanation && opt === question.correct_answer;
          const isWrongOpt = showExplanation && isSelected && opt !== question.correct_answer;
          return (
            <button
              key={i}
              type="button"
              disabled={showExplanation}
              onClick={() => setSelected(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-colors ${
                isCorrectOpt ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : isWrongOpt ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                : isSelected ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400"
                : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{OPTION_LETTERS[i]}</span>
              <span className="flex-1">{opt}</span>
              <SpeakButton text={opt} lang={ttsLang} rate={0.9} />
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`mt-4 p-4 rounded-2xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">{selected === question.correct_answer ? "✓ Jawaban Benar!" : "✗ Jawaban Salah!"}</p>
          {selected !== question.correct_answer && <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button type="button" disabled={!selected} onClick={checkAnswer} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
            Cek Jawaban
          </button>
        ) : isLast ? (
          <button type="button" disabled={submitting} onClick={finish} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
            {submitting ? "Menyimpan..." : "Selesai"}
          </button>
        ) : (
          <button type="button" onClick={() => { setIdx((i) => i + 1); setSelected(null); setShowExplanation(false); }} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint` (0 error — perhatikan unescaped entities), `npx tsc --noEmit` (0 error), `npm test` (85 pass).

- [ ] **Step 4: Commit**

```bash
git add components/PracticeView.tsx "app/(app)/general-practice/page.tsx" "app/(app)/practice/[goal]/page.tsx"
git commit -m "feat: general and weakness practice pages (shared quiz view)"
```

---

### Task 7: Halaman Exam

**Files:**
- Create: `components/ExamView.tsx`, `app/(app)/exam/[level]/page.tsx`

**Interfaces:**
- Consumes: `checkExamCooldownAction`/`consumeRetakeTicketAction`/`getExamAction`/`deductExamHeartAction`/`submitExamResultAction` (Task 5), `getEngagementStats` (lib/dashboard.ts), `sanitizeHtml`, `SpeakButton`
- Produces: halaman `/exam/:level` dengan gates + state machine

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/exam/[level]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getEngagementStats, getLanguages } from "@/lib/dashboard";
import ExamView from "@/components/ExamView";

export default async function ExamPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, stats] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getEngagementStats(session.email),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <ExamView level={level} language={langId} ttsLang={ttsLang} initialHearts={stats?.hearts ?? 5} />;
}
```

- [ ] **Step 2: `components/ExamView.tsx`**

Fase: `gates` (cek level + hearts + cooldown) → `ready` → `loading` → `answering` → `result`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkExamCooldownAction, consumeRetakeTicketAction, deductExamHeartAction, getExamAction, submitExamResultAction } from "@/lib/actions/exam";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { QuizContainer } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"];

type Phase =
  | { name: "checking" }
  | { name: "gates"; onCooldown: boolean; cooldownMessage: string; tickets: number }
  | { name: "ready" }
  | { name: "loading" }
  | { name: "answering" }
  | { name: "result"; passed: boolean; correct: number; total: number; passingScore: number; score: number; submitting: boolean };

export default function ExamView({
  level,
  language,
  ttsLang,
  initialHearts,
}: {
  level: string;
  language: string;
  ttsLang: string;
  initialHearts: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const [gateError, setGateError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [ptsPerQuestion, setPtsPerQuestion] = useState(10);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(initialHearts);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadExam = useCallback(async () => {
    setPhase({ name: "loading" });
    const res = await getExamAction(level);
    if ("error" in res) {
      setLoadingError(res.error);
      setPhase({ name: "ready" }); // error dirender di branch error bawah
      return;
    }
    setQuiz(res.quiz);
    setPtsPerQuestion(res.ptsPerQuestion);
    setPhase({ name: "answering" });
  }, [level]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cooldownRes = await checkExamCooldownAction(level);
      if (cancelled) return;
      if ("error" in cooldownRes) {
        setGateError(cooldownRes.error);
        return;
      }
      if (initialHearts <= 0) {
        setPhase({ name: "gates", onCooldown: false, cooldownMessage: "", tickets: 0 });
        return; // hearts screen dirender berdasarkan initialHearts <= 0
      }
      setPhase({ name: "gates", onCooldown: cooldownRes.onCooldown, cooldownMessage: cooldownRes.message, tickets: cooldownRes.tickets });
    })().catch((e: unknown) => {
      if (cancelled) return;
      setGateError(e instanceof Error ? e.message : "Gagal memeriksa ujian.");
    });
    return () => {
      cancelled = true;
    };
  }, [level, reloadKey]);

  async function useTicket() {
    const res = await consumeRetakeTicketAction(level);
    if ("error" in res) {
      setGateError(res.error);
      return;
    }
    setReloadKey((k) => k + 1);
  }

  function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else {
      setHearts((h) => Math.max(0, h - 1));
      deductExamHeartAction().catch(() => {});
    }
    setShowExplanation(true);
  }

  async function submitResult() {
    const total = quiz?.questions.length ?? 0;
    const passingScore = Math.ceil(total * 0.75);
    const passed = correctCount >= passingScore;
    const score = correctCount * ptsPerQuestion;
    setPhase({ name: "result", passed, correct: correctCount, total, passingScore, score, submitting: true });
    const res = await submitExamResultAction({ passed, score });
    if ("error" in res) {
      setPhase({ name: "result", passed, correct: correctCount, total, passingScore, score, submitting: false });
      setGateError(res.error);
      return;
    }
    setPhase({ name: "result", passed, correct: correctCount, total, passingScore, score, submitting: false });
  }

  const question = quiz?.questions[idx];

  // ---- gates / error screens ----
  if (gateError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Ujian Belum Terbuka</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{gateError}</p>
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (initialHearts <= 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">💔</p>
        <p className="text-2xl font-black">Nyawa Kamu Habis!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">Kamu butuh minimal 1 Nyawa untuk mengikuti ujian ini.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Isi Ulang di Beranda</Link>
      </div>
    );
  }

  if (phase.name === "checking") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Memeriksa Status Ujian...</p>
      </div>
    );
  }

  if (phase.name === "gates" && phase.onCooldown) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">⏳</p>
        <p className="text-2xl font-black">Ujian Terkunci</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Anda baru saja gagal dalam ujian ini. Silakan istirahat dan pelajari kembali materi.</p>
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Bisa diulang dalam: {phase.cooldownMessage}</p>
        {phase.tickets > 0 ? (
          <button type="button" onClick={useTicket} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Gunakan 1 Tiket
          </button>
        ) : (
          <p className="text-xs text-slate-400">Tidak punya Tiket Ujian Ulang.</p>
        )}
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (phase.name === "gates" || phase.name === "ready") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🎓</p>
        <p className="text-2xl font-black">Siap Ujian?</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Ujian ini akan menguji pemahaman Anda di level {level}. Jika gagal, Anda harus menunggu 24 jam untuk mengulang.</p>
        {loadingError && <p className="text-xs text-rose-500 max-w-md">{loadingError}</p>}
        <button type="button" onClick={() => { setLoadingError(null); loadExam(); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Mulai Ujian 🚀
        </button>
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (phase.name === "loading" || !question) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyusun Soal Ujian...</p>
        <p className="text-sm text-slate-400">Mempersiapkan materi ujian sesuai kurikulum. Proses ini mungkin memakan waktu hingga 30 detik untuk memastikan kualitas soal.</p>
      </div>
    );
  }

  if (phase.name === "result") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">{phase.passed ? "🎉" : "💪"}</p>
        <p className="text-2xl font-black">{phase.passed ? "LULUS UJIAN!" : "BELUM LULUS"}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          {phase.passed
            ? `Selamat! Anda telah menguasai materi level ${level} dan siap untuk melangkah lebih jauh.`
            : "Jangan menyerah! Pelajari lagi bagian yang kurang dan coba kembali ujian ini nanti."}
        </p>
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span>Skor Anda</span>
            <span>{phase.correct} / {phase.total}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(phase.correct / phase.total) * 100}%` }} />
          </div>
        </div>
        <p className="text-xs text-slate-400">Batas kelulusan minimal {phase.passingScore} benar (75%).</p>
        {phase.submitting ? (
          <p className="text-sm font-bold text-slate-400">Menyimpan...</p>
        ) : (
          <button type="button" onClick={() => router.push("/roadmap")} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kembali ke Roadmap
          </button>
        )}
      </div>
    );
  }

  const isLast = idx === (quiz?.questions.length ?? 0) - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/roadmap" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">Ujian {level}</span>
          {question.question_type === "listening" && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">Listening Test</span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">❤️ {hearts}</span>
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${((idx + 1) / (quiz?.questions.length ?? 8)) * 100}%` }} />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz?.questions.length}</p>

      {question.question_type === "listening" && (
        <div className="flex items-center gap-3 mb-4">
          <SpeakButton text={question.listen_text} lang={ttsLang} rate={0.95} />
          <span className="text-xs text-slate-400">Dengarkan audio, lalu pilih jawaban</span>
        </div>
      )}

      <div className="text-lg font-bold mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }} />

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrectOpt = showExplanation && opt === question.correct_answer;
          const isWrongOpt = showExplanation && isSelected && opt !== question.correct_answer;
          return (
            <button
              key={i}
              type="button"
              disabled={showExplanation}
              onClick={() => setSelected(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-colors ${
                isCorrectOpt ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : isWrongOpt ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                : isSelected ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-slate-200 dark:border-slate-700 hover:border-amber-500/50"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{OPTION_LETTERS[i]}</span>
              <span className="flex-1">{opt}</span>
              <SpeakButton text={opt} lang={ttsLang} rate={0.9} />
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`mt-4 p-4 rounded-2xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">{selected === question.correct_answer ? "✓ Tepat Sekali" : "✗ Jawaban Salah"}</p>
          {selected !== question.correct_answer && <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button type="button" disabled={!selected} onClick={checkAnswer} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold">
            Kunci Jawaban
          </button>
        ) : isLast ? (
          <button type="button" onClick={submitResult} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
            Selesai & Lihat Hasil Ujian
          </button>
        ) : (
          <button type="button" onClick={() => { setIdx((i) => i + 1); setSelected(null); setShowExplanation(false); }} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
    </div>
  );
}
```

Catatan: `loadExam` dipanggil dari handler tombol (bukan effect) — tidak kena lint set-state-in-effect. Gate cooldown effect pakai IIFE async + cancelled (pola aman).

- [ ] **Step 3: Verifikasi**

Run: `npm run lint` (0 error), `npx tsc --noEmit` (0 error), `npm test` (85 pass).

- [ ] **Step 4: Commit**

```bash
git add components/ExamView.tsx "app/(app)/exam/[level]/page.tsx"
git commit -m "feat: exam page with gates, cooldown, tickets, and level-up"
```

---

### Task 8: Halaman Placement

**Files:**
- Create: `components/PlacementView.tsx`, `app/(app)/placement/page.tsx`

**Interfaces:**
- Consumes: `evaluatePlacementAction` (Task 5)
- Produces: halaman `/placement` (chat UI + evaluasi)

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/placement/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import PlacementView from "@/components/PlacementView";

export default async function PlacementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  return <PlacementView language={langId} />;
}
```

- [ ] **Step 2: `components/PlacementView.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { evaluatePlacementAction } from "@/lib/actions/placement";

interface ChatMessage {
  role: "AI" | "User";
  text: string;
}

const SCRIPTED = [
  "Bagus sekali! Bisakah Anda menceritakan kegiatan rutin Anda di akhir pekan?",
  "Menarik! Apa pengalaman paling berkesan dalam hidup Anda sejauh ini?",
  "Terima kasih! Percakapan ini sudah cukup. Silakan klik tombol 'Evaluasi Level Saya' di bawah.",
];

export default function PlacementView({ language }: { language: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "AI",
      text: `Halo! Saya akan melakukan tes penempatan bahasa ${language} singkat untuk Anda. Mari kita mulai: Tolong perkenalkan diri Anda dan ceritakan sedikit tentang hobi Anda dalam bahasa ${language}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userMessages = messages.filter((m) => m.role === "User").length;

  function send() {
    const text = input.trim();
    if (!text || evaluating || result) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "User", text }];
    const userCount = nextMessages.filter((m) => m.role === "User").length;
    if (userCount <= 3) {
      nextMessages.push({ role: "AI", text: SCRIPTED[userCount - 1] });
    }
    setMessages(nextMessages);
    setInput("");
  }

  async function evaluate() {
    if (evaluating) return;
    setEvaluating(true);
    setError(null);
    const res = await evaluatePlacementAction(messages);
    if ("error" in res) {
      setError(res.error);
      setEvaluating(false);
      return;
    }
    setResult(res.level);
    setEvaluating(false);
  }

  if (result) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-2xl font-black">Evaluasi Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Level bahasa Anda saat ini adalah:</p>
        <div className="w-24 h-24 rounded-full bg-teal-500/10 border-4 border-teal-500 flex items-center justify-center">
          <span className="text-3xl font-black text-teal-600 dark:text-teal-400">{result}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-sm">Level ini telah disimpan ke profil Anda. Materi pembelajaran Anda selanjutnya akan disesuaikan dengan level ini.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold mb-1">Tes Penempatan</h1>
      <p className="text-xs font-bold text-slate-400 mb-6">{language}</p>

      <div className="space-y-3 mb-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "User" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
              m.role === "User"
                ? "bg-teal-500 text-white rounded-br-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-rose-500 mb-3 text-center">{error}</p>}

      {userMessages >= 3 ? (
        <button
          type="button"
          disabled={evaluating}
          onClick={evaluate}
          className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
        >
          {evaluating ? "Mengevaluasi Level..." : "Selesai & Evaluasi Level Saya"}
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ketik jawaban Anda di sini..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
          <button type="button" onClick={send} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kirim
          </button>
        </div>
      )}
    </div>
  );
}
```

Catatan: legacy menampilkan follow-up "Jika Anda bisa bepergian..." hanya jika user mengirim pesan ke-3 SEBELUM menekan evaluasi; di port, tombol evaluasi muncul setelah ≥3 pesan user (dan follow-up ke-3 "Terima kasih..." dikirim saat pesan user ke-3). Perilaku setara dengan legacy (tombol evaluasi muncul ≥1 pesan di legacy; di port dipindah ke ≥3 agar follow-up scripted selalu terkirim — PERUBAHAN KECIL yang disengaja: evaluasi setelah percakapan lengkap; legacy memunculkan tombol lebih awal namun follow-up ke-3 adalah dead code).

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (85 pass).

- [ ] **Step 4: Commit**

```bash
git add components/PlacementView.tsx "app/(app)/placement/page.tsx"
git commit -m "feat: placement test page with AI evaluation"
```

---

### Task 9: Integrasi (roadmap exam button + dashboard CTA) + AGENTS.md + verifikasi final

**Files:**
- Modify: `app/(app)/roadmap/page.tsx`, `app/(app)/dashboard/page.tsx`, `AGENTS.md`

- [ ] **Step 1: Roadmap — tombol exam per level**

Edit `app/(app)/roadmap/page.tsx`:
- Hapus teks footer `"Ujian kenaikan tingkat, chat, dan mode suara akan tersedia di fase berikutnya."`
- Di dalam peta level, setelah grid topik tiap level, tambah tombol exam:

```tsx
{lv.unlocked && (
  <div className="mt-3">
    {lv.currentLevel && activeTopicIdx < 4 ? (
      <span className="inline-block px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold">
        🔒 Ujian Kenaikan Tingkat (Selesaikan semua topik)
      </span>
    ) : (
      <Link
        href={`/exam/${lv.level}`}
        className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold hover:opacity-90 transition-opacity"
      >
        🎓 Ujian Kenaikan Tingkat
      </Link>
    )}
  </div>
)}
```

Catatan unlock: level terlewati (`idx < activeLevelIdx`) ATAU level aktif dengan `activeTopicIdx >= 4` → tombol aktif; level aktif belum ≥4 topik → 🔒; level terkunci (`!lv.unlocked`) → tidak ditampilkan tombol (belum terjangkau). Tambah `import Link from "next/link"` bila belum ada.

- [ ] **Step 2: Dashboard — 3 CTA card**

Edit `app/(app)/dashboard/page.tsx` — setelah grid statistik, sebelum grid misi/lanjutkan, tambah:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <Link href="/general-practice" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
    <p className="text-xl">🎲</p>
    <p className="font-extrabold mt-2">Latihan Acak</p>
    <p className="text-xs text-slate-400 mt-1">+1 Nyawa ❤️ dan +15 Poin + Koin 🪙</p>
  </Link>
  <Link href="/practice/General" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
    <p className="text-xl">🎯</p>
    <p className="font-extrabold mt-2">Latihan Kelemahan</p>
    <p className="text-xs text-slate-400 mt-1">Fokus pada topik yang paling sering salah</p>
  </Link>
  <Link href="/placement" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
    <p className="text-xl">📝</p>
    <p className="font-extrabold mt-2">Tes Penempatan</p>
    <p className="text-xs text-slate-400 mt-1">Belum yakin dengan level Anda?</p>
  </Link>
</div>
```

Tambah `import Link from "next/link"` bila belum ada di dashboard.

- [ ] **Step 3: AGENTS.md**

Perbarui:
- Routes: tambah `/general-practice`, `/practice/:goal`, `/exam/:level`, `/placement`
- lib: `ai-content/exam.ts`, `ai-content/placement.ts`, `actions/practice.ts|exam.ts|placement.ts`
- Konvensi: pipeline generic `generateQuizWithPrompt`; placement menyimpan ke `user_language_progress` (bukan users.current_level — kolom itu legacy drop)
- Status migrasi: Fase 2b selesai (practice/exam/placement); tersisa: AI interaktif chat/voice/story + TTS backend (3), gamifikasi (4), admin (5), cron + deploy Vercel + cutover (6)

- [ ] **Step 4: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```
Expected: lint 0 error (warning <img> pre-existing boleh); tsc bersih; 85 test pass; build sukses; migrate status "up to date".

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/roadmap/page.tsx" "app/(app)/dashboard/page.tsx" AGENTS.md
git commit -m "docs: integrate phase 2b entry points and update AGENTS.md"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Pipeline generic + prompt practice | 73 test (7 baru) |
| 2. Exam generation | 78 test (5 baru) + smoke AI 8 soal |
| 3. Placement prompt + parser | 81 test (3 baru) + smoke AI |
| 4. Exam outcome + addHeart + submitExamResult | 85 test (4 baru) |
| 5. Actions practice/exam/placement | tsc/lint + smoke AI (GP 5, WP 3) |
| 6. Halaman practice (shared) | lint/tsc/test |
| 7. Halaman exam | lint/tsc/test |
| 8. Halaman placement | lint/tsc/test |
| 9. Integrasi + AGENTS + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **Model AI + 8 soal exam**: 8 soal dengan explanation panjang bisa memakan banyak token; `maxOutputTokens: 8192` + retry 3x sudah terbukti di 2a untuk 5 soal. Bila exam konsisten gagal quality (misal kurang listening), smoke di Task 2 akan menangkapnya — laporkan pola gagalnya.
- **Placement scripted flow**: port memindah kemunculan tombol evaluasi dari ≥1 ke ≥3 pesan user (perbaikan dead-code legacy). Verifikasi UX saat smoke manual.
- **Cooldown check di effect**: pola IIFE async + cancelled (bukan setState langsung di effect body) — wajib untuk lint.
- **`email_languageId` upsert key**: sudah terpakai di Task 2 2a (applyQuizResult) — aman.
