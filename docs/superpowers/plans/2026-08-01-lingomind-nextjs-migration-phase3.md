# LingoMind Fase 3 — AI Interaktif (Chat + Voice Chat + Story + Pronunciation) — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport 4 fitur AI interaktif ke Next.js: chat roleplay (sesi DB + skenario + Koreksi AI), voice chat (STT browser + TTS Web Speech), story interaktif (4 segmen + soal komprehensi + reward XP), dan pronunciation practice (STT → evaluasi AI per kata).

**Architecture:** Backend chat di `lib/chat.ts` (DB: `db.chatSession`/`db.chatMessage` — sudah ada di Prisma, tanpa migration) + `lib/ai-content/chat.ts` (prompt builder murni + generateChatReply via AI SDK messages param dengan role yang benar: system/user/assistant). Story & pronunciation murni AI (tanpa tabel). Fungsi murni (history builder, Koreksi split, parser JSON/array, prompt builders) diuji vitest. STT via hook `useSpeechRecognition` (SpeechRecognition || webkitSpeechRecognition, tanpa backend); TTS via `speechSynthesis` (SpeakButton sudah ada).

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), Vercel AI SDK (opencode.ai, `OPENCODE_AI_MODEL`), vitest, Web Speech API (STT + TTS).

**Referensi kode lama (sumber kebenaran):**
- Chat: `dioxus/src/services/gemini/chat.rs` (opening prompt topik/persona, reply prompt + Koreksi:, window 10, riwayat 120), `dioxus/src/views/chat.rs` (picker 8 preset, bubbles, optimistic push)
- Voice chat: `dioxus/src/views/voice_chat.rs` (status loop, STT JS injection, avatar), `dioxus/src/services/gemini/tts.rs` (voice mapping — TIDAK dipakai, diganti Web Speech; tts_lang_code tetap dipakai)
- Story: `dioxus/src/services/gemini/story.rs` (prompt verbatim), `dioxus/src/views/story.rs` (state machine, reward 20)
- Pronunciation: `dioxus/src/services/gemini/pronunciation.rs` (2 prompt verbatim), `dioxus/src/views/pronunciation_practice.rs` (UI states)

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis legacy (dikutip di tiap task).
- **Prisma**: `db.chatSession` (id, email, language, level, roleplaySetting, goal, createdAt), `db.chatMessage` (id, sessionId, sender "user"|"ai", content, createdAt) — TIDAK ada perubahan skema.
- **Setiap server action yang butuh user memanggil `getSession()`**; error session = `Sesi berakhir. Silakan login kembali.`
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`**; fire-and-forget dari client selalu `.catch(() => {})`.
- AI: `maxOutputTokens: 8192`; temperature: opening 0.8, reply 0.7, story 0.7, sentences 0.7, evaluation 0.2; retry terbatas (story 3 attempts dengan feedback; chat reply 1 retry saat kosong; evaluation 1 retry saat parse gagal).
- `generateChatReply` memakai AI SDK `messages` param (role system/user/assistant) — setia pada contents legacy (user/model).
- Chat content adalah PLAIN TEXT (whitespace-pre-wrap, tanpa sanitize HTML — React escaping cukup).
- Aset avatar: `dioxus/assets/avatar_*.gif|png` → `public/` (git mv? tidak — file belum di-repo root; copy via `Copy-Item` lalu `git add`).
- Tanpa perubahan schema; `npx prisma migrate status` tetap up to date.

---

### Task 1: lib/chat.ts + lib/ai-content/chat.ts (TDD)

**Files:**
- Create: `lib/chat.ts`, `lib/ai-content/chat.ts`, `lib/ai-content/chat.test.ts`
- Modify: `lib/types.ts` (tambah `ChatMessageItem`)

**Interfaces:**
- Consumes: `db`, `model`, `generateText`, `getUserProfile`
- Produces:
  ```ts
  // lib/types.ts
  export interface ChatMessageItem { id: number; sender: "user" | "ai"; content: string; }

  // lib/chat.ts
  export function normalizeSetting(setting: string): string  // trim + collapse ws; lempar "Nama skenario tidak boleh kosong." / "Nama skenario maksimal 50 karakter."
  export function splitKoreksi(content: string): { main: string; koreksi: string | null }
  export async function findOrCreateSession(email: string, language: string, level: string, goal: string, setting: string): Promise<{ sessionId: number; messages: ChatMessageItem[] }>
  // findUnique by (email, language, level, goal, roleplaySetting) → ada: fetchHistory(120); tidak: create + return { sessionId, messages: [] }
  export async function fetchHistory(sessionId: number, limit: number): Promise<ChatMessageItem[]>
  // findMany orderBy createdAt asc, take limit → map {id, sender, content}

  // lib/ai-content/chat.ts
  export function buildChatHistory(messages: { sender: string; content: string }[]): { role: "user" | "assistant"; content: string }[]
  export function buildOpeningPrompt(language: string, level: string, goal: string, setting: string, isTopicBased: boolean): string
  // mengembalikan { system: ..., user: ... }? — NO: return dua string via objek: { system: string; user: string }
  export function buildReplySystemPrompt(language: string, level: string, goal: string, setting: string, isTopicBased: boolean): string
  export async function generateChatReply(params: { system: string; history: { sender: string; content: string }[]; lastUserMessage: string; temperature: number }): Promise<string>
  // generateText({ model, messages: [{role:"system",content:system}, ...buildChatHistory(history), {role:"user",content:lastUserMessage}], maxOutputTokens: 8192, temperature })
  // throw jika text kosong: "AI mengembalikan respons kosong."
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/ai-content/chat.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildChatHistory, buildOpeningPrompt, buildReplySystemPrompt } from "./chat";
import { splitKoreksi } from "../chat";

describe("splitKoreksi", () => {
  it("memisahkan bagian Koreksi:", () => {
    const r = splitKoreksi("Halo, apa kabar?\nKoreksi: Gunakan 'are' bukan 'is'.");
    expect(r.main).toContain("Halo, apa kabar?");
    expect(r.koreksi).toContain("Gunakan 'are'");
  });
  it("tanpa Koreksi → koreksi null", () => {
    const r = splitKoreksi("Halo saja.");
    expect(r.koreksi).toBeNull();
    expect(r.main).toBe("Halo saja.");
  });
  it("Koreksi di awal string (legacy empty main?)", () => {
    const r = splitKoreksi("Koreksi: x");
    expect(r.koreksi).toBe("x");
  });
});

describe("buildChatHistory", () => {
  it("ai → assistant, user → user", () => {
    const h = buildChatHistory([{ sender: "ai", content: "Halo" }, { sender: "user", content: "Hi" }]);
    expect(h).toEqual([
      { role: "assistant", content: "Halo" },
      { role: "user", content: "Hi" },
    ]);
  });
});

describe("buildOpeningPrompt", () => {
  it("topik: memuat bahasa, level, setting", () => {
    const p = buildOpeningPrompt("English", "A1", "Greetings", "Greetings", true);
    expect(p.system).toContain("TARGET BAHASA: English");
    expect(p.system).toContain("Topik yang sedang dilatih: 'Greetings'");
    expect(p.user).toContain("Buat sapaan pembuka");
  });
  it("persona: memuat skenario + goal", () => {
    const p = buildOpeningPrompt("English", "B1", "Bebas", "Cafe", false);
    expect(p.system).toContain("karakter di skenario 'Cafe'");
    expect(p.system).toContain("Goal belajar: Bebas");
  });
});

