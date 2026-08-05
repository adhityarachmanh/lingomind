# Design: Skenario DB + Riwayat Chat + URL Session + Responsive + PWA

Tanggal: 2026-08-05
Status: Disetujui user (5 bagian)

## Ringkasan

Overhaul pengalaman chat Polyglot Tutor:

1. **Skenario tersimpan di DB** — saat login pertama daftar skenario kosong, user membuat sendiri dari perpustakaan template (40-50 template, kategori, judul/deskripsi bisa diedit).
2. **Sesi chat di URL** — `/chat?session=<id>`; refresh tetap di chat yang sama (pesan dimuat dari DB).
3. **Riwayat chat per user** — daftar di halaman `/chat` (preview pesan terakhir, tanggal, hapus per sesi + hapus semua); klik sesi lama → lanjutkan percakapan.
4. **Responsive** — nyaman di HP (fullscreen, back button, safe-area) dan desktop (dua panel: sidebar skenario+riwayat di kiri, chat di kanan).
5. **PWA** — installable + offline shell (manifest lengkap, ikon PNG, service worker manual).
6. Voice chat disatukan dengan sistem skenario + riwayat.

## 1. Model data & template

### Tabel baru `Scenario` (`@@map("scenarios")`)

```prisma
model Scenario {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  description String
  language    String
  templateId  String?
  createdAt   DateTime @default(now())
  sessions    Session[]

  @@map("scenarios")
}
```

- `User` mendapat relasi `scenarios Scenario[]`.
- Satu sesi aktif per skenario (dedup `getOrCreateSession` bergeser ke `scenarioId`).

### `Session` — tambah `scenarioId`

```prisma
model Session {
  ...
  scenarioId String?  @map("scenario_id")
  scenario   Scenario? @relation(fields: [scenarioId], references: [id], onDelete: SetNull)
  ...
}
```

- Kolom lama `scenario`/`language` dipertahankan; baris lama tanpa `scenarioId` (data test dev) **diabaikan** dari riwayat — tanpa backfill, tanpa hapus (tidak destruktif).
- Migration manual: `prisma/migrations/<timestamp>_add_scenarios/migration.sql`:
  - `CREATE TABLE "scenarios" (...)` sesuai skema
  - `ALTER TABLE "chat_sessions" ADD COLUMN "scenario_id" TEXT;` + FK `REFERENCES "scenarios"("id") ON DELETE SET NULL` + index
- Baru dibuat via `openSessionAction` dengan `scenarioId`.

### Perpustakaan template — `lib/templates.ts` (baru)

```ts
export interface ScenarioTemplate {
  id: string;          // slug unik, mis. "restaurant-order"
  category: string;    // mis. "Makanan & Minuman"
  title: string;
  description: string;
}
export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [ ... ];
```

- 40-50 template, dikelompokkan kategori: Pekerjaan & Bisnis, Perjalanan, Makanan & Minuman, Belanja & Layanan, Kesehatan, Sosial & Pertemanan, Teknologi, Percakapan Sehari-hari.
- Language-agnostic (bahasa dipilih user saat membuat skenario).
- Pure constant → diuji vitest (`lib/templates.test.ts`): jumlah ≥ 40, `id` unik, `category` non-kosong, `title`/`description` non-kosong.

## 2. Server actions

File: `lib/actions/chat.ts` (refactor + baru) dan `lib/actions/scenario.ts` (baru — aksi skenario). Semua guard `getSession()` → `"Sesi berakhir. Silakan login kembali."`, resolve `userId` dari email (pola existing), error string Indonesia verbatim.

### Baru

- `createScenarioAction(input: { templateId?: string; title: string; description: string; language: string })` — validasi: `title` wajib non-kosong (`"Judul skenario wajib diisi."`), `language` harus ada di daftar bahasa. Bila `templateId` diberikan, judul/deskripsi awal diambil dari template (tetap bisa diedit client). Return `{ scenarioId }`.
- `getChatHomeAction()` → `{ scenarios: ScenarioSummary[], history: SessionSummary[] }`:
  - `ScenarioSummary`: `{ id, title, description, language, createdAt, lastActivityAt (dari sesi terbaru skenario), hasActiveSession }`
  - `SessionSummary`: `{ id, scenarioTitle, language, lastMessagePreview, messageCount, updatedAt, active }` — semua sesi user yang punya `scenarioId != null`, terbaru dulu; `lastMessagePreview` = `trimPreview(isi pesan terakhir)` (pure, `lib/chat-utils.ts`, potong 60 karakter, `"..."` di akhir, hapus newline).
- `getSessionMessagesAction(sessionId)` → verifikasi kepemilikan; return `{ session: { id, scenarioTitle, language, active }, messages: Message[] }` — `Message` = `{ id, role, content, analysisJson?, createdAt }` (untuk re-render kartu analisis).
- `resumeSessionAction(sessionId)` → verifikasi kepemilikan; `db.session.update({ endedAt: null })`; return `{ ok }`.
- `deleteSessionAction(sessionId)` → verifikasi kepemilikan; `db.session.delete` (messages cascade).
- `clearChatHistoryAction()` → `db.session.deleteMany({ where: { userId, scenarioId: { not: null } } })` (messages cascade); skenario tetap.

