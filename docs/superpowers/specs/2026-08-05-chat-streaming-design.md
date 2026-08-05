# Design: Chat Streaming 2 Fase + Fix Tooltip

Tanggal: 2026-08-05
Status: Disetujui user (2 bagian)

## Ringkasan

1. **Streaming chat teks** — balasan AI ditampilkan kata per kata via route `POST /api/chat` (`streamText`), lalu analisis JSON menyusul via action `analyzeChatMessageAction` (2 panggilan AI per pesan). Voice chat tetap non-streaming.
2. **Fix error `Tooltip must be used within TooltipProvider`** — `ChatView` kehilangan wrapper `TooltipProvider` saat rewrite Task 7; `SpeakButton` (yang memakai Tooltip) melempar error tiap render pesan.
3. **Tombol Stop** — membatalkan stream (AbortController); teks parsial tetap disimpan sebagai balasan AI.

## 1. Fix Tooltip

`components/ChatView.tsx`: bungkus seluruh konten chat dengan `<TooltipProvider delayDuration={200}>` (import dari `@/components/ui/tooltip`). Tidak ada komponen lain yang memakai Tooltip (grep: hanya `SpeakButton.tsx:41-54`).

## 2. Route streaming — `app/api/chat/route.ts` (baru)

- `export const maxDuration = 60` (Vercel).
- `POST` flow:
  1. `getSession()` → null: 401 `{ error: "Sesi berakhir. Silakan login kembali." }`
  2. Parse body JSON (`sessionId`, `text`) → invalid: 400 `{ error: "Permintaan tidak valid." }`; `text` kosong: 400 `{ error: "Pesan tidak boleh kosong." }`
  3. Resolve `user.id` dari email → `{ error: "Pengguna tidak ditemukan." }` 401
  4. `db.session.findFirst({ id: sessionId, userId: user.id }, include scenario) ` → null: 403 `{ error: "Akses ditolak." }`
  5. `language`/`scenario` dari relasi (fallback `dbSession.language` / `"Percakapan"`)
  6. History 20 pesan (mapping sama dengan `sendPolyglotMessageAction`), push pesan user
  7. `buildPolyglotStreamPrompt(userMessage, language, "A1", scenario, aiMessages)` → `{ instructions, messages }`
  8. **Persist pesan user** (`db.message.create`, role user) SEBELUM stream — refresh mid-stream tetap menyimpan pesan user
  9. `streamText({ model, instructions, messages, maxOutputTokens: 1024, temperature: 0.7 })` → `result.toTextStreamResponse()`
- Route TIDAK mempersist AI message (client yang kirim ke action analisis; teks parsial/penuh sama-sama disimpan di sana).
- Abort: client abort → stream dibatalkan oleh SDK (request signal); teks parsial dikirim client ke `analyzeChatMessageAction`.
- CSP `connect-src 'self'` tidak masalah (same-origin).

## 3. Prompt stream — `buildPolyglotStreamPrompt` (lib/ai-content/chat.ts)

Signature konsisten dengan `buildPolyglotUserMessage`:

```ts
export function buildPolyglotStreamPrompt(
  userMessage: string,
  language: string,
  level: string,
  scenario: string,
  history: { role: "user" | "assistant"; content: string }[]
): { instructions: string; messages: { role: "user" | "assistant"; content: string }[] }
```

`instructions` (teks polos, TANPA JSON):

```
Anda adalah tutor bahasa AI. Target bahasa: {language}. Level CEFR user: {level}. Skenario: {scenario}.
Anda sedang bermain peran dalam skenario '{scenario}' sebagai penutur asli yang ramah.

Balas pesan user dengan percakapan natural dalam bahasa {language} — 2-4 kalimat, tetap dalam karakter skenario, akhiri dengan satu pertanyaan agar percakapan berlanjut.

Aturan:
- Balas TANPA JSON, tanpa markdown, tanpa label — hanya teks polos dalam bahasa {language}.
- JANGAN tambahkan teks apa pun di luar balasan.
```

`messages` = `[...history, { role: "user", content: userMessage }]`. Pure → diuji vitest (TDD): memuat "TANPA JSON", skenario title, dan riwayat + pesan user.

## 4. Action analisis — `analyzeChatMessageAction` (lib/actions/chat.ts)

```ts
export interface AnalyzeResult { messageId: string; analysis: PolyglotAnalysis; }
export async function analyzeChatMessageAction(
  sessionId: string,
  userMessage: string,
  streamedReply: string
): Promise<AnalyzeResult | { error: string }>
```

