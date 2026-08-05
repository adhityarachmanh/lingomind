# Fix Romanisasi + Skenario Umum (Markdown + KaTeX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki bug romanisasi (stream harus menang atas analisis) dan tambahkan skenario tipe "umum" (Bahasa Indonesia, balasan AI Markdown + rumus LaTeX via KaTeX, tanpa fase analisis bahasa).

**Architecture:** Data dulu (kolom `Scenario.type` + migration), konstanta (template umum + TTS Indonesia), prompt umum, aksi server (`saveStreamedMessageAction`, branch `openSessionAction`, type di summaries + validasi duplikat), route branch, lalu UI (deps markdown/KaTeX, `MarkdownContent`, ChatView mode-aware, dialog toggle, badge, voice filter).

**Tech Stack:** Next.js 16, Prisma 7, AI SDK v7, react-markdown + remark-math + rehype-katex + katex, vitest.

## Global Constraints

- UI & pesan error **bahasa Indonesia**; string error verbatim existing.
- JANGAN tambahkan komentar di kode.
- Server action: `getSession()` + resolve `userId` dari email.
- Migration manual: `prisma/migrations/20260805040000_add_scenario_type/migration.sql`; `npm run db:generate` + `npm run db:migrate-deploy`.
- Vitest untuk lib murni (TDD untuk prompt baru).
- Verifikasi tiap task: `npx tsc --noEmit` + `npm run lint` + `npm test`; build penuh di task terakhir.
- Indonesia TIDAK ditambah ke `LANGUAGES` (daftar belajar); hanya ke `TTS_LANG_MAP` + `GOOGLE_TTS_TL` (internal mode umum).

---

### Task 1: Fix override romanisasi + kolom `type` + maps TTS

**Files:**
- Modify: `lib/actions/chat.ts` (override romanisasi)
- Modify: `prisma/schema.prisma` (`Scenario.type`)
- Create: `prisma/migrations/20260805040000_add_scenario_type/migration.sql`
- Modify: `lib/languages.ts` (`TTS_LANG_MAP` + Indonesian), `lib/tts.ts` (`GOOGLE_TTS_TL` + Indonesian)

**Interfaces:**
- Produces: `db.scenario.type: string` (default "language"); `TTS_LANG_MAP.Indonesian = "id-ID"`; `GOOGLE_TTS_TL.Indonesian = "id"`. Dipakai Task 4-8.

- [ ] **Step 1: Fix override romanisasi**

Di `lib/actions/chat.ts` (`analyzeChatMessageAction`), ganti:

```ts
  if (streamedRomanization && !analysis.reply_romanization) {
    analysis.reply_romanization = streamedRomanization;
  }
```

menjadi:

```ts
  if (streamedRomanization) {
    analysis.reply_romanization = streamedRomanization;
  }
```

- [ ] **Step 2: Schema + migration**

`prisma/schema.prisma` model `Scenario`, tambah setelah `language`:

```prisma
  type       String    @default("language")
```

Create `prisma/migrations/20260805040000_add_scenario_type/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'language';
```

- [ ] **Step 3: Maps TTS**

`lib/languages.ts` `TTS_LANG_MAP`, tambah `Indonesian: "id-ID",` (setelah Turkish). `lib/tts.ts` `GOOGLE_TTS_TL`, tambah `Indonesian: "id",`.

- [ ] **Step 4: Verifikasi**