describe("buildReplySystemPrompt", () => {
  it("memuat instruksi Koreksi:", () => {
    const p = buildReplySystemPrompt("English", "A1", "Greetings", "Greetings", true);
    expect(p).toContain("Koreksi:");
    expect(p).toContain("dalam Bahasa Indonesia (maksimal 2 poin ringkas)");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL (module tidak ada).

- [ ] **Step 3: Implementasi**

Tambah ke `lib/types.ts`:
```ts
export interface ChatMessageItem { id: number; sender: "user" | "ai"; content: string; }
```

Create `lib/chat.ts`:
```ts
import { db } from "./db";
import type { ChatMessageItem } from "./types";

export function normalizeSetting(setting: string): string {
  const normalized = setting.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("Nama skenario tidak boleh kosong.");
  if (normalized.length > 50) throw new Error("Nama skenario maksimal 50 karakter.");
  return normalized;
}

export function splitKoreksi(content: string): { main: string; koreksi: string | null } {
  const idx = content.indexOf("Koreksi:");
  if (idx < 0) return { main: content, koreksi: null };
  return {
    main: content.slice(0, idx).trim(),
    koreksi: content.slice(idx + "Koreksi:".length).trim() || null,
  };
}

export async function fetchHistory(sessionId: number, limit: number): Promise<ChatMessageItem[]> {
  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((m) => ({ id: m.id, sender: (m.sender as "user" | "ai") ?? "user", content: m.content }));
}

export async function findOrCreateSession(
  email: string,
  language: string,
  level: string,
  goal: string,
  setting: string
): Promise<{ sessionId: number; messages: ChatMessageItem[] }> {
  const existing = await db.chatSession.findFirst({
    where: { email, language, level, goal, roleplaySetting: setting },
  });
  if (existing) {
    return { sessionId: existing.id, messages: await fetchHistory(existing.id, 120) };
  }
  const created = await db.chatSession.create({
    data: { email, language, level, goal, roleplaySetting: setting },
  });
  return { sessionId: created.id, messages: [] };
}
```

Create `lib/ai-content/chat.ts` — prompt port verbatim dari `dioxus/src/services/gemini/chat.rs`:

```ts
import { generateText } from "ai";
import { model } from "../ai";

export function buildChatHistory(messages: { sender: string; content: string }[]): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({
    role: m.sender === "ai" ? "assistant" : "user",
    content: m.content,
  }));
}

export function buildOpeningPrompt(
  language: string,
  level: string,
  goal: string,
  setting: string,
  isTopicBased: boolean
): { system: string; user: string } {
  if (isTopicBased) {
    return {
      system: [
        `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)`,
        "",
        `Anda adalah seorang tutor/partner percakapan yang ahli dan ramah. Bahasa target: ${language}. Level CEFR user: ${level}. Topik yang sedang dilatih: '${setting}'.`,
        `Tugas Anda adalah memulai obrolan atau simulasi percakapan untuk melatih pemahaman user mengenai topik '${setting}'.`,
        "Sapa user dengan antusias, lalu ajukan sebuah pertanyaan atau berikan pernyataan yang memancing user untuk mempraktikkan topik tersebut secara langsung. Berikan setidaknya 3 kalimat lengkap agar percakapan terasa hidup.",
        `Bahasa keluaran WAJIB bahasa ${language} sepenuhnya. Jangan gunakan bahasa lain atau terjemahan.`,
      ].join("\n"),
      user: `Mulai percakapan! Buat sapaan pembuka dalam bahasa ${language} yang langsung mengajak saya mempraktikkan topik '${setting}'. Pastikan Anda bertindak sebagai partner latihan yang suportif (berikan setidaknya 3 kalimat). Pastikan kalimatnya lengkap, tidak terpotong, natural, dan diakhiri dengan pertanyaan yang mengundang respons.`,
    };
  }
  return {
    system: [
      `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)`,
      "",
      `Anda sedang memainkan peran secara penuh dan mendalam sebagai karakter di skenario '${setting}'. Anda adalah seorang penutur asli bahasa ${language}.`,
      `Tugas Anda adalah memberikan sapaan pembuka yang sangat natural, hidup, dan benar-benar menjiwai peran Anda di lingkungan '${setting}' secara nyata.`,
      "Sapa user dengan ramah dan tanyakan sesuatu yang relevan dengan peran Anda untuk memancing percakapan (berikan setidaknya 3 kalimat lengkap agar terasa imersif).",
      "Jangan pernah keluar dari karakter Anda (contoh: jika Anda kasir, jadilah kasir sungguhan yang menyapa dan menawarkan sesuatu).",
      `Bahasa keluaran WAJIB bahasa ${language} sepenuhnya. Sesuaikan kompleksitas bahasa dengan level CEFR user: ${level}. Goal belajar: ${goal}.`,
      "Jangan menggunakan label nama peran, jangan pakai tanda kutip, dan jangan sertakan terjemahan.",
      "Hasilkan teks yang sempurna dan pastikan kalimat selesai tanpa terpotong.",
    ].join("\n"),
    user: `Mulai percakapan! Buat kalimat pembuka roleplay yang sangat menjiwai karakter Anda di skenario '${setting}' dalam bahasa ${language}. Pastikan Anda benar-benar bertingkah seperti peran tersebut di dunia nyata (berikan setidaknya 3 kalimat). Pastikan kalimatnya lengkap, tidak terpotong, natural, dan diakhiri dengan pertanyaan yang mengundang respons.`,
  };
}

export function buildReplySystemPrompt(
  language: string,
  level: string,
  goal: string,
  setting: string,
  isTopicBased: boolean
): string {
  const base = `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)\n\n`;
  const role = isTopicBased
    ? `Anda adalah tutor/partner percakapan untuk user yang belajar bahasa ${language} di level ${level}. Topik saat ini: '${setting}'.`
    : `Anda adalah karakter yang sedang berada di lingkungan '${setting}' dan sedang berbicara dengan user. Anda adalah penutur asli bahasa ${language}. User belajar level CEFR ${level} dengan goal ${goal}.`;
  const persona = isTopicBased
    ? "Berikan respons yang suportif, natural, dan terus kembangkan obrolan untuk menguji atau memandu user menggunakan tata bahasa/kosakata terkait '${setting}'. Balasan utama WAJIB dalam bahasa ${language} sepenuhnya. Berikan respons lengkap (sekitar 3 kalimat) agar percakapan terus berjalan. Pastikan kalimat tidak terpotong."
    : "Anda HARUS sepenuhnya menjiwai peran Anda. Jangan pernah keluar dari karakter. Balasan utama WAJIB dalam bahasa ${language} sepenuhnya. Berikan respons lengkap (sekitar 3 kalimat) agar percakapan terus berjalan. Pastikan kalimat tidak terpotong.";
  return [
    base,
    role,
    persona,
    "Setelah balasan utama, tambahkan bagian 'Koreksi:' di baris baru dalam Bahasa Indonesia (maksimal 2 poin ringkas) HANYA untuk memperbaiki tata bahasa atau kosakata dari pesan user terakhir jika ada yang salah (jika pesannya sudah benar dan bisa dipahami, jangan berikan koreksi).",
  ].join("\n");
}

export async function generateChatReply(params: {
  system: string;
  history: { sender: string; content: string }[];
  lastUserMessage: string;
  temperature: number;
}): Promise<string> {
  const { system, history, lastUserMessage, temperature } = params;
  const { text } = await generateText({
    model,
    messages: [
      { role: "system", content: system },
      ...buildChatHistory(history),
      { role: "user", content: lastUserMessage },
    ],
    maxOutputTokens: 8192,
    temperature,
  });
  if (!text.trim()) throw new Error("AI mengembalikan respons kosong.");
  return text.trim();
}
```

Catatan implementer: perhatikan interpolasi — string `role`/`persona` di atas memakai template literal dengan ${setting}/${language}/${level}/${goal}; jangan terjebak literal `${...}` (pelajaran fase 2b Task 1!). Periksa kembali setiap baris.

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — semua pass (88 + 8 baru = 96).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/chat.ts lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: chat session helpers and roleplay prompts (TDD)"
```

---

### Task 2: lib/ai-content/story.ts (TDD)

**Files:**
- Create: `lib/ai-content/story.ts`, `lib/ai-content/story.test.ts`
- Modify: `lib/types.ts` (tambah StoryData, StorySegment, StoryQuestion)

**Interfaces:**
- Consumes: `model`, `generateText`, `parseAiJson`
- Produces:
  ```ts
  // lib/types.ts
  export interface StoryQuestion { question_text: string; options: string[]; correct_answer: string; explanation: string; }
  export interface StorySegment { text: string; speaker: string | null; translation: string; question: StoryQuestion | null; }
  export interface StoryData { title: string; title_translation: string; segments: StorySegment[]; }

  // lib/ai-content/story.ts
  export function buildStoryPrompt(language: string, level: string, goal: string): string
  export function parseStoryData(text: string): StoryData | null
  // parseAiJson + validasi: title & title_translation non-empty; segments.length >= 1 (prompt minta persis 4 — validasi >= 1 dan tiap segmen text non-empty; question bila ada: 4 opsi unik + correct_answer ∈ options)
  export async function generateStory(params: { language: string; level: string; goal: string }): Promise<StoryData>
  // 3 attempts; feedback error; throw "Gagal menghasilkan cerita yang valid setelah beberapa percobaan."
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/ai-content/story.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildStoryPrompt, parseStoryData } from "./story";

