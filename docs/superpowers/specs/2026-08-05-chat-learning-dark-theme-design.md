# Design: Chat Learning Helpers + Dark Theme Lengkap

Tanggal: 2026-08-05
Status: Disetujui user (revisi 1 — tambah pembuka percakapan AI)

## Ringkasan

Lima permintaan user untuk aplikasi Polyglot AI Chat & Voice Tutor:

1. Semua fitur bertema dark (menuntaskan sisa titik terang).
2. Tombol "Akhiri Sesi" di chat — keluar percakapan + reset memori AI.
3. Saran jawaban dari AI — chip saran tiap balasan AI.
4. Tombol "Lihat Penjelasan" — kartu analisis bahasa dibuat terlipat default.
5. AI membuka percakapan dulu saat skenario dipilih (pembuka konteks + pertanyaan).

## 1. Dark theme lengkap

Token sudah dark-only di `app/globals.css` (`:root` = nilai dark). Perbaiki 4 titik terang:

| File | Baris | Sebelum | Sesudah |
|---|---|---|---|
| `app/(app)/layout.tsx` | 9 | `bg-slate-50 text-slate-900` | `bg-background text-foreground` |
| `app/(auth)/verify-email/page.tsx` | 15 | `bg-white ... border-slate-200` | `bg-card ... border-border` (teks `text-slate-500` → `text-muted-foreground`, `text-teal-600` → `text-primary`) |
| `app/not-found.tsx` | 5-8 | `bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50`, `text-slate-300 dark:text-slate-700`, `text-slate-500 dark:text-slate-400` | token (`bg-background text-foreground`, `text-muted-foreground` dst.) |
| `app/(app)/error.tsx` | 7 | `text-slate-500 dark:text-slate-400` | `text-muted-foreground` |

Tidak ada toggle — konsisten dengan komit HEAD `9dd65b9` ("dark theme penuh (tanpa toggle)").

## 2. Akhiri Sesi (reset memori AI)

### Skema DB

Tambah kolom nullable `endedAt DateTime? @map("ended_at")` pada model `Session` (`prisma/schema.prisma:56-67`).

Migration manual mengikuti pola existing (`prisma/migrations/<timestamp>_<name>/migration.sql`):

```sql
ALTER TABLE "chat_sessions" ADD COLUMN "ended_at" TIMESTAMP(3);
```

Nama folder: `<timestamp>_add_session_ended_at`. Diterapkan saat deploy via `vercel-build.mjs` (`migrate deploy`); `npx prisma db:generate` untuk regenerasi client.

### Logika

- `lib/actions/chat.ts` `getOrCreateSession` (baris 36-38): tambah filter `endedAt: null` — hanya memakai ulang sesi aktif; sesi yang sudah diakhiri → buat sesi baru (AI mulai fresh).
- Action baru `endChatSessionAction(sessionId: string)`: `getSession()` guard ("Sesi berakhir. Silakan login kembali."), `db.session.update({ where: { id }, data: { endedAt: new Date() } })`. Gagal → `{ error }` (string error Indonesia).
- Saat "Ganti Skenario" dipanggil tanpa akhiri sesi, sesi lama tetap aktif (tidak diubah).

### UI (`components/ChatView.tsx`)

- ChatView saat ini tidak menyimpan `sessionId` (hasil `sendPolyglotMessageAction` diabaikan). Tambah state `const [sessionId, setSessionId] = useState<string | null>(null)`; di-set dari `res.sessionId` pada send pertama (baris 112-114).
- Header chat (dekat tombol "Ganti Skenario", baris 155-189): tambah tombol `Akhiri Sesi` (varian outline/destructive-ghost, ikon `LogOut` dari lucide). Klik → langsung aksi + toast `Sesi diakhiri. Percakapan baru dimulai saat memilih skenario.` Setelah sukses: kembali ke phase `picker` (reset state messages/language/scenario/sessionId).
- Jika belum ada sesi (user belum pernah kirim pesan, `sessionId` null) → tidak perlu panggil action, langsung kembali ke picker.

