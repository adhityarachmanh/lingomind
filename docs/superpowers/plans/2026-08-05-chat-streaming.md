# Chat Streaming 2 Fase + Fix Tooltip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Balasan AI di chat teks di-stream kata per kata via route `POST /api/chat` (`streamText`), analisis JSON menyusul via `analyzeChatMessageAction`, tombol Stop untuk membatalkan stream, dan perbaikan error `Tooltip must be used within TooltipProvider`.

**Architecture:** 5 task berurutan: (1) fix TooltipProvider di ChatView, (2) `buildPolyglotStreamPrompt` + test (TDD), (3) route `/api/chat` (auth + ownership + persist pesan user + streamText), (4) `analyzeChatMessageAction` (generate JSON analisis + persist AI message dengan teks streamed), (5) UI streaming ChatView (fetch reader + bubble progresif + tombol Stop + fase analisis). Voice chat tetap memakai `sendPolyglotMessageAction` (tidak berubah).

**Tech Stack:** Next.js 16 (route handlers, server actions), AI SDK v7 (`streamText` + `toTextStreamResponse`), Prisma 7, lucide-react, sonner, vitest.

## Global Constraints

- UI & pesan error **bahasa Indonesia**; string error verbatim: "Sesi berakhir. Silakan login kembali.", "Pesan tidak boleh kosong.", "Pengguna tidak ditemukan.", "Akses ditolak.", "AI mengembalikan respons tidak valid. Silakan coba lagi.", "Balasan kosong.", "Permintaan tidak valid."
- JANGAN tambahkan komentar di kode.
- Server: selalu `getSession()` lalu resolve `userId` via `db.user.findUnique({ where: { email } })`.
- Vitest hanya untuk lib murni (`lib/*.test.ts`), TDD untuk prompt builder.
- Verifikasi tiap task: `npx tsc --noEmit` + `npm run lint` + `npm test`; build penuh di task terakhir.
- `maxDuration = 60` pada route (Vercel); CSP `connect-src 'self'` memungkinkan fetch same-origin `/api/chat` — tanpa perubahan CSP.
- `sendPolyglotMessageAction` TETAP ada (dipakai VoiceChatView).

---

### Task 1: Fix TooltipProvider di ChatView

**Files:**
- Modify: `components/ChatView.tsx`

**Interfaces:**
- Produces: konten chat terbungkus `<TooltipProvider delayDuration={200}>` — `SpeakButton` (yang memakai Tooltip) berhenti melempar `Tooltip must be used within TooltipProvider`. Tidak ada konsumen lain.

- [ ] **Step 1: Bungkus konten**

Di `components/ChatView.tsx`: tambah import `TooltipProvider` dari `@/components/ui/tooltip`, lalu bungkus JSX utama (seluruh return `ChatView`) dengan `<TooltipProvider delayDuration={200}>...</TooltipProvider>`. Struktur: return terluar menjadi `<TooltipProvider delayDuration={200}><div className="flex h-[calc(100dvh-3.5rem)]">...` (tutup `</TooltipProvider>` setelah div utama).

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses; vitest tetap 22/22.

- [ ] **Step 3: Commit**

```bash
git add components/ChatView.tsx
git commit -m "fix: TooltipProvider di ChatView (error Tooltip tanpa provider)"
```

---

### Task 2: `buildPolyglotStreamPrompt` + test (TDD)

**Files:**
- Modify: `lib/ai-content/chat.ts`
- Modify: `lib/ai-content/chat.test.ts`

**Interfaces:**
- Produces: `buildPolyglotStreamPrompt(userMessage: string, language: string, level: string, scenario: string, history: { role: "user" | "assistant"; content: string }[]): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] }` — dipakai Task 3 (route).
- Consumes: tidak ada.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `lib/ai-content/chat.test.ts` (di akhir, describe baru):