1. `getSession()` → `"Sesi berakhir. Silakan login kembali."`; `streamedReply` kosong → `{ error: "Balasan kosong." }`
2. Resolve user.id → `"Pengguna tidak ditemukan."`
3. `db.session.findFirst({ id: sessionId, userId: user.id }, include scenario)` → null: `{ error: "Akses ditolak." }`
4. History 20 pesan (pesan user sudah terpersist oleh route → mapping, lalu **buang trailing user message** bila ada agar tidak dobel), push `userMessage` → `buildPolyglotUserMessage` (pipeline analisis existing: generateText maxOutputTokens 4096 temp 0.7, parseAiJson, validasi → `"AI mengembalikan respons tidak valid. Silakan coba lagi."`)
5. `db.message.create({ sessionId, role: "ai", content: streamedReply, analysisJson: analysis })`
6. Return `{ messageId, analysis }`

## 5. UI ChatView — streaming + Stop

State baru: `streaming: boolean`, `streamingText: string`, `analyzing: boolean`, `abortRef = useRef<AbortController | null>(null)`.

`send(textOverride?)` (menggantikan panggilan `sendPolyglotMessageAction` untuk chat teks):
1. Guard existing (sessionId, streaming/analyzing, teks kosong) + offline toast
2. Clear suggestions, append bubble user optimistik
3. `setStreaming(true)`; `abortRef.current = new AbortController()`
4. `fetch("/api/chat", { method: "POST", headers, body: JSON.stringify({ sessionId, text }), signal })`; `!res.ok` → parse `{ error }` → toast/setError
5. Baca `res.body` reader, akumulasi `acc` (variabel lokal) + `setStreamingText(acc)` per chunk
6. Selesai normal → lanjut fase analisis dengan `acc`
7. `catch` AbortError (tombol Stop) → lanjut fase analisis dengan `acc` (teks parsial)
8. `catch` lain → toast + `setStreaming(false)` + `setStreamingText("")` (bubble user tetap)
9. Fase analisis: `setAnalyzing(true)` → `analyzeChatMessageAction(sessionId, text, acc)` → append AI message final `{ id: messageId, role: "ai", content: acc, analysis, translation: analysis.reply_translation_in_indonesian, expanded: false }` + `setSuggestions(analysis.suggested_replies ?? [])`; error → toast (AI message tetap dibuat server tanpa analisis — percakapan tidak hilang; client tampilkan bubble teks tanpa analisis); `finally setAnalyzing(false)`, `setStreaming(false)`, `setStreamingText("")`, `abortRef.current = null`

Render:
- Saat `streaming`: bubble Bot dengan `streamingText` + kursor berkedip (`<span className="animate-pulse">▌</span>`); tombol Kirim diganti tombol **Stop** (varian destructive, ikon Square) → `abortRef.current?.abort()`
- Saat `analyzing`: bubble skeleton + teks "AI menganalisis..."
- Input disabled saat `streaming || analyzing`
- Cleanup unmount: `useEffect(() => () => abortRef.current?.abort(), [])`
- `TooltipProvider` membungkus konten (Bagian 1)

`sendPolyglotMessageAction` TETAP ada — dipakai VoiceChatView (non-streaming).

## Error handling & batasan

- String error verbatim Indonesia; route error → client toast dari `{ error }`
- Pesan AI lama tanpa `analysisJson` tetap dirender normal (tidak berubah)
- Saran jawaban & kartu analisis muncul setelah stream selesai (bukan saat stream)
- Tidak ada tombol regenerate; voice chat tidak berubah
- Refresh saat streaming: pesan user tersimpan (route), AI message belum → riwayat menampilkan pesan user tanpa balasan (acceptable)

## Testing & verifikasi

- Vitest (TDD): `buildPolyglotStreamPrompt` — `instructions` memuat "TANPA JSON" + skenario; `messages` = history + user message; existing tests hijau
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`
- Manual: kirim pesan → teks stream kata per kata; Stop di tengah → teks parsial tersimpan + kartu analisis tetap muncul; refresh saat streaming; offline → toast

## File yang berubah

- `app/api/chat/route.ts` (baru)
- `lib/ai-content/chat.ts` (+ `buildPolyglotStreamPrompt`)
- `lib/ai-content/chat.test.ts` (+ test stream prompt)
- `lib/actions/chat.ts` (+ `analyzeChatMessageAction`, `AnalyzeResult`)
- `components/ChatView.tsx` (TooltipProvider, streaming UI, Stop, analyze phase)