Error dari action → toast error, tetap di chat.

## 3. Saran jawaban AI

### Skema JSON analisis

Tambah field pada `PolyglotAnalysis` (`lib/actions/chat.ts:11-23`) dan prompt (`lib/ai-content/chat.ts`):

```json
"suggested_replies": ["string 1", "string 2", "string 3"]
```

Aturan prompt baru:
- 2-3 kalimat singkat (maks ~12 kata) dalam bahasa target, wajar diucapkan USER sebagai lanjutan percakapan.
- Bervariasi (beda struktur kalimat, mis. 1 pertanyaan + 1 pernyataan/persetujuan).
- Tidak wajib jika percakapan baru mulai? — Tetap wajib isi 2-3 (kecuali tidak mungkin, fallback array kosong).

### Interface & fallback

- `PolyglotAnalysis.suggested_replies?: string[]` (opsional — JSON lama/terpotong tidak menggagalkan parse; `parseAiJson` tidak berubah).
- UI hanya merender chip jika `Array.isArray` dan length > 0.

### UI

Di atas input (baris 284): saat `sending` false dan pesan AI terakhir punya `suggested_replies` non-empty, tampilkan baris chip:

- Chip = `Button variant="outline" size="sm"` dengan teks saran + terjemahan kecil? — Terjemahan tidak diwajibkan (berantakan); tampilkan teks bahasa target saja, judul kecil "Saran jawaban:".
- Klik chip → jalankan flow `send()` dengan teks chip (pesan langsung dikirim, chip mengikuti balasan AI berikutnya).
- Setelah user mengetik sendiri, chip pesan AI lama disembunyikan (hanya chip dari pesan AI terakhir yang belum dijawab). Simplifikasi: simpan `suggestions` di state; di-clear saat user kirim pesan (manual atau chip).

State baru: `const [suggestions, setSuggestions] = useState<string[]>([])`. Di-set dari `res.analysis.suggested_replies` setelah kirim; di-clear di awal `send()`.

### VoiceChatView

Tidak diubah — UX suara berbeda.

## 4. Tombol Lihat Penjelasan

Murni UI client-side, tanpa perubahan AI/DB:

- Setiap pesan AI: kartu "Analisis Bahasa" (baris 202-248) dibungkus dengan state per pesan `expanded: boolean` (default `false`).
- Tombol toggle di area pesan AI: teks `Lihat Penjelasan` / `Tutup Penjelasan` + ikon chevron (`ChevronDown`/`ChevronUp` dari lucide), varian ghost/outline kecil.
- Saat terlipat: hanya tampil balasan AI + terjemahan + tombol.
- Saat terbuka: kartu analisis seperti sekarang.
- State per pesan: `Record<string, boolean>` di ChatView (key = message id), atau field pada object Message. Dipilih: field `expanded` pada interface Message (lebih sederhana, tidak perlu Map).

## 5. Pembuka percakapan AI (saat skenario dipilih)

### Action baru (`lib/actions/chat.ts`)

`openSessionAction(scenario: string, language: string)`:

1. `getSession()` guard — "Sesi berakhir. Silakan login kembali."
2. `getOrCreateSession(email, language, scenario)` (fungsi sama dengan send, filter `endedAt: null`).
3. Cek `db.message.count({ where: { sessionId } })` — jika sesi sudah punya pesan → return `{ alreadyStarted: true }` (tidak generate ulang; ChatView masuk chat kosong seperti perilaku sekarang).
4. Generate pembuka: `generateText` dengan prompt baru `buildPolyglotOpeningPrompt(language, level, scenario)` di `lib/ai-content/chat.ts`, output JSON diparse `parseAiJson`:
   ```json
   {
     "reply_in_target_language": "string (2-4 kalimat bahasa target, dalam karakter skenario, akhiri dengan pertanyaan)",
     "reply_translation_in_indonesian": "string",
     "suggested_replies": ["string 1", "string 2", "string 3"]
   }
   ```
   (sama-sama memakai `generateText` + `parseAiJson`, tanpa kartu analisis — tidak ada teks user untuk dikoreksi).
