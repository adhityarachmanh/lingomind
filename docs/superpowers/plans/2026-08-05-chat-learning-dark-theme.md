# Chat Learning Helpers + Dark Theme Lengkap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menuntaskan dark theme, dan menambah ke chat: akhiri sesi (reset memori AI), saran jawaban AI, tombol Lihat Penjelasan, dan pembuka percakapan AI saat skenario dipilih.

**Architecture:** 5 task independen yang berurutan: (1) perbaikan dark theme 4 file, (2) migrasi `Session.endedAt`, (3) prompt builder + test pure (TDD), (4) server actions chat (`endChatSessionAction`, `openSessionAction`, filter `endedAt`), (5) UI `ChatView` yang mengonsumsi semuanya. Backend chat: `getOrCreateSession` hanya memakai ulang sesi aktif (`endedAt: null`).

**Tech Stack:** Next.js (App Router, server actions), Prisma 7 (Neon PostgreSQL), AI SDK (`generateText` + model openai-compatible), Tailwind v4 (token dark-only), lucide-react, vitest.

## Global Constraints

- UI & pesan error **bahasa Indonesia**; string error lama dipertahankan verbatim: "Sesi berakhir. Silakan login kembali.", "Pesan tidak boleh kosong.", "AI mengembalikan respons tidak valid. Silakan coba lagi."
- Dark-only tanpa toggle (token `:root` di `app/globals.css` sudah dark; jangan menambah `.dark` block atau script theme).
- JANGAN tambahkan komentar di kode.
- Fungsi murni diuji vitest (`*.test.ts` di `lib/`); action/UI cukup lint + tsc + build.
- Migration ditulis manual: `prisma/migrations/<timestamp>_<name>/migration.sql`, diterapkan via `migrate deploy` (Vercel). Regenerasi client via `npm run db:generate`.
- Verifikasi setiap task selesai: `npx tsc --noEmit` + `npm run lint`. Build penuh (`npm run build`) dijalankan di task terakhir.

---

### Task 1: Dark theme lengkap (4 titik terang)

**Files:**
- Modify: `app/(app)/layout.tsx:9`
- Modify: `app/(auth)/verify-email/page.tsx` (baris 5, 8, 15-19)
- Modify: `app/not-found.tsx` (baris 5-11)
- Modify: `app/(app)/error.tsx` (baris 7-8)

**Interfaces:**
- Produces: seluruh halaman konsisten dark (token `bg-background`/`bg-card`/`bg-primary`/`text-muted-foreground`); tidak ada konsumen lain.

- [ ] **Step 1: `app/(app)/layout.tsx:9`** — ganti kelas

```tsx
<div className="min-h-screen bg-background text-foreground">
```

- [ ] **Step 2: `app/(auth)/verify-email/page.tsx`** — ganti kelas-kelas berikut:

```tsx
// baris 5: text-slate-500 → text-muted-foreground
// baris 8: text-rose-500 → text-destructive
// baris 15: bg-white p-8 rounded-2xl border border-slate-200 shadow-lg → bg-card p-8 rounded-2xl border-border shadow-card
// baris 16: text-teal-600 → text-primary
// baris 18: text-slate-500 → text-muted-foreground
// baris 19: bg-teal-500 hover:bg-teal-600 → bg-primary hover:bg-primary/90
```

- [ ] **Step 3: `app/not-found.tsx`** — ganti kelas:

```tsx
// baris 5: bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 → bg-background text-foreground
// baris 6: text-slate-300 dark:text-slate-700 → text-muted-foreground
// baris 8: text-slate-500 dark:text-slate-400 → text-muted-foreground
// baris 11: bg-teal-500 hover:bg-teal-600 → bg-primary hover:bg-primary/90
```

- [ ] **Step 4: `app/(app)/error.tsx`** — ganti kelas:

```tsx
// baris 7: text-slate-500 dark:text-slate-400 → text-muted-foreground
// baris 8: bg-teal-500 hover:bg-teal-600 → bg-primary hover:bg-primary/90
```

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit && npm run lint`
Expected: keduanya sukses tanpa error.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(auth)/verify-email/page.tsx" app/not-found.tsx "app/(app)/error.tsx"
git commit -m "style: tuntaskan dark theme di semua halaman (token, tanpa light spot)"
```