### Diubah

- `openSessionAction(scenarioId: string, language: string)` — argumen `scenario` string → `scenarioId`; `getOrCreateSession` mencari sesi aktif `{ userId, scenarioId, endedAt: null }`, membuat baru bila tidak ada (dengan `scenarioId`, `language` dari skenario). Pembuka AI tetap (tanpa perubahan prompt).
- `sendPolyglotMessageAction(sessionId: string, userMessage: string)` — argumen `(scenario, language, text)` → `(sessionId, text)`; verifikasi kepemilikan sesi; riwayat 20 pesan terakhir tetap; tidak lagi memanggil `getOrCreateSession`.
- `endChatSessionAction(sessionId)` — tetap (set `endedAt`), tidak berubah.
- `saveFlashcardAction` / `getFlashcardsAction` — tidak berubah.

## 3. Routing & UI

### `/chat` (home) — `ChatHomeView` (client component baru)

- Load `getChatHomeAction()` saat mount.
- **Grid skenario** (kartu: judul, deskripsi, badge bahasa, badge "Aktif" bila `hasActiveSession`, preview aktivitas terakhir) + tombol **"Buat Skenario"**.
- **Dialog Buat Skenario** (`ScenarioCreateDialog`): langkah 1 pilih bahasa (Select), langkah 2 pilih template dari perpustakaan (grid per kategori, klik = pilih), preview; form judul + deskripsi terisi dari template (bisa diedit, mode "tanpa template" juga tersedia — judul/deskripsi kosong); "Simpan" → `createScenarioAction` → refresh list.
- **Riwayat Percakapan**: daftar `SessionSummary` (judul skenario, preview, jumlah pesan, tanggal relatif, badge "Aktif"), tombol trash per baris (`deleteSessionAction`, konfirmasi), tombol **"Hapus Semua Riwayat"** (`clearChatHistoryAction`, dialog konfirmasi).
- Klik skenario → `openSessionAction(scenarioId, language)` → `router.push("/chat?session=<id>")`.
- Klik riwayat → jika diakhiri `resumeSessionAction(id)` → `router.push("/chat?session=<id>")`.
- Pesan kosong: "Belum ada riwayat percakapan."

### `/chat?session=<id>` — `ChatView` diubah

- Baca param via `useSearchParams` (dibungkus `Suspense` di page — Next 16 requirement untuk CSR bailout).
- Mount: `getSessionMessagesAction(id)` → render pesan dari DB (termasuk kartu analisis + tombol Lihat Penjelasan); id invalid/bukan milik user → `router.replace("/chat")` + toast.
- Tanpa param → redirect `/chat`.
- Header: tombol kembali (`ArrowLeft`, `router.push("/chat")`, ikut tampil di desktop bila viewport sempit), judul = judul skenario, tombol "Akhiri Sesi" (→ kembali `/chat`).
- Send: `sendPolyglotMessageAction(sessionId, text)` — `sessionId` dari URL.
- Setelah kirim pesan pertama ke sesi lama yang baru di-resume: `endedAt` sudah null (resume di home).

### Desktop dua panel (`lg+`)

- `ChatView` (saat `?session=` ada): sidebar kiri `hidden lg:block w-80 border-r` berisi komponen list skenario + riwayat (komponen dibagikan dengan home: `ChatSidebar`), chat di kanan (`flex-1`).
- `/chat` home: pada `lg+` tetap halaman penuh (list saja) — sidebar hanya di tampilan sesi.
- Navigasi di sidebar ke sesi lain → `router.push("/chat?session=<id>")` (desktop tidak ganti halaman yang terasa — URL berubah, konten chat dimuat ulang).

### Voice chat unified

- Picker `/voice-chat` memakai grid skenario user (komponen skenario dibagikan: `ScenarioGrid` menjadi shared component menerima `ScenarioSummary[]`).
- Pilih skenario → `openSessionAction` → `/voice-chat?session=<id>`.
- `VoiceChatView` menerima `sessionId` (dari URL); mic → `sendPolyglotMessageAction(sessionId, text)`; TTS tetap.
- "Hang Up" → kembali `/voice-chat` (sesi tidak diakhiri).
- Sesi voice chat tampil di riwayat `/chat` yang sama.

### Responsive

- `app/layout.tsx`: tambah `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }`.
- Input chat: `pb-[env(safe-area-inset-bottom)]` + container `pt-[env(safe-area-inset-top)]` untuk HP ber-notch.
- Mobile: header chat sticky, back button selalu ada; grid skenario `grid-cols-2` (mobile) → `sm:grid-cols-3` → `lg:grid-cols-4`.
- Riwayat: baris penuh dengan aksi di kanan; tombol hapus cukup tap.
- Tidak ada drawer/bottom-nav baru — navigasi cukup via tombol kembali.

## 4. PWA (installable + offline shell)