5. Simpan `db.message.create({ sessionId, role: "ai", content: reply })` (tanpa `analysisJson`).
6. Return `{ sessionId, messageId, reply, translation, suggestedReplies }`.

### UI (`components/ChatView.tsx`)

- `startChat` menjadi async: set phase chat + state `opening` (skeleton pembuka — reuse pola skeleton `sending` baris 268-279), panggil `openSessionAction`:
  - Sukses → append pesan AI biasa (tanpa analisis) + `setSuggestions(suggestedReplies)` → chip saran langsung tampil untuk menjawab pembuka.
  - `alreadyStarted` → masuk chat kosong, tanpa pemanggilan AI.
  - Error → toast error, chat tetap terbuka kosong (user tetap bisa mengetik).
- `sessionId` di-set dari hasil `openSessionAction` (atau dari send jika `alreadyStarted` dan belum ada — dipakai tombol "Akhiri Sesi").
- Bubble pembuka dirender seperti pesan AI tanpa kartu analisis: avatar Bot + teks + `SpeakButton` + terjemahan italic. Tombol "Lihat Penjelasan" tidak tampil (tidak ada analisis).

### Catatan

- "Ganti Skenario" → `startChat` lagi → pembuka baru untuk skenario tersebut (sesi per skenario berbeda via key `getOrCreateSession`).
- Biaya: 1 panggilan AI ekstra per sesi baru (hanya saat sesi belum punya pesan) — layak untuk kesan pertama.

## Error handling & batasan

- String error lama dipertahankan (Indonesia): "Sesi berakhir. Silakan login kembali.", "Pesan tidak boleh kosong.", "AI mengembalikan respons tidak valid. Silakan coba lagi."
- `endChatSessionAction` error → toast, tidak force keluar dari chat.
- `suggested_replies` invalid/terpotong → chip tidak dirender, pesan tetap tampil normal.
- `openSessionAction` gagal generate → toast error, chat tetap terbuka kosong (bukan blocker).

## Testing & verifikasi

- `npm test` (vitest): test existing `lib/ai-content/parse.test.ts` tetap hijau; tambah test pure untuk `buildPolyglotSystemPrompt` & `buildPolyglotOpeningPrompt` — assert teks berisi `suggested_replies` (contoh skema JSON).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `npm run db:generate` (migration tidak perlu diterapkan lokal jika DB terblokir — file SQL diverifikasi manual; deploy via Vercel menjalankan `migrate deploy`).
- Manual: pilih skenario → AI menyapa duluan + chip saran → klik chip → balasan + chip baru; Akhiri Sesi → kembali ke picker → masuk lagi skenario sama → AI tidak ingat percakapan lama; pilih skenario lain → pembuka baru; halaman auth/404/error tampil dark.

## File yang berubah

- `app/(app)/layout.tsx` (dark)
- `app/(auth)/verify-email/page.tsx` (dark)
- `app/not-found.tsx` (dark)
- `app/(app)/error.tsx` (dark)
- `prisma/schema.prisma` (+ `endedAt` pada Session)
- `prisma/migrations/<timestamp>_add_session_ended_at/migration.sql` (baru)
- `lib/actions/chat.ts` (+ `endedAt` filter, `endChatSessionAction`, `openSessionAction`, `suggested_replies` di interface)
- `lib/ai-content/chat.ts` (+ instruksi `suggested_replies` di prompt; + `buildPolyglotOpeningPrompt` baru)
- `lib/ai-content/chat.test.ts` (baru, assertion prompt)
- `components/ChatView.tsx` (Akhiri Sesi, chip saran, Lihat Penjelasan, pembuka AI)
