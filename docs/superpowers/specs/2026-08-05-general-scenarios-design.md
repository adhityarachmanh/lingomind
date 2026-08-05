# Design: Fix Romanisasi + Skenario Umum (Guru Matematika dll.)

Tanggal: 2026-08-05
Status: Disetujui user (4 bagian)

## Ringkasan

1. **Fix bug romanisasi**: romanisasi dari fase stream (yang cocok dengan teks tampil) di-override oleh romanisasi fase analisis (balasan berbeda) — teks Baca tidak cocok dengan isi chat. Fix: selalu pakai romanisasi stream.
2. **Skenario tipe "umum"**: scenario ber-tipe `general` untuk bantuan sehari-hari (Guru Matematika dll.) — percakapan Bahasa Indonesia, AI membalas dengan Markdown + rumus LaTeX (KaTeX), tanpa fase analisis bahasa.

## 1. Fix romanisasi

`lib/actions/chat.ts` `analyzeChatMessageAction`:

```ts
if (streamedRomanization && !analysis.reply_romanization) {
  analysis.reply_romanization = streamedRomanization;
}
```

→

```ts
if (streamedRomanization) {
  analysis.reply_romanization = streamedRomanization;
}
```

Romanisasi stream selalu cocok dengan teks yang ditampilkan (satu generasi); romanisasi analisis (dari balasan yang berbeda) tidak dipakai.

## 2. Model data

- Migration `prisma/migrations/20260805040000_add_scenario_type/migration.sql`:
  ```sql
  ALTER TABLE "scenarios" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'language';
  ```
- `prisma/schema.prisma` `Scenario` + `type String @default("language")`; `User.scenarios` tidak berubah.
- `ScenarioSummary` (`lib/actions/scenario.ts`) + `type: "language" | "general"`; `SessionDto` + `type` (dari `scenario.type`, fallback `"language"`); `getChatHomeAction` memuat type.
- Mode umum memakai `language = "Indonesian"` (internal): tambah `Indonesian: "id-ID"` ke `TTS_LANG_MAP` (`lib/languages.ts`) dan `Indonesian: "id"` ke `GOOGLE_TTS_TL` (`lib/tts.ts`). Indonesia TIDAK ditambah ke `LANGUAGES` (daftar belajar).

## 3. Template & dialog

- `lib/templates.ts`: `ScenarioTemplate` + `type: "language" | "general"`; semua template existing → `"language"`; template umum baru (kategori "Umum"):
  - `math-tutor` Guru Matematika — Diskusi rumus, cara cepat, dan latihan soal
  - `physics-tutor` Guru Fisika — Konsep fisika dan penyelesaian soal
  - `chemistry-tutor` Guru Kimia — Reaksi kimia dan perhitungan stoikiometri
  - `writing-assistant` Asisten Menulis — Membantu menyusun teks, email, atau laporan
  - `daily-discussion` Diskusi Sehari-hari — Ngobrol santai atau konsultasi keseharian
  - `interview-prep` Persiapan Interview Kerja — Latihan pertanyaan interview + umpan balik
  - `study-coach` Coach Belajar — Tips belajar efektif dan manajemen waktu
- `ScenarioCreateDialog`: toggle jenis **"Belajar Bahasa" / "Umum"**:
  - Mode bahasa: pilih bahasa + grid template bahasa (existing)
  - Mode umum: tanpa pilihan bahasa, grid template umum; judul/deskripsi editable
  - "Sudah ada": bahasa → `(templateId + language)` via `isTemplateUsed`; umum → `templateId` saja
- `createScenarioAction(input)`: + `type`; validasi server-side: umum → duplikat `(templateId)`; bahasa → `(templateId, language)`. `type` skenario = `input.type` (dari template bila kosong? — client selalu kirim; bila template dipilih, type = template.type)
- Kartu skenario (chat-lists `ScenarioCard`) + badge kecil "Umum" bila `general`
- `templates.test.ts`: update — field `type` ada, template umum ≥ 7, id unik tetap

## 4. AI mode umum

### Prompt (lib/ai-content/chat.ts)

`buildGeneralStreamPrompt(role: string, scenario: string, history: { role: "user" | "assistant"; content: string }[]): { instructions: string; messages }`:

```
Anda adalah {role} yang ramah dan komunikatif. Skenario: {scenario}.
Jawab dalam Bahasa Indonesia.
Gunakan Markdown untuk keterbacaan: judul (##), daftar (-), teks tebal, blok kode bila perlu.
Tulis rumus matematika dengan LaTeX: $...$ untuk inline, $$...$$ untuk blok.
Jelaskan langkah penyelesaian secara bertahap dan jelas.
Akhiri dengan satu pertanyaan lanjutan agar percakapan berlanjut.
JANGAN menambahkan teks di luar jawaban (tanpa JSON, tanpa markdown fence pembungkus).
```

`messages` = history + user message.

`buildGeneralOpeningPrompt(role: string, scenario: string): { instructions; messages }` — pembuka dalam Bahasa Indonesia sebagai role, markdown singkat, akhiri pertanyaan; `messages: [{ role: "user", content: "Mulai percakapan!" }]`.