---

### Task 2: Kolom `endedAt` pada Session + migration

**Files:**
- Modify: `prisma/schema.prisma` (model `Session`, baris 56-67)
- Create: `prisma/migrations/20260805010000_add_session_ended_at/migration.sql`

**Interfaces:**
- Produces: `db.session.endedAt: Date | null`; field Prisma `endedAt` (map `ended_at`). Dipakai Task 4 (`getOrCreateSession` filter + `endChatSessionAction`).

- [ ] **Step 1: Tambah kolom di schema**

```prisma
model Session {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  language  String
  level     String    @default("A1")
  scenario  String
  endedAt   DateTime? @map("ended_at")
  createdAt DateTime  @default(now())
  messages  Message[]

  @@map("chat_sessions")
}
```

- [ ] **Step 2: Tulis migration SQL**

Create `prisma/migrations/20260805010000_add_session_ended_at/migration.sql`:

```sql
ALTER TABLE "chat_sessions" ADD COLUMN "ended_at" TIMESTAMP(3);
```

- [ ] **Step 3: Regenerasi client + verifikasi**

Run: `npm run db:generate && npx tsc --noEmit`
Expected: generate sukses (tidak butuh koneksi DB); tsc sukses.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260805010000_add_session_ended_at/migration.sql
git commit -m "feat: kolom ended_at pada chat_sessions (akhiri sesi, reset memori AI)"
```

---

### Task 3: Prompt builder — `suggested_replies` + `buildPolyglotOpeningPrompt` (TDD)

**Files:**
- Modify: `lib/ai-content/chat.ts`
- Create: `lib/ai-content/chat.test.ts`

**Interfaces:**
- Produces:
  - `buildPolyglotSystemPrompt(language: string, level: string, scenario: string): string` — sekarang memuat `suggested_replies` di skema JSON + aturan.
  - `buildPolyglotOpeningPrompt(language: string, level: string, scenario: string): { messages: { role: "system"; content: string }[] }` — prompt pembuka.
- Consumes: tidak ada. Dipakai Task 4 di `lib/actions/chat.ts`.

- [ ] **Step 1: Tulis test yang gagal**

Create `lib/ai-content/chat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPolyglotOpeningPrompt, buildPolyglotSystemPrompt } from "./chat";

describe("buildPolyglotSystemPrompt", () => {
  it("mencantumkan suggested_replies di skema JSON", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).toContain("suggested_replies");
  });

  it("memberi aturan untuk suggested_replies", () => {
    const prompt = buildPolyglotSystemPrompt("English", "A1", "Restaurant");
    expect(prompt).toContain("2-3 kalimat singkat");
  });
});

