# Validasi Duplikat Flashcard + Penanda "Tersimpan" di Chat

Tanggal: 2026-08-08
Status: Disetujui user

## Masalah

1. `saveFlashcardAction` (lib/actions/chat.ts:157) menyimpan flashcard **tanpa cek duplikat** — user bisa punya baris `frontText` sama berkali-kali.
2. `maybeAutoSaveVocab` (lib/actions/chat.ts:365) cek duplikat dengan **exact match tanpa filter bahasa** — kata sama di bahasa berbeda (mis. `cat` English vs `cat` French) dianggap duplikat padahal bukan.
3. Di chat, tombol "Simpan" pada kartu vocab_highlight tidak menunjukkan bahwa kata sudah pernah disimpan — user tidak tahu kata sudah ada di bank flashcard.

## Keputusan (dari brainstorming)

- **Definisi duplikat**: `frontText` case-insensitive per bahasa. `"Cat"` dan `"cat"` di bahasa sama = duplikat; `cat` di English vs `chat` di French = bukan duplikat.
- **Perilaku saat duplikat (manual)**: tolak insert + info (bukan error) — `alreadySaved: true` → client tampilkan `toast.info`.
- **Penanda di chat**: tombol berubah menjadi "Tersimpan" (ikon `BookmarkCheck`, disabled) bila kata ada di bank flashcard user (bahasa session).
- **Pendekatan**: server-side dedupe (tanpa migration) + Set kata tersimpan di state client. Unique index DB ditolak karena migration tidak bisa di-apply saat ini (DB diblokir Zscaler) dan frontText harus disimpan lowercase.

## Perubahan

### 1. Helper murni `lib/vocab.ts` (baru)

```ts
export function normalizeVocabWord(word: string): string
// trim().toLowerCase()
```

Test vitest `lib/vocab.test.ts`: trim, lowercase, kata Latin, kata non-Latin (tidak rusak), string kosong.

### 2. `lib/actions/chat.ts`

- **`saveFlashcardAction`** (chat.ts:157):
  - Sebelum `create`, cek duplikat: `db.flashcard.findFirst({ where: { userId, language, frontText: { equals: frontText, mode: "insensitive" } } })`.
  - Ada duplikat → **tidak insert**, return `{ message: "ok", alreadySaved: true }`.
  - Tidak ada → insert seperti sekarang, return `{ message: "ok", alreadySaved: false }`.
  - Type return: `ActionResult & { alreadySaved?: boolean }`.
- **`maybeAutoSaveVocab`** (chat.ts:365):
  - Ganti cek `findFirst({ userId, frontText: word })` menjadi cek case-insensitive + filter `language` (sama seperti di atas).
  - Return `boolean` — **true** bila kata ada di bank flashcard setelah pesan ini (baru disimpan ATAU sudah ada sebelumnya); **false** bila `vocab_highlight` tidak valid.
  - `sendPolyglotMessageAction` dan `analyzeChatMessageAction` menambahkan `vocabSaved?: boolean` ke hasil (dari `maybeAutoSaveVocab`) agar client bisa menandai kata hasil auto-save.
- **Action baru `getSavedVocabWordsAction(language: string)`** (diletakkan di `lib/actions/chat.ts`, di dekat `getFlashcardsAction`):
  - `getSession()` → user; `db.flashcard.findMany({ where: { userId, language }, select: { frontText: true } })`.
  - Return `{ words: string[] }` — frontText ternormalisasi via `normalizeVocabWord` (didedupe di client via Set).
  - Error session: `"Sesi berakhir. Silakan login kembali."` (string lama wajib dipertahankan).

### 3. `components/ChatView.tsx`

- State `savedVocabWords: Set<string>`; di-load saat mount (bersamaan load session) via `getSavedVocabWordsAction(session.language)`.
- `saveVocab` (ChatView.tsx:411): setelah `saveFlashcardAction` sukses — `alreadySaved` → `toast.info(`${word} sudah tersimpan.`)`; sukses baru → `toast.success` + tambah `normalizeVocabWord(word)` ke Set.
- Saat `analyzeChatMessageAction` / `sendPolyglotMessageAction` mengembalikan `vocabSaved: true` → tambahkan `normalizeVocabWord(word)` dari `analysis.vocab_highlight` ke Set.
- Tombol (ChatView.tsx:699-706): kata di Set → `BookmarkCheck` + label "Tersimpan" + `disabled`; belum ada → `Bookmark` + "Simpan".

## Di luar scope

- Migration / unique index DB (diblokir Zscaler; hardening di masa depan bila DB bisa diakses).
- VoiceChatView — tidak ada UI simpan vocab di sana.
- Merge/update `backText` saat duplikat (skip, tanpa update).
- Halaman flashcard lain (hanya chat yang punya aksi simpan).

## Testing

- `lib/vocab.test.ts` (helper murni) — jalankan `npm test`.
- Verifikasi manual: simpan kata sama dua kali (toast info + tombol Tersimpan), auto-save vocab menyala (mark muncul), kata berbeda bahasa tidak saling memblokir.
- Lint/typecheck: `npm run lint`, `npx tsc --noEmit`.