describe("buildStoryPrompt", () => {
  it("memuat bahasa, level, goal, 4 segmen", () => {
    const p = buildStoryPrompt("English", "A1", "Greetings");
    expect(p).toContain("Interactive Story");
    expect(p).toContain("level CEFR A1");
    expect(p).toContain("'Greetings'");
    expect(p).toContain("persis 4 segmen");
  });
});

describe("parseStoryData", () => {
  const valid = {
    title: "The Coffee",
    title_translation: "Kopi",
    segments: [
      {
        text: "Once upon a time...",
        speaker: null,
        translation: "Pada suatu hari...",
        question: {
          question_text: "Apa yang terjadi?",
          options: ["A", "B", "C", "D"],
          correct_answer: "B",
          explanation: "Karena ...",
        },
      },
      { text: "The end.", speaker: "Narrator", translation: "Tamat.", question: null },
    ],
  };
  it("valid → StoryData", () => {
    const d = parseStoryData(JSON.stringify(valid));
    expect(d).not.toBeNull();
    expect(d?.segments).toHaveLength(2);
    expect(d?.segments[1].speaker).toBe("Narrator");
  });
  it("invalid JSON → null", () => {
    expect(parseStoryData("bukan json")).toBeNull();
  });
  it("segmen tanpa text → null", () => {
    expect(parseStoryData(JSON.stringify({ ...valid, segments: [{ text: "", speaker: null, translation: "x", question: null }] }))).toBeNull();
  });
  it("question dengan correct_answer tidak di opsi → null", () => {
    const bad = { ...valid, segments: [{ ...valid.segments[0], question: { ...valid.segments[0].question, correct_answer: "Z" } }] };
    expect(parseStoryData(JSON.stringify(bad))).toBeNull();
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/story.test.ts` — FAIL.

- [ ] **Step 3: Implementasi**

Tambah tipe ke `lib/types.ts` (per Interfaces).

Create `lib/ai-content/story.ts` — prompt verbatim dari `dioxus/src/services/gemini/story.rs`:

```ts
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
```

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 100 pass (96 + 4).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/ai-content/story.ts lib/ai-content/story.test.ts
git commit -m "feat: interactive story generation (TDD)"
```

---

### Task 3: lib/ai-content/pronunciation.ts (TDD) + parseAiArray

**Files:**
- Create: `lib/ai-content/pronunciation.ts`, `lib/ai-content/pronunciation.test.ts`
- Modify: `lib/ai-content/parse.ts`, `lib/ai-content/parse.test.ts`, `lib/types.ts` (tambah PronunciationEvaluation, WordResult)

**Interfaces:**
- Consumes: `model`, `generateText`, `parseAiJson`
- Produces:
  ```ts
  // lib/ai-content/parse.ts (tambah)
  export function parseAiArray<T>(text: string): T[] | null
  // strip fense; slice terluar [ ... ]; JSON.parse; null jika gagal

  // lib/types.ts
  export interface WordResult { word: string; status: "correct" | "incorrect" | "missing"; }
  export interface PronunciationEvaluation { score: number; feedback: string; word_results: WordResult[]; }

  // lib/ai-content/pronunciation.ts
  export function buildSentencePrompt(language: string, level: string): string
  export function parseSentenceArray(text: string): string[] | null
  // parseAiArray<string> + semua item non-empty string; minimal 1
  export function buildEvaluationPrompt(language: string, targetSentence: string, transcript: string): string
  export function parseEvaluation(text: string): PronunciationEvaluation | null
  // score number (0-100), feedback non-empty, word_results array {word, status ∈ correct|incorrect|missing}
  ```

- [ ] **Step 1: Tulis tes gagal**

Tambah ke `lib/ai-content/parse.test.ts`:
```ts
describe("parseAiArray", () => {
  it("array polos", () => {
    expect(parseAiArray<string>('["a","b"]')).toEqual(["a", "b"]);
  });
  it("dibungkus prosa", () => {
    expect(parseAiArray<string>('Hasil: ["a"] Sekian.')).toEqual(["a"]);
  });
  it("invalid → null", () => {
    expect(parseAiArray('{bukan array}')).toBeNull();
  });
});
```

Create `lib/ai-content/pronunciation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildEvaluationPrompt, buildSentencePrompt, parseEvaluation, parseSentenceArray } from "./pronunciation";

describe("buildSentencePrompt", () => {
  it("memuat bahasa dan level", () => {
    const p = buildSentencePrompt("English", "A1");
    expect(p).toContain("5 kalimat");
    expect(p).toContain("level CEFR A1");
    expect(p).toContain("4 hingga 12 kata");
  });
});

describe("parseSentenceArray", () => {
  it("array string valid", () => {
    expect(parseSentenceArray('["Hello world","How are you"]')).toEqual(["Hello world", "How are you"]);
  });
  it("item kosong → null", () => {
    expect(parseSentenceArray('["ok",""]')).toBeNull();
  });
  it("bukan array → null", () => {
    expect(parseSentenceArray('{"a":1}')).toBeNull();
  });
});

describe("buildEvaluationPrompt", () => {
  it("memuat target dan transcript", () => {
    const p = buildEvaluationPrompt("English", "Good morning", "Good mornin");
    expect(p).toContain("'Good morning'");
    expect(p).toContain("'Good mornin'");
    expect(p).toContain("skor 0-100");
  });
});

describe("parseEvaluation", () => {
  it("valid", () => {
    const ev = parseEvaluation(JSON.stringify({
      score: 80, feedback: "Bagus!", word_results: [{ word: "Good", status: "correct" }, { word: "morning", status: "incorrect" }],
    }));
    expect(ev?.score).toBe(80);
    expect(ev?.word_results[1].status).toBe("incorrect");
  });
  it("score di luar 0-100 → null", () => {
    expect(parseEvaluation(JSON.stringify({ score: 150, feedback: "x", word_results: [] }))).toBeNull();
  });
  it("status tidak dikenal → null", () => {
    expect(parseEvaluation(JSON.stringify({ score: 50, feedback: "x", word_results: [{ word: "a", status: "unknown" }] }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/pronunciation.test.ts lib/ai-content/parse.test.ts` — FAIL.

- [ ] **Step 3: Implementasi**

Tambah ke `lib/ai-content/parse.ts`:
```ts
export function parseAiArray<T>(text: string): T[] | null {
  let t = text.trim();
  if (!t) return null;
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}
```

Tambah tipe ke `lib/types.ts` (per Interfaces).

Create `lib/ai-content/pronunciation.ts` — prompt verbatim dari `dioxus/src/services/gemini/pronunciation.rs`:

```ts
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
```

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 108 pass (100 + 3 parse + 5 pronun).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/ai-content/parse.ts lib/ai-content/parse.test.ts lib/ai-content/pronunciation.ts lib/ai-content/pronunciation.test.ts
git commit -m "feat: pronunciation prompts and parsers (TDD)"
```

---

### Task 4: lib/actions/chat.ts

**Files:**
- Create: `lib/actions/chat.ts`

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `normalizeSetting`/`findOrCreateSession`/`fetchHistory` (Task 1), `buildOpeningPrompt`/`buildReplySystemPrompt`/`generateChatReply` (Task 1), `db`
- Produces:
  ```ts
  export async function getOrCreateChatSessionAction(goal: string, setting?: string): Promise<
    { sessionId: number; messages: ChatMessageItem[]; language: string; level: string } | { error: string }
  >
  // session → profile → language/level; setting = setting ? normalizeSetting : (goal !== "Bebas" ? goal : throw "Nama skenario tidak boleh kosong.")
  // findOrCreateSession → messages kosong → generate opening (buildOpeningPrompt, isTopicBased = setting === goal && goal !== "Bebas"; generateChatReply temperature 0.8 dengan history [] dan lastUserMessage = opening.user) → insert chatMessage (sender "ai") → fetchHistory(120)
  export async function sendChatMessageAction(sessionId: number, message: string): Promise<{ messages: ChatMessageItem[] } | { error: string }>
  // validasi "Pesan tidak boleh kosong."; owner check: db.chatSession.findFirst({ where: { id: sessionId, email } }) → null: "Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi."
  // insert user msg; window 10 (findMany orderBy createdAt desc take 10 → reverse); level/lang/goal/setting dari session; isTopicBased
  // generateChatReply({ system: buildReplySystemPrompt(...), history: window, lastUserMessage: message, temperature: 0.7 })
  // insert ai msg; return fetchHistory(sessionId, 120)
  ```

- [ ] **Step 1: Implementasi**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { fetchHistory, findOrCreateSession, normalizeSetting } from "../chat";
import { buildOpeningPrompt, buildReplySystemPrompt, generateChatReply } from "../ai-content/chat";
import { db } from "../db";
import type { ChatMessageItem } from "../types";

export async function getOrCreateChatSessionAction(
  goal: string,
  setting?: string
): Promise<{ sessionId: number; messages: ChatMessageItem[]; language: string; level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  let resolvedSetting: string;
  try {
    resolvedSetting = setting ? normalizeSetting(setting) : normalizeSetting(goal);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nama skenario tidak valid." };
  }

  const { sessionId, messages } = await findOrCreateSession(session.email, language, level, goal, resolvedSetting);

  if (messages.length === 0) {
    const isTopicBased = resolvedSetting === goal && goal !== "Bebas";
    const prompts = buildOpeningPrompt(language, level, goal, resolvedSetting, isTopicBased);
    const opening = await generateChatReply({
      system: prompts.system,
      history: [],
      lastUserMessage: prompts.user,
      temperature: 0.8,
    });
    await db.chatMessage.create({
      data: { sessionId, sender: "ai", content: opening },
    });
  }

  return { sessionId, messages: await fetchHistory(sessionId, 120), language, level };
}

export async function sendChatMessageAction(
  sessionId: number,
  message: string
): Promise<{ messages: ChatMessageItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!message.trim()) return { error: "Pesan tidak boleh kosong." };

  const chatSession = await db.chatSession.findFirst({ where: { id: sessionId, email: session.email } });
  if (!chatSession) return { error: "Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi." };

  await db.chatMessage.create({
    data: { sessionId, sender: "user", content: message.trim() },
  });

  const window = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const history = window.reverse().map((m) => ({ sender: m.sender as "user" | "ai", content: m.content }));

  const isTopicBased = chatSession.roleplaySetting === chatSession.goal && chatSession.goal !== "Bebas";
  const system = buildReplySystemPrompt(chatSession.language, chatSession.level, chatSession.goal, chatSession.roleplaySetting, isTopicBased);
  const reply = await generateChatReply({ system, history, lastUserMessage: message.trim(), temperature: 0.7 });

  await db.chatMessage.create({
    data: { sessionId, sender: "ai", content: reply },
  });

  return { messages: await fetchHistory(sessionId, 120) };
}
```

Catatan: `generateChatReply` dapat throw (AI gagal) — action akan 500; UI menangkap via try/catch (Task 6). Opsional: bungkus di sini → `{ error: ... }`; PILIH bungkus di sini agar kontrak client konsisten:
```ts
try { ... } catch (e) { return { error: e instanceof Error ? e.message : "Gagal mengirim pesan." }; }
```
terapkan pada kedua action (opening + reply). Keep error message mentah (e.message) — string AI Indonesia sudah terjaga.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 108 pass; `npm run lint` — 0 error.
Smoke AI (1 panggilan, boleh): panggil buildOpeningPrompt + generateChatReply langsung:
```powershell
npx tsx --env-file=.env -e "import { generateChatReply } from './lib/ai-content/chat'; import { buildOpeningPrompt } from './lib/ai-content/chat'; const p = buildOpeningPrompt('English', 'A1', 'Greetings', 'Greetings', true); generateChatReply({ system: p.system, history: [], lastUserMessage: p.user, temperature: 0.8 }).then(r => { console.log('OPENING OK:', r.slice(0, 120)); process.exit(0); }).catch(e => { console.error('FAIL:', e.message); process.exit(1); })"
```
Expected: `OPENING OK: <teks pembuka bahasa Inggris>`.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/chat.ts
git commit -m "feat: chat session and message server actions"
```

---

### Task 5: lib/actions/story.ts + lib/actions/pronunciation.ts

**Files:**
- Create: `lib/actions/story.ts`, `lib/actions/pronunciation.ts`

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `generateStory` (Task 2), `generateSentences`/`evaluatePronunciation` (Task 3), `applyQuizResult`/`updateEngagementAfterQuiz` (lib/progress.ts)
- Produces:
  ```ts
  // lib/actions/story.ts
  export async function getStoryAction(goal: string): Promise<{ story: StoryData; language: string; level: string } | { error: string }>
  export async function completeStoryAction(goal: string): Promise<ActionResult>
  // applyQuizResult(email, lang, goal, 20) + updateEngagementAfterQuiz(email, 20) → { message: "ok" }; catch → { message: "Cerita selesai. (Gagal menyimpan skor)" }

  // lib/actions/pronunciation.ts
  export async function getSentencesAction(): Promise<{ sentences: string[] } | { error: string }>
  export async function evaluatePronunciationAction(input: { sentence: string; transcript: string }): Promise<{ evaluation: PronunciationEvaluation } | { error: string }>
  ```

- [ ] **Step 1: Implementasi `lib/actions/story.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { generateStory } from "../ai-content/story";
import { applyQuizResult, updateEngagementAfterQuiz } from "../progress";
import type { ActionResult } from "./types";
import type { StoryData } from "../types";

export async function getStoryAction(goal: string): Promise<{ story: StoryData; language: string; level: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  try {
    const story = await generateStory({ language, level, goal });
    return { story, language, level };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat cerita." };
  }
}

export async function completeStoryAction(goal: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  try {
    await applyQuizResult(session.email, profile.preferred_language, goal, 20);
    await updateEngagementAfterQuiz(session.email, 20);
    return { message: "ok" };
  } catch {
    return { message: "Cerita selesai. (Gagal menyimpan skor)" };
  }
}
```

- [ ] **Step 2: Implementasi `lib/actions/pronunciation.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { evaluatePronunciation, generateSentences } from "../ai-content/pronunciation";
import type { PronunciationEvaluation } from "../types";

export async function getSentencesAction(): Promise<{ sentences: string[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  try {
    const sentences = await generateSentences({ language, level });
    return { sentences };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyiapkan kalimat latihan." };
  }
}

export async function evaluatePronunciationAction(input: {
  sentence: string;
  transcript: string;
}): Promise<{ evaluation: PronunciationEvaluation } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  try {
    const evaluation = await evaluatePronunciation({
      language: profile.preferred_language,
      targetSentence: input.sentence,
      transcript: input.transcript,
    });
    return { evaluation };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengevaluasi pronunciation." };
  }
}
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 108 pass; `npm run lint` — 0 error.
Smoke AI (2 panggilan, boleh): story + sentences:
```powershell
npx tsx --env-file=.env -e "import { generateStory } from './lib/ai-content/story'; generateStory({ language: 'English', level: 'A1', goal: 'Greetings' }).then(s => { console.log('STORY OK:', s.segments.length, 'segments'); return import('./lib/ai-content/pronunciation').then(m => m.generateSentences({ language: 'English', level: 'A1' })); }).then(sent => { console.log('SENTENCES OK:', sent.length); process.exit(0); }).catch(e => { console.error('FAIL:', e.message); process.exit(1); })"
```
Expected: `STORY OK: 4 segments` dan `SENTENCES OK: 5`.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/story.ts lib/actions/pronunciation.ts
git commit -m "feat: story and pronunciation server actions"
```

---

### Task 6: useSpeechRecognition hook + ChatView + halaman chat

**Files:**
- Create: `components/useSpeechRecognition.ts`, `components/ChatView.tsx`, `app/(app)/chat/[goal]/page.tsx`

**Interfaces:**
- Consumes: `getOrCreateChatSessionAction`/`sendChatMessageAction` (Task 4), `sanitizeHtml` (tidak — chat plain text)
- Produces: hook STT + halaman `/chat/:goal` lengkap

- [ ] **Step 1: `components/useSpeechRecognition.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang: string) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Browser tidak mendukung Speech Recognition");
      return;
    }
    setError(null);
    setTranscript(null);
    setTimedOut(false);
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const first = e.results?.[0]?.[0];
      if (first && first.transcript) setTranscript(first.transcript);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onerror = (err) => {
      if (err.error !== "no-speech") {
        setError(err.error === "not-allowed" ? "Merekam suara gagal" : err.error);
      } else {
        setTimedOut(true);
      }
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setError("Gagal menangkap suara.");
      setListening(false);
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return { supported, listening, transcript, error, timedOut, start, stop, setError };
}
```

- [ ] **Step 2: `app/(app)/chat/[goal]/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import ChatView from "@/components/ChatView";

export default async function ChatPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  return <ChatView goal={decodeURIComponent(goal)} language={langId} />;
}
```

- [ ] **Step 3: `components/ChatView.tsx`**

Struktur (client):
- State: `phase: "picker" | "loading" | "chat"`, `messages: ChatMessageItem[]`, `sessionId`, `settingTitle`, `customScenarios: string[]` (in-memory), `input`, `sending`, `error`, `autoStarted`
- `useEffect` mount (pola .then+cancelled): jika goal !== "Bebas" → auto-start: `getOrCreateChatSessionAction(goal)` → set messages/sessionId/phase chat; error → setError
- Picker (goal === "Bebas"): 8 preset (kunci+judul+desc dari riset: Cafe "Kasir Kedai Kopi" "Latihan memesan minuman dan membayar."; Hotel "Resepsionis Hotel" "Latihan check-in dan tanya fasilitas hotel."; Airport "Bandara" "Latihan check-in penerbangan dan imigrasi."; Restaurant "Restoran" "Latihan pesan makanan dan komplain pesanan."; Office "Meeting Kantor" "Latihan presentasi singkat dan diskusi kerja."; Shopping "Pusat Belanja" "Latihan tanya harga, ukuran, dan negosiasi."; Hospital "Rumah Sakit" "Latihan menjelaskan gejala dan konsultasi dokter."; Taxi "Taksi / Ride-Hailing" "Latihan arah tujuan dan percakapan perjalanan.") — klik → start(setting); custom input (maxlength 50) + "Tambah"/"Mulai"; daftar "Skenario custom Anda:" (dedupe case-insensitive, in-memory); hint "Contoh: Interview Kerja, Imigrasi, Dokter Gigi, Presentasi Kampus"
- `start(setting)`: setPhase loading → getOrCreateChatSessionAction(goal, setting) → messages/sessionId/settingTitle/phase chat
- Chat: header "Simulasi Peran: {settingTitle}" + "{language} - {level}" + "Keluar Sesi" (→ dashboard, reset state ke picker bila Bebas); bubbles: user kanan `bg-teal-500 text-white rounded-tr-none`, AI kiri `bg-white dark:bg-slate-900 border rounded-tl-none`, `whitespace-pre-wrap`; AI bubble + splitKoreksi → kotak 💡 amber ("Koreksi AI") di bawah bubble
- Kirim: optimistic push (id 0) → sendChatMessageAction → replace messages; error "Gagal mengirim pesan: {e}"; sending → "Partner AI sedang mengetik..." bubble; input placeholder `Ketik balasan dalam bahasa {language}...`, tombol "Kirim" disabled saat kosong/sending
- Level untuk header: dari response action ({ language, level }) — simpan di state
- Error load: "Gagal memuat sesi obrolan: {e}" + Coba Lagi

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateChatSessionAction, sendChatMessageAction } from "@/lib/actions/chat";
import { splitKoreksi } from "@/lib/chat";
import type { ChatMessageItem } from "@/lib/types";

const PRESETS = [
  { key: "Cafe", title: "Kasir Kedai Kopi", desc: "Latihan memesan minuman dan membayar." },
  { key: "Hotel", title: "Resepsionis Hotel", desc: "Latihan check-in dan tanya fasilitas hotel." },
  { key: "Airport", title: "Bandara", desc: "Latihan check-in penerbangan dan imigrasi." },
  { key: "Restaurant", title: "Restoran", desc: "Latihan pesan makanan dan komplain pesanan." },
  { key: "Office", title: "Meeting Kantor", desc: "Latihan presentasi singkat dan diskusi kerja." },
  { key: "Shopping", title: "Pusat Belanja", desc: "Latihan tanya harga, ukuran, dan negosiasi." },
  { key: "Hospital", title: "Rumah Sakit", desc: "Latihan menjelaskan gejala dan konsultasi dokter." },
  { key: "Taxi", title: "Taksi / Ride-Hailing", desc: "Latihan arah tujuan dan percakapan perjalanan." },
];

export default function ChatView({ goal, language }: { goal: string; language: string }) {
  const [phase, setPhase] = useState<"picker" | "loading" | "chat">(goal !== "Bebas" ? "loading" : "picker");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [settingTitle, setSettingTitle] = useState<string | null>(null);
  const [level, setLevel] = useState("A1");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const start = useCallback(async (setting: string, title: string) => {
    setPhase("loading");
    setError(null);
    const res = await getOrCreateChatSessionAction(goal, setting);
    if ("error" in res) {
      setError(res.error);
      setPhase(goal === "Bebas" ? "picker" : "chat");
      return;
    }
    setSessionId(res.sessionId);
    setMessages(res.messages);
    setLevel(res.level);
    setSettingTitle(title);
    setPhase("chat");
  }, [goal]);

  useEffect(() => {
    if (goal !== "Bebas") {
      let cancelled = false;
      getOrCreateChatSessionAction(goal)
        .then((res) => {
          if (cancelled) return;
          if ("error" in res) {
            setError(res.error);
            setPhase("chat");
            return;
          }
          setSessionId(res.sessionId);
          setMessages(res.messages);
          setLevel(res.level);
          setSettingTitle(res.messages.length > 0 ? goal : goal);
          setPhase("chat");
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Gagal memuat sesi obrolan.");
          setPhase("chat");
        });
      return () => {
        cancelled = true;
      };
    }
  }, [goal, reloadKey]);

  async function send() {
    const text = input.trim();
    if (!text || sending || sessionId === null) return;
    setInput("");
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { id: 0, sender: "user", content: text }]);
    const res = await sendChatMessageAction(sessionId, text).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal mengirim pesan." }));
    setSending(false);
    if ("error" in res) {
      setError(`Gagal mengirim pesan: ${res.error}`);
      return;
    }
    setMessages(res.messages);
  }

  // ---- picker ----
  if (phase === "picker") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">Mode Roleplay - {language}</span>
        <h1 className="text-2xl font-extrabold mb-6">Pilih Skenario Obrolan</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => start(p.key, p.title)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-colors"
            >
              <p className="font-bold text-sm">{p.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-sm font-bold mb-2">Buat skenario custom</p>
          <div className="flex gap-2">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              maxLength={50}
              placeholder="Tulis nama skenario custom..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              type="button"
              onClick={() => {
                const v = customInput.trim();
                if (!v) return;
                setCustoms((c) => (c.some((x) => x.toLowerCase() === v.toLowerCase()) ? c : [...c, v]));
                setCustomInput("");
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            >
              Tambah
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Contoh: Interview Kerja, Imigrasi, Dokter Gigi, Presentasi Kampus</p>
          {customs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Skenario custom Anda:</p>
              <div className="space-y-2">
                {customs.map((c) => (
                  <button key={c} type="button" onClick={() => start(c, c)} className="w-full text-left px-4 py-2.5 rounded-xl border border-teal-500/50 text-sm font-semibold">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-500 mt-4">{error}</p>}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan sesi roleplay...</p>
      </div>
    );
  }

  // ---- chat ----
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-extrabold">Simulasi Peran: {settingTitle}</h1>
          <p className="text-xs text-slate-400">{language} - {level}</p>
        </div>
        <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">Keluar Sesi</Link>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) =>
          m.sender === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-teal-500 text-white text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-1.5">
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm whitespace-pre-wrap">
                  {splitKoreksi(m.content).main}
                </div>
                {splitKoreksi(m.content).koreksi && (
                  <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-bold mb-0.5">💡 Koreksi AI</p>
                    <p className="whitespace-pre-wrap">{splitKoreksi(m.content).koreksi}</p>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-400">
              Partner AI sedang mengetik...
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}

      <div className="flex gap-2 mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={sending}
          placeholder={`Ketik balasan dalam bahasa ${language}...`}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"
        />
        <button type="button" onClick={send} disabled={!input.trim() || sending} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
          Kirim
        </button>
      </div>
    </div>
  );
}
```

Catatan: `splitKoreksi(m.content)` dipanggil 2x per render AI bubble — simpan ke variabel lokal dalam map (`const { main, koreksi } = splitKoreksi(m.content);`) untuk efisiensi; implementer bebas menyempurnakan.

- [ ] **Step 4: Verifikasi**

Run: `npm run lint` (0 error — hati-hati unescaped entities), `npx tsc --noEmit` (0 error), `npm test` (108 pass).

- [ ] **Step 5: Commit**

```bash
git add components/useSpeechRecognition.ts components/ChatView.tsx "app/(app)/chat/[goal]/page.tsx"
git commit -m "feat: chat roleplay page with scenario picker and Koreksi AI"
```

---

### Task 7: Halaman Voice Chat

**Files:**
- Create: `components/VoiceChatView.tsx`, `app/(app)/voice-chat/[goal]/page.tsx`
- Copy aset: `dioxus/assets/avatar_male_talking.gif` → `public/avatar_male_talking.gif`, `avatar_male_idle.png`, `avatar_female_talking.gif`, `avatar_female_idle.png`

**Interfaces:**
- Consumes: `useSpeechRecognition` (Task 6), `getOrCreateChatSessionAction`/`sendChatMessageAction` (Task 4), `splitKoreksi`, ttsLang
- Produces: halaman `/voice-chat/:goal` (loop percakapan suara)

- [ ] **Step 1: Salin aset avatar**

```powershell
Copy-Item dioxus/assets/avatar_male_talking.gif public/avatar_male_talking.gif
Copy-Item dioxus/assets/avatar_male_idle.png public/avatar_male_idle.png
Copy-Item dioxus/assets/avatar_female_talking.gif public/avatar_female_talking.gif
Copy-Item dioxus/assets/avatar_female_idle.png public/avatar_female_idle.png
```

- [ ] **Step 2: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import VoiceChatView from "@/components/VoiceChatView";

export default async function VoiceChatPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <VoiceChatView goal={decodeURIComponent(goal)} language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 3: `components/VoiceChatView.tsx`**

Loop suara (status: `"menghubungkan" | "mendengarkan" | "berpikir" | "berbicara" | "muted"`):

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOrCreateChatSessionAction, sendChatMessageAction } from "@/lib/actions/chat";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { splitKoreksi } from "@/lib/chat";
import type { ChatMessageItem } from "@/lib/types";