describe("buildPolyglotOpeningPrompt", () => {
  it("menghasilkan system prompt pembuka yang memuat skenario dan suggested_replies", () => {
    const { messages } = buildPolyglotOpeningPrompt("English", "A1", "Restaurant");
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Restaurant");
    expect(messages[0].content).toContain("suggested_replies");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL — `buildPolyglotOpeningPrompt is not a function` dan assertion `suggested_replies` gagal.

- [ ] **Step 3: Implementasi**

`lib/ai-content/chat.ts` — tambahkan `suggested_replies` ke skema JSON di `buildPolyglotSystemPrompt` (setelah baris `reply_translation_in_indonesian`), dan tambahkan aturan baru di blok "Aturan:" (setelah baris `vocab_highlight`):

```
'  "suggested_replies": ["string 1", "string 2", "string 3"]',
```

```
"- suggested_replies: 2-3 kalimat singkat (maks ~12 kata) dalam bahasa target yang wajar diucapkan USER sebagai lanjutan percakapan — bervariasi (mis. 1 pertanyaan + 1 pernyataan/persetujuan). Selalu isi 2-3; jika benar-benar tidak mungkin, isi array kosong [].",
```

Tambahkan fungsi baru di akhir file:

```ts
export function buildPolyglotOpeningPrompt(
  language: string,
  level: string,
  scenario: string
): { messages: { role: "system"; content: string }[] } {
  return {
    messages: [
      {
        role: "system",
        content: [
          `Anda adalah tutor bahasa AI. Target bahasa: ${language}. Level CEFR user: ${level}. Skenario: ${scenario}.`,
          `Anda sedang bermain peran dalam skenario '${scenario}' sebagai penutur asli yang ramah.`,
          "",
          "Tugas Anda: MULAI percakapan. Belum ada pesan dari user sama sekali.",
          "Anda WAJIB membalas dengan HANYA JSON valid dengan struktur berikut:",
          "{",
          '  "reply_in_target_language": "string (pembuka percakapan natural dalam bahasa target — 2-4 kalimat, dalam karakter skenario, AKHIRI dengan satu pertanyaan ke user)",',
          '  "reply_translation_in_indonesian": "string (terjemahan Bahasa Indonesia dari reply_in_target_language)",',
          '  "suggested_replies": ["string 1", "string 2", "string 3"]',
          "}",
          "",
          "Aturan:",
          `- reply_in_target_language WAJIB dalam bahasa ${language} sepenuhnya — jangan gunakan bahasa lain.`,
          "- Pembuka harus natural, hidup, dan menetapkan konteks skenario.",
          "- suggested_replies: 2-3 kalimat singkat (maks ~12 kata) dalam bahasa target yang wajar diucapkan USER sebagai jawaban atas pertanyaan pembuka — bervariasi (mis. 1 pertanyaan balasan + 1 pernyataan/persetujuan).",
          "- Pastikan semua string dalam JSON valid (escape tanda kutip, newline dengan \\n).",
          "- JANGAN tambahkan teks apa pun di luar JSON.",
        ].join("\n"),
      },
    ],
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run lib/ai-content/chat.test.ts lib/ai-content/parse.test.ts`
Expected: semua PASS (test lama `parse.test.ts` juga tetap hijau).

- [ ] **Step 5: Commit**

```bash
git add lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: suggested_replies + buildPolyglotOpeningPrompt di prompt builder chat"
```

---

### Task 4: Server actions chat — `endChatSessionAction`, `openSessionAction`, filter `endedAt`

**Files:**
- Modify: `lib/actions/chat.ts`

**Interfaces:**
- Consumes: `buildPolyglotOpeningPrompt` (Task 3), `ActionResult` (`lib/actions/types.ts` = `{ error?: string; message?: string }`), `getSession()` (`lib/auth.ts`), `generateText` + `model` (`lib/ai.ts`), `parseAiJson` (`lib/ai-content/parse.ts`), `db` (`lib/db.ts`).
- Produces (dipakai Task 5):
  - `PolyglotAnalysis.suggested_replies?: string[]`
  - `endChatSessionAction(sessionId: string): Promise<ActionResult>`
  - `openSessionAction(scenario: string, language: string): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }>` dengan `OpenSessionResult = { sessionId: string; messageId: string; reply: string; translation: string; suggestedReplies: string[] }`
  - `sendPolyglotMessageAction` — tidak berubah signature; `getOrCreateSession` kini filter `endedAt: null`.

- [ ] **Step 1: Tambah `suggested_replies` ke interface + filter `endedAt` di `getOrCreateSession`**

```ts
export interface PolyglotAnalysis {
  scores: { grammar: number; fluency: string };
  detailed_analysis: {
    original_segment: string;
    corrected_segment: string;
    rule: string;
    explanation_in_indonesian: string;
  }[];
  native_rephrasing: { formal: string; casual: string };
  vocab_highlight: { word_target: string; meaning_in_indonesian: string };
  reply_in_target_language: string;
  reply_translation_in_indonesian: string;
  suggested_replies?: string[];
}
```

```ts
  const existing = await db.session.findFirst({
    where: { userId: email, language, scenario, endedAt: null },
  });
```

- [ ] **Step 2: Tambah `endChatSessionAction` dan `openSessionAction` di akhir file**

```ts
export async function endChatSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await db.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
  return { message: "ok" };
}

export interface OpenSessionResult {
  sessionId: string;
  messageId: string;
  reply: string;
  translation: string;
  suggestedReplies: string[];
}

export async function openSessionAction(
  scenario: string,
  language: string
): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const email = session.email;
  const sessionId = await getOrCreateSession(email, language, scenario);

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const { messages } = buildPolyglotOpeningPrompt(language, level, scenario);

  let text: string;
  try {
    const result = await generateText({ model, messages, maxOutputTokens: 2048, temperature: 0.8 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan pembuka percakapan." };
  }

  const parsed = parseAiJson<{
    reply_in_target_language?: string;
    reply_translation_in_indonesian?: string;
    suggested_replies?: string[];
  }>(text);

  if (!parsed || !parsed.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: parsed.reply_in_target_language,
    },
  });

  return {
    sessionId,
    messageId: aiMsg.id,
    reply: parsed.reply_in_target_language,
    translation: parsed.reply_translation_in_indonesian ?? "",
    suggestedReplies: Array.isArray(parsed.suggested_replies) ? parsed.suggested_replies.slice(0, 3) : [],
  };
}
```

Juga update import dari `lib/ai-content/chat`:

```ts
import { buildPolyglotOpeningPrompt, buildPolyglotUserMessage } from "../ai-content/chat";
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit && npm run lint`
Expected: sukses tanpa error.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/chat.ts
git commit -m "feat: endChatSessionAction + openSessionAction (pembuka AI) + filter endedAt"
```

---

### Task 5: UI ChatView — Akhiri Sesi, chip saran, Lihat Penjelasan, pembuka AI

**Files:**
- Modify: `components/ChatView.tsx`

**Interfaces:**
- Consumes: `sendPolyglotMessageAction` (return `{ analysis, sessionId, messageId }`; `analysis.suggested_replies?: string[]`), `endChatSessionAction(sessionId)`, `openSessionAction(scenario, language)` — semua dari Task 4.
- Produces: UX lengkap; tidak ada konsumen lain.

- [ ] **Step 1: Update imports & interface Message**

```tsx
import { Bookmark, Bot, ChevronDown, ChevronUp, FileCheck2, Loader2, LogOut, PencilLine, Send } from "lucide-react";
import {
  endChatSessionAction,
  openSessionAction,
  saveFlashcardAction,
  sendPolyglotMessageAction,
  type PolyglotAnalysis,
} from "@/lib/actions/chat";
```

```tsx
interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  analysis?: PolyglotAnalysis;
  expanded?: boolean;
}
```

- [ ] **Step 2: Tambah state baru**

```tsx
const [sessionId, setSessionId] = useState<string | null>(null);
const [suggestions, setSuggestions] = useState<string[]>([]);
const [opening, setOpening] = useState(false);
```

- [ ] **Step 3: `startChat` async + `endSession` + `toggleExpanded`**

Ganti `startChat` (baris 94-102):

```tsx
async function startChat(sId: string, sTitle: string) {
  setScenarioId(sId);
  setScenarioTitle(sTitle);
  setTtsLang(ttsMap[language] ?? "en-US");
  setMessages([]);
  setSuggestions([]);
  setSessionId(null);
  setPhase("chat");
  setError(null);
  setSwitchOpen(false);
  setOpening(true);
  try {
    const res = await openSessionAction(sId, language);
    if ("error" in res) { toast.error(res.error); return; }
    setSessionId(res.sessionId);
    if ("alreadyStarted" in res) return;
    setMessages([{ id: res.messageId, role: "ai", content: res.reply }]);
    setSuggestions(res.suggestedReplies);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Gagal memulai percakapan.");
  } finally {
    setOpening(false);
  }
}
```

Tambah setelah `startChat`:

```tsx
async function endSession() {
  if (sessionId) {
    const res = await endChatSessionAction(sessionId);
    if ("error" in res) { toast.error(res.error); return; }
  }
  toast.success("Sesi diakhiri. Percakapan baru dimulai saat memilih skenario.");
  setPhase("picker");
  setMessages([]);
  setSuggestions([]);
  setSessionId(null);
  setScenarioId("");
  setScenarioTitle("");
}

function toggleExpanded(id: string) {
  setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
}
```

- [ ] **Step 4: `send` — dukung chip + set sessionId/suggestions**

Ganti signature `send()` → `send(textOverride?: string)` dan body-nya:

```tsx
async function send(textOverride?: string) {
  const text = (textOverride ?? input).trim();
  if (!text || sending) return;
  setInput("");
  setSuggestions([]);
  setSending(true);
  setError(null);
  setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
  try {
    const res = await sendPolyglotMessageAction(scenarioId, language, text);
    if ("error" in res) { setError(res.error ?? null); return; }
    setSessionId(res.sessionId);
    setSuggestions(res.analysis.suggested_replies ?? []);
    setMessages((m) => [...m, { id: res.messageId, role: "ai", content: res.analysis.reply_in_target_language, analysis: res.analysis }]);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
  } finally {
    setSending(false);
  }
}
```

- [ ] **Step 5: Header — tombol "Akhiri Sesi"**

Dalam header (di samping Dialog "Ganti Skenario", setelah `</Dialog>`, baris ~188):

```tsx
<Button variant="outline" size="sm" onClick={endSession} disabled={opening || sending}>
  <LogOut className="h-3.5 w-3.5 mr-1.5" />
  Akhiri Sesi
</Button>
```

- [ ] **Step 6: "Lihat Penjelasan" — bungkus kartu analisis dengan toggle**

Pada render pesan AI, ubah `{m.analysis && (` (baris 201) menjadi `{m.analysis && (` di dalamnya tambah tombol toggle sebelum `<Card>`:

```tsx
{m.analysis && (
  <div>
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground -ml-2"
      onClick={() => toggleExpanded(m.id)}
    >
      {m.expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
      {m.expanded ? "Tutup Penjelasan" : "Lihat Penjelasan"}
    </Button>
    {m.expanded && (
      <Card className="border-border bg-card overflow-hidden shadow-none">
        {/* ...konten kartu analisis existing persis seperti sekarang (baris 202-248)... */}
      </Card>
    )}
  </div>
)}
```

Perhatikan: kartu analisis hanya dirender saat `m.expanded`. Konten dalam `<Card>` tidak berubah.

- [ ] **Step 7: Skeleton pembuka + chip saran di atas input**

Tambahkan di dalam area scroll pesan, tepat sebelum blok `{sending && (...)}` (baris ~268):

```tsx
{opening && (
  <div className="flex justify-start gap-2">
    <Avatar className="h-8 w-8 shrink-0 border border-border bg-muted">
      <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
    </Avatar>
    <div className="max-w-[85%] space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32" />
      <p className="text-[11px] text-muted-foreground pt-1">AI Tutor membuka percakapan...</p>
    </div>
  </div>
)}
```

Antara blok `{error && ...}` (baris 282) dan form input (baris 284), tambahkan chip saran:

```tsx
{suggestions.length > 0 && !sending && !opening && (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saran jawaban:</span>
    {suggestions.map((s, i) => (
      <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>
        {s}
      </Button>
    ))}
  </div>
)}
```

- [ ] **Step 8: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: semuanya sukses.

- [ ] **Step 9: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: akhiri sesi, chip saran AI, lihat penjelasan, dan pembuka percakapan di chat"
```

---

## Verifikasi akhir (setelah semua task)

- Run: `npm test` — semua test vitest hijau (parse.test.ts + chat.test.ts).
- Run: `npx tsc --noEmit && npm run lint && npm run build` — sukses.
- Manual (bila DB + API AI tersedia): pilih skenario → AI menyapa + chip saran muncul → klik chip → balasan + chip baru; "Akhiri Sesi" → kembali ke picker → pilih skenario sama → AI mulai fresh (tidak ingat lama); "Ganti Skenario" → pembuka baru; halaman 404/error/verify-email tampil dark.