Run: `npm run db:generate && npm run db:migrate-deploy && npx tsc --noEmit && npm run lint && npm test`
Expected: semua sukses; vitest 43/43.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/chat.ts prisma/schema.prisma prisma/migrations/20260805040000_add_scenario_type/migration.sql lib/languages.ts lib/tts.ts
git commit -m "fix: romanisasi stream selalu menang + kolom scenario.type + TTS Indonesia"
```

---

### Task 2: Template — field `type` + 7 template umum + test (TDD)

**Files:**
- Modify: `lib/templates.ts`, `lib/templates.test.ts`

**Interfaces:**
- Produces: `ScenarioType = "language" | "general"` (export dari `lib/templates.ts`); `ScenarioTemplate.type: ScenarioType`; `SCENARIO_TEMPLATES` 45 bahasa (`type: "language"`) + 7 umum (`type: "general"`, kategori "Umum"). Dipakai Task 4, 8.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `lib/templates.test.ts` (di akhir):

```ts
describe("type skenario", () => {
  it("semua template memiliki type yang valid", () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(["language", "general"]).toContain(t.type);
    }
  });

  it("menyediakan minimal 7 template umum", () => {
    const general = SCENARIO_TEMPLATES.filter((t) => t.type === "general");
    expect(general.length).toBeGreaterThanOrEqual(7);
    for (const t of general) {
      expect(t.category).toBe("Umum");
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run lib/templates.test.ts`
Expected: FAIL — `t.type` undefined.

- [ ] **Step 3: Implementasi**

`lib/templates.ts`:

```ts
export type ScenarioType = "language" | "general";

export interface ScenarioTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  type: ScenarioType;
}
```

Tambah `type: "language"` ke semua 45 template existing (tiap objek). Tambahkan di akhir array (kategori "Umum"):

```ts
  { id: "math-tutor", category: "Umum", title: "Guru Matematika", description: "Diskusi rumus, cara cepat, dan latihan soal", type: "general" },
  { id: "physics-tutor", category: "Umum", title: "Guru Fisika", description: "Konsep fisika dan penyelesaian soal", type: "general" },
  { id: "chemistry-tutor", category: "Umum", title: "Guru Kimia", description: "Reaksi kimia dan perhitungan stoikiometri", type: "general" },
  { id: "writing-assistant", category: "Umum", title: "Asisten Menulis", description: "Membantu menyusun teks, email, atau laporan", type: "general" },
  { id: "daily-discussion", category: "Umum", title: "Diskusi Sehari-hari", description: "Ngobrol santai atau konsultasi keseharian", type: "general" },
  { id: "interview-prep", category: "Umum", title: "Persiapan Interview Kerja", description: "Latihan pertanyaan interview + umpan balik", type: "general" },
  { id: "study-coach", category: "Umum", title: "Coach Belajar", description: "Tips belajar efektif dan manajemen waktu", type: "general" },
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run lib/templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/templates.ts lib/templates.test.ts
git commit -m "feat: template umum (guru matematika dll.) + field type skenario"
```

---

### Task 3: Prompt umum — `buildGeneralStreamPrompt` + `buildGeneralOpeningPrompt` (TDD)

**Files:**
- Modify: `lib/ai-content/chat.ts`, `lib/ai-content/chat.test.ts`

**Interfaces:**
- Produces:
  - `buildGeneralStreamPrompt(role: string, scenario: string, history: { role: "user" | "assistant"; content: string }[]): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] }` — role = judul skenario (mis. "Guru Matematika"), `scenario` = judul + deskripsi bila ada (string bebas).
  - `buildGeneralOpeningPrompt(role: string, scenario: string): { instructions: string; messages }` — `messages: [{ role: "user", content: "Mulai percakapan!" }]`.
  - Dipakai Task 4 (`openSessionAction`) dan Task 5 (route).

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `lib/ai-content/chat.test.ts`:

```ts
describe("buildGeneralStreamPrompt", () => {
  it("menghasilkan instruksi role umum dengan markdown, LaTeX, dan Bahasa Indonesia", () => {
    const history = [{ role: "assistant" as const, content: "Silakan tanya!" }];
    const { instructions, messages } = buildGeneralStreamPrompt("Guru Matematika", "Guru Matematika — Diskusi rumus", history);
    expect(instructions).toContain("Guru Matematika");
    expect(instructions).toContain("Markdown");
    expect(instructions).toContain("LaTeX");
    expect(instructions).toContain("Bahasa Indonesia");
    expect(instructions).not.toContain("||ROM||");
    expect(messages).toEqual([
      { role: "assistant", content: "Silakan tanya!" },
      { role: "user", content: "Halo" },
    ]);
  });
});