```ts
describe("buildPolyglotStreamPrompt", () => {
  it("menghasilkan instructions teks polos tanpa JSON", () => {
    const history = [{ role: "assistant" as const, content: "Hi there!" }];
    const { instructions, messages } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", history);
    expect(instructions).toContain("Restaurant");
    expect(instructions).toContain("TANPA JSON");
    expect(instructions).not.toContain("suggested_replies");
    expect(messages).toEqual([
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "Hello" },
    ]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL — `buildPolyglotStreamPrompt is not a function`.

- [ ] **Step 3: Implementasi**

Di `lib/ai-content/chat.ts`, tambah di akhir file:

```ts
export function buildPolyglotStreamPrompt(
  userMessage: string,
  language: string,
  level: string,
  scenario: string,
  history: { role: "user" | "assistant"; content: string }[]
): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] } {
  return {
    instructions: [
      `Anda adalah tutor bahasa AI. Target bahasa: ${language}. Level CEFR user: ${level}. Skenario: ${scenario}.`,
      `Anda sedang bermain peran dalam skenario '${scenario}' sebagai penutur asli yang ramah.`,
      "",
      `Balas pesan user dengan percakapan natural dalam bahasa ${language} — 2-4 kalimat, tetap dalam karakter skenario, akhiri dengan satu pertanyaan agar percakapan berlanjut.`,
      "",
      "Aturan:",
      `- Balas TANPA JSON, tanpa markdown, tanpa label — hanya teks polos dalam bahasa ${language}.`,
      "- JANGAN tambahkan teks apa pun di luar balasan.",
    ].join("\n"),
    messages: [...history, { role: "user", content: userMessage }],
  };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run lib/ai-content/chat.test.ts lib/ai-content/parse.test.ts`
Expected: PASS (semua test chat + parse hijau).

- [ ] **Step 5: Commit**

```bash
git add lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: buildPolyglotStreamPrompt (balasan teks polos untuk streaming)"
```

---

### Task 3: Route `app/api/chat/route.ts`

**Files:**
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `getSession()` (`lib/auth.ts`), `db` (`lib/db.ts`), `model` (`lib/ai.ts`), `streamText` + `toTextStreamResponse` dari `ai`, `buildPolyglotStreamPrompt` (Task 2).
- Produces: `POST /api/chat` — request `{ sessionId: string; text: string }`; response stream teks AI (text/plain event stream dari `toTextStreamResponse`); error JSON `{ error: string }` dengan status 400/401/403. Dipakai Task 5 (ChatView fetch).

- [ ] **Step 1: Implementasi route**

Create `app/api/chat/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { model } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPolyglotStreamPrompt } from "@/lib/ai-content/chat";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  }

  let body: { sessionId?: string; text?: string };
  try {
    body = (await req.json()) as { sessionId?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const userMessage = body.text?.trim() ?? "";
  if (!userMessage) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 401 });
  }

  const dbSession = await db.session.findFirst({
    where: { id: body.sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!dbSession) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";

  const history = await db.message.findMany({
    where: { sessionId: dbSession.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = history
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "ai" ? (m.analysisJson ? (m.analysisJson as unknown as { reply_in_target_language?: string }).reply_in_target_language : m.content) ?? "" : m.content ?? "",
    }))
    .filter((m) => m.content.trim() !== "");

  const { instructions, messages } = buildPolyglotStreamPrompt(userMessage, language, "A1", scenario, aiMessages);

  await db.message.create({
    data: { sessionId: dbSession.id, role: "user", content: userMessage },
  });

  const result = streamText({
    model,
    instructions,
    messages,
    maxOutputTokens: 1024,
    temperature: 0.7,
  });
  return result.toTextStreamResponse();
}
```

Catatan: mapping history identik dengan `sendPolyglotMessageAction`; pesan user dipersist SEBELUM stream; route tidak persist AI message.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: route streaming POST /api/chat (streamText + persist pesan user)"
```

---

### Task 4: `analyzeChatMessageAction` di `lib/actions/chat.ts`

**Files:**
- Modify: `lib/actions/chat.ts`

**Interfaces:**
- Consumes: `generateText`/`model`, `buildPolyglotUserMessage`, `parseAiJson`, `getSession`, `db`, `PolyglotAnalysis` (semua sudah ada di file).
- Produces: `AnalyzeResult { messageId: string; analysis: PolyglotAnalysis }`; `analyzeChatMessageAction(sessionId: string, userMessage: string, streamedReply: string): Promise<AnalyzeResult | { error: string }>` — dipakai Task 5.

- [ ] **Step 1: Implementasi**

Tambahkan di akhir `lib/actions/chat.ts`:

```ts
export interface AnalyzeResult {
  messageId: string;
  analysis: PolyglotAnalysis;
}

export async function analyzeChatMessageAction(
  sessionId: string,
  userMessage: string,
  streamedReply: string
): Promise<AnalyzeResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!streamedReply.trim()) return { error: "Balasan kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!dbSession) return { error: "Akses ditolak." };

  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";

  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = history
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "ai" ? (m.analysisJson ? (m.analysisJson as unknown as { reply_in_target_language?: string }).reply_in_target_language : m.content) ?? "" : m.content ?? "",
    }))
    .filter((m) => m.content.trim() !== "");
  if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user") {
    aiMessages.pop();
  }

  const level = "A1";
  const { instructions, messages } = buildPolyglotUserMessage(userMessage.trim(), language, level, scenario, aiMessages);

  let text: string;
  try {
    const result = await generateText({ model, instructions, messages, maxOutputTokens: 4096, temperature: 0.7 });
    text = result.text.trim();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghasilkan balasan AI." };
  }

  const analysis = parseAiJson<PolyglotAnalysis>(text);
  if (!analysis || !analysis.reply_in_target_language) {
    return { error: "AI mengembalikan respons tidak valid. Silakan coba lagi." };
  }

  const aiMsg = await db.message.create({
    data: {
      sessionId,
      role: "ai",
      content: streamedReply.trim(),
      analysisJson: analysis as never,
    },
  });

  return { messageId: aiMsg.id, analysis };
}
```

Catatan: trailing user message di-pop dari history mapping karena route sudah mempersist pesan user (hindari duplikasi di prompt); `buildPolyglotUserMessage` menambahkannya lagi.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses; vitest tetap hijau.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/chat.ts
git commit -m "feat: analyzeChatMessageAction (analisis JSON menyusul stream)"
```

---

### Task 5: UI streaming ChatView

**Files:**
- Modify: `components/ChatView.tsx`

**Interfaces:**
- Consumes: route `POST /api/chat` (Task 3), `analyzeChatMessageAction` (Task 4), `TooltipProvider` (Task 1).
- Produces: chat teks streaming + tombol Stop + fase analisis; `sendPolyglotMessageAction` tidak lagi dipanggil oleh ChatView (tetap dipakai VoiceChatView).

- [ ] **Step 1: State & imports**

Tambah ke imports lucide: `Square` (ikon Stop). Tambah state:

```tsx
const [streaming, setStreaming] = useState(false);
const [streamingText, setStreamingText] = useState("");
const [analyzing, setAnalyzing] = useState(false);
const abortRef = useRef<AbortController | null>(null);
```

Import `useRef` dari react (ganti `import { useEffect, useState } from "react";` → tambah `useRef`). Import `analyzeChatMessageAction` dari `@/lib/actions/chat`. Hapus import `sendPolyglotMessageAction` dari ChatView (tidak dipakai lagi di file ini — VoiceChatView yang memakai).

- [ ] **Step 2: Ganti `send` dengan alur streaming**

Ganti seluruh fungsi `send` (dan hapus state `sending` yang lama bila tidak terpakai — cek pemakaian `sending` di render; ganti guard dengan `streaming || analyzing`):

```tsx
async function send(textOverride?: string) {
  if (!sessionId || streaming || analyzing) return;
  const text = (textOverride ?? input).trim();
  if (!text) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.error("Tidak ada koneksi internet. Coba lagi.");
    return;
  }
  setInput("");
  setSuggestions([]);
  setError(null);
  setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);

  const controller = new AbortController();
  abortRef.current = controller;
  setStreaming(true);
  setStreamingText("");
  let acc = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let msg = "Gagal mengirim pesan.";
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) msg = data.error;
      } catch {}
      setError(msg);
      setStreaming(false);
      return;
    }
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamingText(acc);
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // teks parsial tetap diproses
    } else {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      setStreaming(false);
      setStreamingText("");
      return;
    }
  } finally {
    setStreaming(false);
  }

  setAnalyzing(true);
  try {
    const res = await analyzeChatMessageAction(sessionId, text, acc);
    if ("error" in res) {
      toast.error(res.error);
      setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: acc }]);
      return;
    }
    setSuggestions(res.analysis.suggested_replies ?? []);
    setMessages((m) => [
      ...m,
      {
        id: res.messageId,
        role: "ai",
        content: acc,
        analysis: res.analysis,
        translation: res.analysis.reply_translation_in_indonesian,
        expanded: false,
      },
    ]);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Gagal menganalisis.");
    setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: acc }]);
  } finally {
    setAnalyzing(false);
    setStreamingText("");
    abortRef.current = null;
  }
}
```

Tambahkan cleanup unmount (setelah fungsi-fungsi lain, sebelum return):

```tsx
useEffect(() => {
  return () => {
    abortRef.current?.abort();
  };
}, []);
```

- [ ] **Step 3: Render — bubble streaming + Stop + fase analisis**

Di area pesan, setelah blok `{sending && (...)}` (hapus blok sending lama), tambahkan:

```tsx
{streaming && (
  <div className="flex justify-start gap-2.5">
    <Avatar className="h-8 w-8 shrink-0 border border-border bg-secondary text-primary">
      <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
    </Avatar>
    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border text-sm whitespace-pre-wrap">
      {streamingText}
      <span className="animate-pulse">▌</span>
    </div>
  </div>
)}
{analyzing && (
  <div className="flex justify-start gap-2">
    <Avatar className="h-8 w-8 shrink-0 border border-border bg-muted">
      <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
    </Avatar>
    <div className="max-w-[85%] space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32" />
      <p className="text-[11px] text-muted-foreground pt-1">AI Tutor menganalisis...</p>
    </div>
  </div>
)}
```

Tombol Stop menggantikan tombol Kirim saat streaming (di form input bawah):

```tsx
{streaming ? (
  <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
    <Square className="h-4 w-4 mr-1" /> Stop
  </Button>
) : (
  <Button type="button" onClick={() => send()} disabled={!input.trim() || analyzing}>
    <Send className="h-4 w-4 mr-1" />
    Kirim
  </Button>
)}
```

Input: `disabled={streaming || analyzing}`; placeholder tetap. Chip saran: tambah guard `!streaming && !analyzing` pada kondisi render chips (ganti `!sending`). Header tombol "Akhiri Sesi": `disabled={streaming || analyzing}`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: semua sukses. Cek tidak ada sisa referensi `sending` di ChatView (grep: `sending` → 0 hasil).

- [ ] **Step 5: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: chat streaming kata per kata + tombol Stop + analisis menyusul"
```

---

## Verifikasi akhir (setelah semua task)

- `npm test` — semua vitest hijau (stream prompt + existing).
- `npx tsc --noEmit && npm run lint && npm run build` — sukses.
- Manual (browser): kirim pesan → teks stream kata per kata; tombol Stop di tengah → teks parsial tersimpan + kartu analisis muncul; refresh saat streaming (pesan user tersimpan); offline → toast "Tidak ada koneksi internet. Coba lagi."; error Tooltip hilang; voice chat tetap berfungsi (non-streaming).