const PRESETS = [
  { key: "Cafe", title: "Kasir Kedai Kopi", desc: "Latihan memesan minuman secara verbal." },
  { key: "Hotel", title: "Resepsionis Hotel", desc: "Latihan check-in dan tanya fasilitas hotel." },
  { key: "Airport", title: "Imigrasi Bandara", desc: "Latihan menjawab pertanyaan petugas imigrasi." },
  { key: "Restaurant", title: "Pelayan Restoran", desc: "Latihan verbal memesan menu utama." },
  { key: "Office", title: "Meeting Kantor", desc: "Latihan presentasi singkat dan diskusi kerja." },
  { key: "Shopping", title: "Pusat Belanja", desc: "Latihan tanya harga, ukuran, dan negosiasi." },
  { key: "Hospital", title: "Rumah Sakit", desc: "Latihan menjelaskan gejala dan konsultasi dokter." },
  { key: "Taxi", title: "Taksi / Ride-Hailing", desc: "Latihan arah tujuan dan percakapan perjalanan." },
];

const STATUS_LABEL: Record<string, string> = {
  menghubungkan: "Menghubungkan asisten AI...",
  mendengarkan: "Silakan berbicara... (AI Mendengarkan)",
  berpikir: "AI sedang berpikir...",
  berbicara: "AI sedang berbicara...",
  muted: "Mikrofon Dinonaktifkan (Muted)",
};