- **Ikon**: script `scripts/generate-icons.mjs` (devDependency `sharp`) — baca `public/icon.svg`, hasil `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180). Script dijalankan sekali; hasil di-commit.
- **Manifest** (`app/manifest.ts`): `id: "/"`, `lang: "id"`, `scope: "/"`, `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` (dark tokens: `#161a20` / `#14b8a6`), icons 192/512 + maskable (`"purpose": "any maskable"`), `shortcuts` (Chat → `/chat`).
- **Service worker** `public/sw.js` (manual, tanpa dependency):
  - `CACHE_VERSION = "v1"` di awal file.
  - `install`: precache shell (`/`, `/chat`, `/voice-chat`, `/login`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/logo.png`); `self.skipWaiting()`.
  - `activate`: bersihkan cache lama; `clients.claim()`.
  - `fetch`: navigasi → network-first dengan fallback cache (`/chat` sebagai offline page); `/_next/static/*` → stale-while-revalidate; ikon/font/gambar → cache-first; lainnya → network-only.
- **Registrasi** `components/pwa-register.ts` (client): daftar `/sw.js` saat `window.load`, `"use client"`; dipasang di `app/layout.tsx` (hanya production? tidak — daftar selalu; SW mengatur cache sendiri).
- **CSP** (`next.config.ts` headers): pastikan `worker-src 'self'` + `script-src 'self'` (SW registration inline tidak dipakai — file eksternal); tidak perlu mengubah `connect-src` (chat server-side via server actions).
- Offline: app shell terbuka; error chat saat offline → pesan ramah `"Tidak ada koneksi internet. Coba lagi."` (client-side catch di ChatView send — cek `navigator.onLine` sebelum panggil action).

## 5. Error handling, testing & fase

### Error handling

- Semua action: guard session + kepemilikan (`userId`) — error `"Akses ditolak."` bila bukan milik user.
- `getSessionMessagesAction`/`resumeSessionAction`/`deleteSessionAction` pada id yang bukan milik user → `{ error: "Akses ditolak." }`.
- Konfirmasi dialog sebelum `deleteSessionAction` & `clearChatHistoryAction`.
- URL session invalid → `router.replace("/chat")` + toast `"Percakapan tidak ditemukan."`.
- Offline → cek `navigator.onLine` di `send()` → toast `"Tidak ada koneksi internet. Coba lagi."`.

### Testing

- Vitest (pure): `lib/templates.test.ts` (≥ 40 template, id unik, field non-kosong); `lib/chat-utils.test.ts` (`trimPreview` potong 60 karakter, hapus newline, aman string pendek/null); existing `lib/ai-content/*.test.ts` tetap hijau.
- tsc + lint + build tiap fase; manual: HP (Chrome mobile, safe-area, install PWA) & desktop (dua panel).
- Migration: `npx prisma db:generate` + `migrate deploy` lokal (DB sudah bisa diakses).

### Fase implementasi

1. **Fase A — Data & Actions**: commit perbaikan pending (FK userId + `instructions` AI SDK v7), migration `add_scenarios`, `lib/templates.ts` + test, `lib/chat-utils.ts` + test, `lib/actions/scenario.ts`, refactor `lib/actions/chat.ts`.
2. **Fase B — Home & Chat UI**: `ChatHomeView`, dialog template, riwayat + clear, `ChatView` `?session=` + load pesan + back button + `Suspense` di page.
3. **Fase C — Desktop 2-panel + Voice chat unified**: `ChatSidebar` shared, layout lg+, `VoiceChatView`/`voice-chat` page pakai skenario user + `?session=`.
4. **Fase D — PWA**: `scripts/generate-icons.mjs` + ikon, manifest lengkap, `public/sw.js`, `components/pwa-register.ts`, CSP check.
5. **Fase E — Responsive polish**: viewport/safe-area, grid, review manual HP & desktop, perbaikan kecil.

## File yang berubah/baru

- `prisma/schema.prisma` (+ `Scenario`, `scenarioId` di Session, relasi User)
- `prisma/migrations/<timestamp>_add_scenarios/migration.sql` (baru)
- `lib/templates.ts` + `lib/templates.test.ts` (baru)
- `lib/chat-utils.ts` + `lib/chat-utils.test.ts` (baru, `trimPreview`)
- `lib/actions/scenario.ts` (baru: create/getChatHome/getSessionMessages/resume/delete/clear)
- `lib/actions/chat.ts` (refactor: openSessionAction(scenarioId), sendPolyglotMessageAction(sessionId, text))
- `components/ChatHomeView.tsx`, `components/ScenarioCreateDialog.tsx`, `components/ChatSidebar.tsx` (baru)
- `components/ChatView.tsx`, `components/VoiceChatView.tsx` (diubah)
- `app/(app)/chat/page.tsx`, `app/(app)/voice-chat/page.tsx` (diubah: Suspense + props)
- `app/manifest.ts` (diperluas)
- `public/sw.js`, `components/pwa-register.ts` (baru)
- `public/icons/*` (baru, hasil script)
- `scripts/generate-icons.mjs` (baru), `package.json` (+devDep sharp)
- `next.config.ts` (CSP worker-src bila perlu), `app/layout.tsx` (viewport + pwa-register)