### Route `app/api/chat/route.ts`

Branch berdasarkan `dbSession.scenario.type` (include `type: true` di select):
- `general` → `buildGeneralStreamPrompt(role, scenarioTitle, aiMessages)`; role dari `dbSession.scenario.description`? — role = judul skenario? Keputusan: role = `scenario.title` (mis. "Guru Matematika"), konteks = description bila ada: instruksi menyebutkan "Anda adalah tutor yang ahli dalam: {title} — {description}".
- `language` → existing `buildPolyglotStreamPrompt`.

Persist pesan user sebelum stream (tidak berubah).

### Client `ChatView`

- `SessionDto.type` → `const isGeneral = session?.type === "general"`.
- Mode umum:
  - Bubble AI + bubble streaming dirender markdown (`MarkdownContent`)
  - Tidak ada: fase analisis, kartu Analisis, Lihat Penjelasan, Baca/Arti, saran jawaban, tombol Simpan
  - Setelah stream selesai → `saveStreamedMessageAction(sessionId, replyText)` (tanpa `||ROM||` — prompt umum tanpa marker; `replyText = acc.trim()`) → append bubble final
  - `send()` mode umum: tanpa `analyzeChatMessageAction`; setelah save → suggestions kosong
- Mode bahasa: tidak berubah (plain text, analisis, romanisasi, saran).

### `MarkdownContent` (components/MarkdownContent.tsx, baru)

```tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
```

Render `{content}` dengan class prose-sederhana (dark-friendly: warna token, `break-words`); komponen `pre`/`code` diberi gaya card; `a` teal. Dipakai bubble AI & streaming (mode umum). CSS KaTeX di-import di komponen (atau layout — pilih komponen, CSS di-import di MarkdownContent).

### `saveStreamedMessageAction` (lib/actions/chat.ts)

```ts
export async function saveStreamedMessageAction(sessionId: string, content: string): Promise<{ messageId: string } | { error: string }>
```

Guard session/ownership (pola existing) → `db.message.create({ sessionId, role: "ai", content })` (tanpa analysisJson) → `{ messageId }`. Pesan kosong → `{ error: "Balasan kosong." }`.

### `openSessionAction` branch

- `general` → `buildGeneralOpeningPrompt(role, scenario.title)`; persist opener (analysisJson tidak diisi? Untuk general, simpan `analysisJson: null` — render markdown dari content; suggestions tidak ada). Return `OpenSessionResult` dengan `suggestedReplies: []`.
- Role untuk prompt: `scenario.title` + description.

## 5. Voice chat

`VoiceChatView` picker (`getChatHomeAction`) filter: hanya `type === "language"`. Mode umum belum didukung voice — dicatat sebagai pengembangan berikutnya.

## 6. Error handling & batasan

- `saveStreamedMessageAction` gagal → toast + bubble teks tetap tampil (state lokal) — percakapan tidak hilang; refresh tanpa pesan AI (acceptable, sama seperti stream gagal)
- String error Indonesia verbatim
- Mode umum tidak punya: analisis, saran, romanisasi, flashcard save, voice chat
- Backward compat: skenario lama → language; template lama → language; riwayat lama normal

## 7. Testing & verifikasi

- Vitest: `buildGeneralStreamPrompt` (memuat role, "Markdown", "LaTeX", "Bahasa Indonesia", tanpa "||ROM||"), `buildGeneralOpeningPrompt` (role + Bahasa Indonesia), `templates.test.ts` update (type field, ≥7 umum), existing hijau
- tsc + lint + build; manual: buat skenario Guru Matematika → tanya rumus → render KaTeX; mode bahasa tidak berubah; TTS Indonesia (`id-ID`) jalan untuk bubble umum

## File yang berubah

- `prisma/schema.prisma` (+ `Scenario.type`), `prisma/migrations/20260805040000_add_scenario_type/migration.sql` (baru)
- `lib/languages.ts` (+ Indonesian di TTS_LANG_MAP), `lib/tts.ts` (+ Indonesian di GOOGLE_TTS_TL)
- `lib/templates.ts` + `lib/templates.test.ts` (type + template umum)
- `lib/ai-content/chat.ts` + test (+ `buildGeneralStreamPrompt`, `buildGeneralOpeningPrompt`)
- `lib/actions/chat.ts` (fix override romanisasi; `saveStreamedMessageAction`; `openSessionAction` branch general)
- `lib/actions/scenario.ts` (type di `ScenarioSummary`/`SessionDto`; validasi duplikat umum; `getChatHomeAction`)
- `app/api/chat/route.ts` (branch prompt by type)
- `components/ChatView.tsx` (mode-aware: markdown render, tanpa analisis di general)
- `components/MarkdownContent.tsx` (baru)
- `components/ScenarioCreateDialog.tsx` (toggle jenis + grid umum + used-list)
- `components/chat-lists.tsx` (badge Umum di ScenarioCard)
- `components/VoiceChatView.tsx` (filter language)
- `package.json` (+ react-markdown, remark-math, rehype-katex, katex)