describe("buildGeneralOpeningPrompt", () => {
  it("menghasilkan pembuka umum dalam Bahasa Indonesia", () => {
    const { instructions, messages } = buildGeneralOpeningPrompt("Guru Matematika", "Guru Matematika — Diskusi rumus");
    expect(instructions).toContain("Guru Matematika");
    expect(instructions).toContain("Bahasa Indonesia");
    expect(messages).toEqual([{ role: "user", content: "Mulai percakapan!" }]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implementasi**

`lib/ai-content/chat.ts`, tambah di akhir file (pola sama dengan `buildPolyglotStreamPrompt` — `userMessage` terpisah dari history):

```ts
export function buildGeneralStreamPrompt(
  role: string,
  scenario: string,
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[]
): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] } {
  return {
    instructions: [
      `Anda adalah ${role}. Konteks: ${scenario}.`,
      "Jawab dalam Bahasa Indonesia.",
      "Gunakan Markdown untuk keterbacaan: judul (##), daftar (-), teks tebal, blok kode bila perlu.",
      "Tulis rumus matematika dengan LaTeX: $...$ untuk inline, $$...$$ untuk blok.",
      "Jelaskan langkah penyelesaian secara bertahap dan jelas.",
      "Akhiri dengan satu pertanyaan lanjutan agar percakapan berlanjut.",
      "JANGAN menambahkan teks di luar jawaban — tanpa JSON, tanpa pembungkus markdown fence.",
    ].join("\n"),
    messages: [...history, { role: "user", content: userMessage }],
  };
}

export function buildGeneralOpeningPrompt(
  role: string,
  scenario: string
): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] } {
  return {
    instructions: [
      `Anda adalah ${role}. Konteks: ${scenario}.`,
      "Tugas Anda: MULAI percakapan dengan user dalam Bahasa Indonesia.",
      "Perkenalkan diri singkat sebagai role Anda (1-2 kalimat), tawarkan bantuan, dan akhiri dengan satu pertanyaan.",
      "Gunakan Markdown sederhana dan rumus LaTeX bila relevan ($...$).",
      "JANGAN menambahkan teks di luar jawaban — tanpa JSON.",
    ].join("\n"),
    messages: [{ role: "user", content: "Mulai percakapan!" }],
  };
}
```

Catatan: history di sini TIDAK memuat pesan user (builder menambahkannya sendiri) — konsisten dengan `buildPolyglotStreamPrompt`; route mem-pass `aiMessages` yang sudah berisi pesan user? — TIDAK: route mem-build `aiMessages` dari DB (history) lalu builder menambah pesan user. Pastikan di Task 5 route tidak push pesan user ke `aiMessages` sebelum dipanggil builder (cek blok existing: `buildPolyglotStreamPrompt(userMessage, ..., aiMessages)` menerima userMessage terpisah — pattern sama).

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: PASS (semua test chat).

- [ ] **Step 5: Commit**

```bash
git add lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: prompt umum (markdown + LaTeX, Bahasa Indonesia) untuk stream & pembuka"
```

---

### Task 4: Actions — `saveStreamedMessageAction`, `openSessionAction` branch, type di summaries & validasi

**Files:**
- Modify: `lib/actions/chat.ts`, `lib/actions/scenario.ts`

**Interfaces:**
- Consumes: Task 1 (`db.scenario.type`), Task 2 (`ScenarioType`), Task 3 (`buildGeneralOpeningPrompt`).
- Produces:
  - `saveStreamedMessageAction(sessionId: string, content: string): Promise<{ messageId: string } | { error: string }>` — persist AI message tanpa analysisJson. Dipakai Task 7.
  - `openSessionAction` — branch general (prompt umum, opener tanpa analysisJson, `suggestedReplies: []`).
  - `ScenarioSummary.type: ScenarioType`, `SessionDto.type: ScenarioType`; `getChatHomeAction` memuat type; `createScenarioAction` menerima `type` + validasi duplikat (umum: templateId saja; bahasa: templateId+language).

- [ ] **Step 1: `lib/actions/chat.ts`**

Import `buildGeneralOpeningPrompt` dari `../ai-content/chat`; import `type ScenarioType` dari `../templates`.

`openSessionAction`: setelah resolve scenario (tambah `type` di select), branch:

```ts
  const scenario = await db.scenario.findFirst({
    where: { id: scenarioId, userId: user.id },
    select: { title: true, description: true, type: true },
  });
  if (!scenario) return { error: "Akses ditolak." };
  const isGeneral = scenario.type === "general";

  const sessionId = await getOrCreateSession(user.id, language, scenarioId);
  if (!sessionId) return { error: "Pengguna tidak ditemukan." };

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const role = scenario.title;
  const context = scenario.description ? `${scenario.title} — ${scenario.description}` : scenario.title;
  const { instructions, messages } = isGeneral
    ? buildGeneralOpeningPrompt(role, context)
    : buildPolyglotOpeningPrompt(language, level, scenario.title);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 2048, temperature: 0.8 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan pembuka percakapan." };
  }

  const parsed = isGeneral
    ? { reply_in_target_language: text }
    : parseAiJson<{ reply_in_target_language?: string; reply_translation_in_indonesian?: string; suggested_replies?: unknown }>(text);

  if (!parsed || !parsed.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: parsed.reply_in_target_language,
      analysisJson: isGeneral ? undefined : (parsed as never),
    },
  });

  return {
    sessionId,
    messageId: aiMsg.id,
    reply: parsed.reply_in_target_language,
    translation: isGeneral ? "" : (parsed.reply_translation_in_indonesian ?? ""),
    suggestedReplies: isGeneral ? [] : normalizeSuggestedReplies(parsed.suggested_replies).slice(0, 3),
  };
```

Tambah di akhir file:

```ts
export async function saveStreamedMessageAction(
  sessionId: string,
  content: string
): Promise<{ messageId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!content.trim()) return { error: "Balasan kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!dbSession) return { error: "Akses ditolak." };
  const aiMsg = await db.message.create({
    data: { sessionId, role: "ai", content: content.trim() },
  });
  return { messageId: aiMsg.id };
}
```

- [ ] **Step 2: `lib/actions/scenario.ts`**

- Import `type ScenarioType` dari `../templates`.
- `ScenarioSummary` + `type: ScenarioType`.
- `SessionDto` + `type: ScenarioType`.
- `getChatHomeAction`: `scenarioRows` sudah full record (termasuk type) → `type: sc.type as ScenarioType`; sessions include scenario select tambah `type: true` → `type: (s.scenario?.type as ScenarioType | undefined) ?? "language"`.
- `createScenarioAction(input)`: input + `type: ScenarioType`; validasi:
  - `const type = input.type === "general" ? "general" : "language";`
  - Duplikat: general → `findFirst({ userId, templateId: template.id, type: "general" })` → error `"Skenario dengan template ini sudah ada."`; bahasa → existing `(templateId, language)` → `"Skenario dengan template dan bahasa ini sudah ada."`
  - create data + `type`.
- `getSessionMessagesAction`: `SessionDto` mapping + `type: (s.scenario?.type as ScenarioType | undefined) ?? "language"` (include scenario select tambah type).

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/chat.ts lib/actions/scenario.ts
git commit -m "feat: saveStreamedMessageAction + openSessionAction branch umum + type di summaries"
```

---

### Task 5: Route branch + role untuk stream umum

**Files:**
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: Task 3 (`buildGeneralStreamPrompt`), Task 1 (`db.scenario.type`).
- Produces: `/api/chat` untuk skenario umum — stream markdown Bahasa Indonesia tanpa marker.

- [ ] **Step 1: Branch di route**

Di `app/api/chat/route.ts`:

```ts
import { buildGeneralStreamPrompt, buildPolyglotStreamPrompt } from "@/lib/ai-content/chat";
```

Ubah include scenario select:

```ts
  const dbSession = await db.session.findFirst({
    where: { id: body.sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true, description: true, type: true } } },
  });
```

Ganti blok `buildPolyglotStreamPrompt`:

```ts
  const isGeneral = dbSession.scenario?.type === "general";
  const context = dbSession.scenario?.description
    ? `${dbSession.scenario.title} — ${dbSession.scenario.description}`
    : dbSession.scenario?.title ?? "Percakapan";
  const { instructions, messages } = isGeneral
    ? buildGeneralStreamPrompt(dbSession.scenario?.title ?? "Asisten", context, userMessage, aiMessages)
    : buildPolyglotStreamPrompt(userMessage, language, "A1", scenario, aiMessages);
```

(`aiMessages` di sini BELUM berisi pesan user — kedua builder menerima userMessage terpisah; jangan push sebelum branch.)

Periksa: blok history + push existing — pastikan push pesan user terjadi SEBELUM branch? Tidak: `aiMessages` dipakai oleh builder yang push sendiri. Hapus `aiMessages.push(...)` bila ada di route; jika tidak ada, biarkan.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: route stream bercabang untuk skenario umum (markdown Bahasa Indonesia)"
```

---

### Task 6: Deps markdown/KaTeX + `MarkdownContent`

**Files:**
- Modify: `package.json`
- Create: `components/MarkdownContent.tsx`

**Interfaces:**
- Produces: `MarkdownContent({ content: string })` — render markdown + LaTeX (KaTeX), dark-friendly. Dipakai Task 7.

- [ ] **Step 1: Instal deps**

Run: `npm i react-markdown remark-math rehype-katex katex`

- [ ] **Step 2: `components/MarkdownContent.tsx`**

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => <a {...props} className="text-primary underline underline-offset-2" />,
          pre: ({ node, ...props }) => (
            <pre {...props} className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 my-2 text-xs" />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code {...props} className="rounded bg-muted/50 px-1 py-0.5 text-[0.85em]" />
            ) : (
              <code {...props} />
            ),
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 my-2 space-y-1" />,
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 my-2 space-y-1" />,
          li: ({ node, ...props }) => <li {...props} className="leading-relaxed" />,
          h1: ({ node, ...props }) => <h1 {...props} className="text-base font-extrabold my-2" />,
          h2: ({ node, ...props }) => <h2 {...props} className="text-sm font-extrabold my-2" />,
          h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-bold my-1.5" />,
          p: ({ node, ...props }) => <p {...props} className="my-1.5" />,
          strong: ({ node, ...props }) => <strong {...props} className="font-bold" />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table {...props} className="w-full text-xs border-collapse" />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

Catatan: props `node` di-destructure agar tidak diteruskan ke DOM (React 19 warning). Verifikasi tsc.

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/MarkdownContent.tsx
git commit -m "feat: MarkdownContent (markdown + rumus KaTeX) untuk balasan umum"
```

---

### Task 7: ChatView mode-aware

**Files:**
- Modify: `components/ChatView.tsx`

**Interfaces:**
- Consumes: Task 4 (`saveStreamedMessageAction`, `SessionDto.type`), Task 6 (`MarkdownContent`).
- Produces: mode umum — markdown render, tanpa analisis/saran/romanisasi; mode bahasa tidak berubah.

- [ ] **Step 1: Mode + render**

- `const isGeneral = session?.type === "general";`
- Bubble AI (message render): bila `isGeneral` → `<MarkdownContent content={m.content} />` (dalam div bubble biasa); selainnya → plain text existing. Bubble user tetap plain (dua mode).
- Streaming bubble: bila `isGeneral` → `<MarkdownContent content={shown} />` (shown = streamingText, tanpa marker); selainnya existing.
- Mode umum: jangan render Baca/Arti/analisis (guard `!isGeneral` pada: kartu analisis + toggle, romanization/translation lines, analyzing skeleton tetap? — analyzing tidak dipakai di general; streaming langsung disimpan).

- [ ] **Step 2: `send()` branch general**

Di `send()`, setelah `fetchStream` retry + `replyText` ditentukan:

```ts
    if (isGeneral) {
      if (!replyText) {
        if (!mountedRef.current) return;
        setError("Balasan kosong.");
        setStreaming(false);
        setStreamingText("");
        abortRef.current = null;
        return;
      }
      if (!mountedRef.current) return;
      setAnalyzing(true);
      try {
        const res = await saveStreamedMessageAction(sessionId, replyText);
        if (!mountedRef.current) return;
        if ("error" in res) {
          toast.error(res.error);
          setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText }]);
          return;
        }
        setMessages((m) => [...m, { id: res.messageId, role: "ai", content: replyText, expanded: false }]);
      } catch (e) {
        if (!mountedRef.current) return;
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan balasan.");
        setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText }]);
      } finally {
        setAnalyzing(false);
        setStreamingText("");
        setStreamingRomanization("");
        abortRef.current = null;
      }
      return;
    }