export default function VoiceChatView({ goal, language, ttsLang }: { goal: string; language: string; ttsLang: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"picker" | "chat">(goal !== "Bebas" ? "chat" : "picker");
  const [status, setStatus] = useState<"menghubungkan" | "mendengarkan" | "berpikir" | "berbicara" | "muted">("menghubungkan");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [settingTitle, setSettingTitle] = useState<string | null>(null);
  const [userCaption, setUserCaption] = useState<string | null>(null);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [aiKoreksi, setAiKoreksi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const statusRef = useRef(status);
  statusRef.current = status;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const { supported, listening, transcript, error: sttError, timedOut, start: startRec, stop: stopRec, setError: setSttError } = useSpeechRecognition(ttsLang);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLang;
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  const startSession = useCallback(async (setting: string, title: string) => {
    setPhase("chat");
    setStatus("menghubungkan");
    setError(null);
    const res = await getOrCreateChatSessionAction(goal, setting);
    if ("error" in res) {
      setError(`Gagal memuat sesi panggilan: ${res.error}`);
      setStatus("muted");
      return;
    }
    setSessionId(res.sessionId);
    setMessages(res.messages);
    setSettingTitle(title);
    const lastAi = [...res.messages].reverse().find((m) => m.sender === "ai");
    if (lastAi) {
      const { main, koreksi } = splitKoreksi(lastAi.content);
      setAiCaption(main);
      setAiKoreksi(koreksi);
      setStatus("berbicara");
      speak(main);
      window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 3500);
    } else {
      setStatus(isMutedRef.current ? "muted" : "mendengarkan");
    }
  }, [goal]);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    if (goal !== "Bebas") {
      startSession(goal, goal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, reloadKey]);

  // transcript dari STT → kirim
  useEffect(() => {
    if (transcript === null || transcript.trim() === "") return;
    if (statusRef.current !== "mendengarkan" && statusRef.current !== "berpikir") return;
    const sid = sessionIdRef.current;
    if (sid === null) return;
    const text = transcript.trim();
    setUserCaption(text);
    setStatus("berpikir");
    stopSpeaking();
    setSttError(null);
    sendChatMessageAction(sid, text)
      .then((res) => {
        if ("error" in res) {
          setError(`Gagal mengirim pesan suara: ${res.error}`);
          setStatus(isMutedRef.current ? "muted" : "mendengarkan");
          return;
        }
        setMessages(res.messages);
        const lastAi = [...res.messages].reverse().find((m) => m.sender === "ai");
        if (lastAi) {
          const { main, koreksi } = splitKoreksi(lastAi.content);
          setAiCaption(main);
          setAiKoreksi(koreksi);
          setStatus("berbicara");
          speak(main);
          window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 4000);
        } else {
          setStatus(isMutedRef.current ? "muted" : "mendengarkan");
        }
      })
      .catch((e: unknown) => {
        setError(`Gagal mengirim pesan suara: ${e instanceof Error ? e.message : "Terjadi kesalahan."}`);
        setStatus(isMutedRef.current ? "muted" : "mendengarkan");
      });
  }, [transcript]);

  // loop: saat mendengarkan → mulai STT; timeout → restart
  useEffect(() => {
    if (status !== "mendengarkan" || isMuted) return;
    startRec();
    const t = window.setTimeout(() => stopRec(), 8000);
    return () => {
      window.clearTimeout(t);
      stopRec();
    };
  }, [status, isMuted, startRec, stopRec]);

  useEffect(() => {
    if (timedOut) {
      const t = window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 1000);
      return () => window.clearTimeout(t);
    }
  }, [timedOut]);

  useEffect(() => {
    if (sttError) setError(sttError);
  }, [sttError]);

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    if (next) {
      stopRec();
      stopSpeaking();
      setStatus("muted");
    } else {
      setStatus("mendengarkan");
    }
  }

  function hangUp() {
    stopRec();
    stopSpeaking();
    if (goal !== "Bebas") {
      router.push("/roadmap");
    } else {
      setSessionId(null);
      setMessages([]);
      setSettingTitle(null);
      setUserCaption(null);
      setAiCaption(null);
      setAiKoreksi(null);
      setPhase("picker");
      setStatus("menghubungkan");
    }
  }

  if (phase === "picker") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">Gemini Live Voice - {language}</span>
        <h1 className="text-2xl font-extrabold mb-6">Pilih Partner Panggilan Suara</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => startSession(p.key, p.title)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-colors">
              <p className="font-bold text-sm">{p.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-sm font-bold mb-2">Buat Skenario Telepon Kustom</p>
          <div className="flex gap-2">
            <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} maxLength={50}
              placeholder="Contoh: Wawancara Visa, Telpon Customer Service..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            <button type="button" onClick={() => { const v = customInput.trim(); if (v) { setCustoms((c) => (c.some((x) => x.toLowerCase() === v.toLowerCase()) ? c : [...c, v])); setCustomInput(""); } }}
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Telepon Now</button>
          </div>
          {customs.length > 0 && (
            <div className="mt-4 space-y-2">
              {customs.map((c) => (
                <button key={c} type="button" onClick={() => startSession(c, c)} className="w-full text-left px-4 py-2.5 rounded-xl border border-teal-500/50 text-sm font-semibold">{c}</button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-500 mt-4">{error}</p>}
      </div>
    );
  }

  const borderColor =
    status === "mendengarkan" ? "border-teal-500" :
    status === "berbicara" ? "border-amber-500" :
    status === "berpikir" ? "border-indigo-500" : "border-slate-400";

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 flex flex-col items-center gap-6">
      {error && (
        <div className="w-full flex items-start justify-between gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-lg font-extrabold">Live Voice</p>
          <p className="text-xs text-slate-400">{settingTitle} · {language}</p>
        </div>
        <span className="text-xs font-bold text-slate-400">{status === "muted" ? "Muted" : status === "mendengarkan" ? "Mendengarkan" : status === "berbicara" ? "Berbicara" : "Memproses"}</span>
      </div>

      <div className="relative">
        <div className={`w-28 h-28 rounded-full border-4 ${borderColor} ${status === "mendengarkan" ? "animate-pulse" : ""} flex items-center justify-center overflow-hidden bg-white dark:bg-slate-900`}>
          <img
            src={status === "berbicara" ? "/avatar_male_talking.gif" : "/avatar_male_idle.png"}
            alt="Avatar AI"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {aiCaption && (
        <div className="w-full text-center px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm">
          {aiCaption}
        </div>
      )}

      <div className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-500 dark:text-slate-300">
        {STATUS_LABEL[status]}
      </div>

      <div className="w-full space-y-3 text-xs">
        {userCaption && (
          <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <p className="font-bold text-slate-400 mb-1">Anda berkata</p>
            <p className="text-slate-600 dark:text-slate-300">&quot;{userCaption}&quot;</p>
          </div>
        )}
        {aiKoreksi && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-400">
            <p className="font-bold mb-0.5">💡 Koreksi AI</p>
            <p className="whitespace-pre-wrap">{aiKoreksi}</p>
          </div>
        )}
        {!userCaption && !aiKoreksi && (
          <p className="text-center text-slate-400">Transkrip ucapan akan muncul di sini...</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!supported}
          className="w-14 h-14 rounded-full border border-slate-300 dark:border-slate-700 text-xl flex items-center justify-center disabled:opacity-40"
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>
        <button
          type="button"
          onClick={hangUp}
          className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-2xl flex items-center justify-center shadow-lg"
        >
          📞
        </button>
      </div>
    </div>
  );
}
```

Catatan: hook `useSpeechRecognition` mengembalikan `timedOut` yang di-reset tiap `start()` — verifikasi flow loop (mendengarkan → timeout → restart). `setError` dari hook dipetakan ke error banner. `statusRef`/`messagesRef`/`sessionIdRef`/`isMutedRef` menghindari stale closure pada effect transcript.

- [ ] **Step 4: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (108 pass).

- [ ] **Step 5: Commit**

```bash
git add components/VoiceChatView.tsx "app/(app)/voice-chat/[goal]/page.tsx" public/avatar_male_talking.gif public/avatar_male_idle.png public/avatar_female_talking.gif public/avatar_female_idle.png
git commit -m "feat: voice chat page with speech loop and avatar"
```

---

### Task 8: Halaman Story

**Files:**
- Create: `components/StoryView.tsx`, `app/(app)/story/[goal]/page.tsx`

**Interfaces:**
- Consumes: `getStoryAction`/`completeStoryAction` (Task 5), `sanitizeHtml` (tidak — story plain text), `SpeakButton` (TTS rate 0.9)
- Produces: halaman `/story/:goal`

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import StoryView from "@/components/StoryView";

export default async function StoryPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <StoryView goal={decodeURIComponent(goal)} language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 2: `components/StoryView.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { completeStoryAction, getStoryAction } from "@/lib/actions/story";
import SpeakButton from "./SpeakButton";
import type { StoryData } from "@/lib/types";

export default function StoryView({ goal, language, ttsLang }: { goal: string; language: string; ttsLang: string }) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null); // null = belum
  const [completed, setCompleted] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStoryAction(goal)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setStory(res.story);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat cerita.");
      });
    return () => {
      cancelled = true;
    };
  }, [goal, reloadKey]);

  function checkAnswer(opt: string) {
    if (answered !== null) return;
    setSelected(opt);
    const seg = story?.segments[idx];
    if (!seg?.question) return;
    setAnswered(opt.toLowerCase() === seg.question.correct_answer.toLowerCase());
  }

  async function next() {
    if (!story) return;
    if (idx + 1 >= story.segments.length) {
      setCompleted(true);
      const res = await completeStoryAction(goal).catch(() => ({ message: "Cerita selesai. (Gagal menyimpan skor)" }));
      setReward("message" in res && res.message === "ok" ? "Selamat! Anda mendapat 20 XP & Koin!" : res.message ?? "Cerita selesai.");
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setAnswered(null);
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">⚠️ Gagal Memuat Cerita</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Peta</Link>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan Cerita Interaktif...</p>
        <p className="text-sm text-slate-400">AI sedang menulis cerita pendek bahasa {language} yang sesuai dengan level Anda. Mohon tunggu sebentar.</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Cerita Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Anda telah menyelesaikan cerita &quot;{story.title}&quot;. Sangat bagus untuk melatih pendengaran Anda!</p>
        {reward && (
          <div className="bg-teal-500/10 border border-teal-500/40 rounded-2xl p-4">
            <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{reward}</p>
          </div>
        )}
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Selesai & Kembali
        </Link>
      </div>
    );
  }

  const segment = story.segments[idx];
  const total = story.segments.length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(idx / total) * 100}%` }} />
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-extrabold">{story.title}</h1>
          <p className="text-sm italic text-slate-400">{story.title_translation}</p>
        </div>
        <SpeakButton text={segment.text} lang={ttsLang} rate={0.9} />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        {segment.speaker && (
          <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">
            {segment.speaker}
          </span>
        )}
        <p className="text-base leading-relaxed whitespace-pre-wrap">{segment.text}</p>
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">{segment.translation}</p>
        </div>
      </div>

      {segment.question && (
        <div className="mt-6">
          <p className="font-bold mb-3">{segment.question.question_text}</p>
          <div className="space-y-2">
            {segment.question.options.map((opt, i) => {
              const isCorrect = answered !== null && opt.toLowerCase() === segment.question!.correct_answer.toLowerCase();
              const isWrong = answered !== null && selected === opt && !isCorrect;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered !== null}
                  onClick={() => checkAnswer(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    isCorrect ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : isWrong ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : answered !== null ? "border-slate-200 dark:border-slate-700 opacity-60"
                    : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered !== null && (
            <div className={`mt-4 p-4 rounded-2xl border text-sm ${answered ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
              <p className="font-black mb-1">{answered ? "✨ Benar!" : "❌ Salah"}</p>
              <p className="text-slate-600 dark:text-slate-300">{segment.question.explanation}</p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={next}
        disabled={segment.question !== null && answered === null}
        className="mt-6 w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
      >
        Lanjut
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (108 pass).

- [ ] **Step 4: Commit**

```bash
git add components/StoryView.tsx "app/(app)/story/[goal]/page.tsx"
git commit -m "feat: interactive story page with comprehension questions"
```

---

### Task 9: Halaman Pronunciation

**Files:**
- Create: `components/PronunciationView.tsx`, `app/(app)/pronunciation-practice/page.tsx`

**Interfaces:**
- Consumes: `getSentencesAction`/`evaluatePronunciationAction` (Task 5), `useSpeechRecognition` (Task 6), `SpeakButton`
- Produces: halaman `/pronunciation-practice`

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import PronunciationView from "@/components/PronunciationView";

export default async function PronunciationPracticePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <PronunciationView language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 2: `components/PronunciationView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluatePronunciationAction, getSentencesAction } from "@/lib/actions/pronunciation";
import { useSpeechRecognition } from "./useSpeechRecognition";
import SpeakButton from "./SpeakButton";
import type { PronunciationEvaluation } from "@/lib/types";

const SCORE_COLOR = (score: number) => (score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e");

export default function PronunciationView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { supported, listening, transcript, error: sttError, timedOut, start: startRec, stop: stopRec, setError: setSttError } = useSpeechRecognition(ttsLang);

  useEffect(() => {
    let cancelled = false;
    getSentencesAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setSentences(res.sentences);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal menyiapkan kalimat latihan.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const sentence = sentences?.[idx];

  // transcript → evaluasi
  useEffect(() => {
    if (transcript === null || !sentence || evaluation) return;
    setEvaluating(true);
    setSttError(null);
    evaluatePronunciationAction({ sentence, transcript })
      .then((res) => {
        if ("error" in res) {
          setError(res.error);
        } else {
          setEvaluation(res.evaluation);
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Gagal mengevaluasi pronunciation.");
      })
      .finally(() => setEvaluating(false));
  }, [transcript]);

  useEffect(() => {
    if (sttError) setError(sttError);
  }, [sttError]);

  useEffect(() => {
    if (timedOut) setError("Suara tidak terdengar.");
  }, [timedOut]);

  function nextSentence() {
    setEvaluation(null);
    setError(null);
    if (sentences && idx + 1 >= sentences.length) {
      setIdx(0);
      setSentences(null);
      setReloadKey((k) => k + 1);
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (error && !sentence) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Latihan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (!sentences || !sentence) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan kalimat latihan...</p>
      </div>
    );
  }

  const micBusy = listening || evaluating;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center">
      <h1 className="text-2xl font-extrabold mb-1">Speech Scoring</h1>
      <p className="text-xs font-bold text-slate-400 mb-6">{language}</p>

      {error && <p className="text-xs text-rose-500 mb-4">{error}</p>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ucapkan Kalimat Ini:</p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <SpeakButton text={sentence} lang={ttsLang} rate={0.9} />
        </div>
        {evaluation ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {evaluation.word_results.map((w, i) => (
              <span
                key={i}
                className={`text-base font-bold ${
                  w.status === "correct" ? "text-emerald-500" :
                  w.status === "incorrect" ? "text-rose-500 underline decoration-wavy" :
                  "text-slate-400 line-through"
                }`}
              >
                {w.word}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-lg font-bold leading-relaxed">{sentence}</p>
        )}
      </div>

      {evaluation && (
        <div className="mt-6 space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={SCORE_COLOR(evaluation.score)}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(evaluation.score / 100) * 339.3} 339.3`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span className="absolute text-2xl font-black">{evaluation.score}</span>
          </div>
          {transcript && (
            <p className="text-sm text-slate-500 dark:text-slate-400">&quot;{transcript}&quot;</p>
          )}
          <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/40 text-blue-700 dark:text-blue-400 text-sm text-left">
            💡 {evaluation.feedback}
          </div>
          <button type="button" onClick={nextSentence} className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kalimat Selanjutnya
          </button>
        </div>
      )}

      {!evaluation && (
        <button
          type="button"
          disabled={!supported || micBusy}
          onClick={() => { setError(null); setEvaluation(null); startRec(); }}
          className={`mt-6 w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-colors ${
            listening
              ? "bg-rose-500 text-white animate-pulse"
              : evaluating
                ? "bg-amber-500 text-white"
                : "bg-teal-500 hover:bg-teal-600 text-white"
          } disabled:opacity-50`}
        >
          {evaluating ? "⏳" : "🎙️"}
        </button>
      )}
      <p className="text-xs text-slate-400 mt-3">
        {listening ? "Sedang mendengarkan..." : evaluating ? "Mengevaluasi..." : "Tekan mic dan mulai bicara"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (108 pass).

- [ ] **Step 4: Commit**

```bash
git add components/PronunciationView.tsx "app/(app)/pronunciation-practice/page.tsx"
git commit -m "feat: pronunciation practice page with speech scoring"
```

---

### Task 10: Integrasi (roadmap modal + dashboard CTA) + AGENTS.md + verifikasi final

**Files:**
- Modify: `components/RoadmapClient.tsx` (tambah 3 tombol modal), `app/(app)/dashboard/page.tsx` (tambah 3 CTA), `AGENTS.md`

- [ ] **Step 1: Roadmap modal — 3 tombol baru**

Edit `components/RoadmapClient.tsx` — di dalam modal "Mulai Topik", setelah Link kuis, tambah:

```tsx
<Link href={`/chat/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-colors">
  💬 Chat Percakapan
</Link>
<Link href={`/voice-chat/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-colors">
  🎙️ Roleplay Suara
</Link>
<Link href={`/story/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-colors">
  🎧 Mode Story
</Link>
```

(Letakkan setelah tombol "📝 Latihan Kuis"; desc kecil opsional di bawah tiap tombol — `text-[11px] text-slate-400` — "Simulasi chat interaktif berbasis teks dengan AI" / "Praktik berbicara langsung dengan AI" / "Cerita interaktif & mendengarkan".)

- [ ] **Step 2: Dashboard — 3 CTA card**

Edit `app/(app)/dashboard/page.tsx` — setelah grid CTA fase 2b (atau buat grid baru di bawahnya), tambah 3 card:

```tsx
<Link href="/chat/Bebas" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
  <p className="text-xl">💬</p>
  <p className="font-extrabold mt-2">Chat AI</p>
  <p className="text-xs text-slate-400 mt-1">Simulasi percakapan teks bebas.</p>
</Link>
<Link href="/voice-chat/Bebas" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
  <p className="text-xl">🎙️</p>
  <p className="font-extrabold mt-2">Live Voice AI</p>
  <p className="text-xs text-slate-400 mt-1">Ngobrol langsung dengan suara.</p>
</Link>
<Link href="/pronunciation-practice" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
  <p className="text-xl">🗣️</p>
  <p className="font-extrabold mt-2">Speech Scoring</p>
  <p className="text-xs text-slate-400 mt-1">Latih akurasi pronunciation.</p>
</Link>
```

(3 card baru bisa digabung ke grid CTA yang sudah ada — total 6 card dalam grid `sm:grid-cols-3`; sesuaikan layout agar rapi.)

- [ ] **Step 3: AGENTS.md**

Perbarui:
- Routes: `/chat/:goal`, `/voice-chat/:goal`, `/story/:goal`, `/pronunciation-practice`
- lib: `chat.ts`, `ai-content/chat.ts|story.ts|pronunciation.ts`, `actions/chat.ts|story.ts|pronunciation.ts`, `components/useSpeechRecognition.ts`
- Konvensi: chat = sesi DB (`chat_sessions`/`chat_messages`) + konvensi `Koreksi:`; STT = SpeechRecognition browser (Chrome/Edge); TTS = Web Speech API; story reward = applyQuizResult(20)
- Status migrasi: Fase 3 selesai; tersisa: gamifikasi (4), admin (5), cron + deploy Vercel + cutover (6)

- [ ] **Step 4: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```
Expected: lint 0 error (warning <img> pre-existing boleh); tsc bersih; 108 test pass; build sukses; migrate status "up to date".

- [ ] **Step 5: Commit**

```bash
git add components/RoadmapClient.tsx "app/(app)/dashboard/page.tsx" AGENTS.md
git commit -m "docs: integrate phase 3 entry points and update AGENTS.md"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Chat helpers + prompts | 96 test (8 baru) |
| 2. Story generation | 100 test (4 baru) |
| 3. Pronunciation prompts + parsers | 108 test (8 baru: 3 parse + 5 pronun) |
| 4. Actions chat | tsc/lint + smoke AI opening |
| 5. Actions story + pronunciation | tsc/lint + smoke AI (story 4 segmen, sentences 5) |
| 6. Hook STT + ChatView | lint/tsc/test |
| 7. VoiceChatView | lint/tsc/test |
| 8. StoryView | lint/tsc/test |
| 9. PronunciationView | lint/tsc/test |
| 10. Integrasi + AGENTS + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **STT/audio tidak bisa diuji di subagent** (butuh browser + mic) — verifikasi compile + smoke AI teks saja; UX suara diuji manual oleh user di Chrome/Edge.
- **Stale closure pada VoiceChatView**: statusRef/sessionIdRef/messagesRef/isMutedRef diperlukan untuk effect transcript — pastikan pola ref dipertahankan saat implementasi.
- **generateChatReply messages param**: pastikan AI SDK v7 menerima `messages` dengan role system/user/assistant (didukung openai-compatible); bila ada kendala type, fallback ke prompt gabungan (system + labeled history) — laporkan.
- **Split koreksi dipanggil berulang** di render ChatView — simpan hasil ke variabel lokal dalam map.
- **`Bebas` sentinel**: goal "Bebas" → picker (tanpa auto-start); hang-up → picker. Jangan lupa di kedua view.