```

(ditempatkan setelah `replyText`/`romanization` dihitung — untuk general, `parts`/marker tidak ada; `replyText = acc.trim()`. Perhatikan: split `||ROM||` untuk general menghasilkan `parts[0]` = seluruh teks → `replyText` benar. Aman.)

- Mode umum: jangan panggil `analyzeChatMessageAction`; `setSuggestions` tidak dipakai (chips hidden via `!isGeneral` di render suggestions).

- [ ] **Step 3: Guard UI**

- Blok suggestions: `{suggestions.length > 0 && !streaming && !analyzing && !isGeneral && (`
- Blok analyzing placeholder: tetap (dipakai general untuk "menyimpan..."); teks "Menerjemahkan & menganalisis..." → untuk general tampil "Menyimpan balasan..."? — gunakan teks kondisional: `{isGeneral ? "Menyimpan balasan..." : "Menerjemahkan & menganalisis..."}`.
- Lihat Penjelasan toggle + kartu analisis: guard `!isGeneral` (messages analysis tidak ada di general anyway — analysis undefined → tidak dirender; aman tanpa guard tambahan).

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 5: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: ChatView mode umum (markdown render, simpan langsung tanpa analisis)"
```

---

### Task 8: Dialog toggle + badge Umum + voice filter

**Files:**
- Modify: `components/ScenarioCreateDialog.tsx`, `components/chat-lists.tsx`, `components/VoiceChatView.tsx`

**Interfaces:**
- Consumes: Task 2 (`ScenarioType`, template type), Task 4 (`createScenarioAction` input type, `getChatHomeAction`).
- Produces: pembuatan skenario umum via dialog; badge "Umum"; voice picker hanya bahasa.

- [ ] **Step 1: `ScenarioCreateDialog.tsx`**

- State `const [mode, setMode] = useState<ScenarioType>("language");`
- Toggle di atas pilihan bahasa (baris radio 2 tombol):

```tsx
<div className="grid grid-cols-2 gap-1.5">
  <Button type="button" variant={mode === "language" ? "default" : "outline"} size="sm" onClick={() => { setMode("language"); setTemplateId(null); setTitle(""); setDescription(""); }}>
    Belajar Bahasa
  </Button>
  <Button type="button" variant={mode === "general" ? "default" : "outline"} size="sm" onClick={() => { setMode("general"); setTemplateId(null); setTitle(""); setDescription(""); }}>
    Umum
  </Button>
</div>
```

- Blok pilih bahasa hanya bila `mode === "language"`.
- Grid template: filter `t.type === mode`; kategori dari template filter.
- `usedTemplate` check: `mode === "general" ? used.some((u) => u.templateId === t.id) : isTemplateUsed(used, t.id, language)`.
- `pickTemplate` guard sama.
- `save()`: `createScenarioAction({ templateId, title, description, language: mode === "general" ? "Indonesian" : language, type: mode })` — hmm: untuk umum, language = "Indonesian" (internal). Kirim `type: mode`.
- `getScenarioTemplatesUsedAction` — sudah mengembalikan semua (templateId + language) — cukup.
- Language select onValueChange: tetap (hanya mode bahasa).

- [ ] **Step 2: `chat-lists.tsx`**

`ScenarioCard`: setelah badge "Aktif", tambah badge "Umum" bila `scenario.type === "general"`:

```tsx
{scenario.type === "general" && <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">Umum</Badge>}
```

(import `ScenarioType` tidak perlu — bandingkan string.)

- [ ] **Step 3: `VoiceChatView.tsx`**

Picker (branch tanpa session): setelah `getChatHomeAction` → `setScenarios(res.scenarios.filter((s) => s.type !== "general"));`

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: semua sukses.

- [ ] **Step 5: Commit**

```bash
git add components/ScenarioCreateDialog.tsx components/chat-lists.tsx components/VoiceChatView.tsx
git commit -m "feat: toggle jenis skenario di dialog, badge Umum, voice chat hanya bahasa"
```

---

## Verifikasi akhir (setelah semua task)

- `npm test` — semua vitest hijau (templates type+7 umum, prompt umum, existing).
- `npx tsc --noEmit && npm run lint && npm run build` — sukses.
- `npm run db:migrate-deploy` — migration `20260805040000_add_scenario_type` applied.
- Manual: buat skenario "Guru Matematika" (mode Umum) → tanya rumus (mis. "rumus cepat kuadrat") → rumus ter-render KaTeX, tanpa kartu analisis; kirim ulang → lanjut; bubble AI markdown; TTS Indonesia jalan; mode bahasa (Korean) — Baca/Arti cocok dengan isi (bug fixed); voice chat tidak menampilkan skenario umum.
