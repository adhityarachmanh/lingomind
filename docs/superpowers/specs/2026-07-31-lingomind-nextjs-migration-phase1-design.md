# Migrasi LingoMind ke Next.js — Fase 1: Fondasi + Auth + Dashboard

Tanggal: 2026-07-31
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

LingoMind adalah aplikasi belajar bahasa (Dioxus 0.7.1 fullstack, Neon PostgreSQL via sqlx, Gemini AI, SMTP, cron). Aplikasi ini **live di production** dan akan dimigrasi bertahap ke Next.js + Prisma + NeonDB + TailwindCSS + Vercel AI SDK. Aplikasi Dioxus tetap berjalan di production selama transisi; kode lamanya disimpan sebagai referensi.

## Tujuan Fase 1

1. Memindahkan aplikasi Dioxus lama ke folder `dioxus/` sebagai referensi (production masih pakai kode lama selama fase ini).
2. Membuat proyek Next.js baru di root repo: App Router + TypeScript + Tailwind.
3. Prisma terhubung ke **database Neon yang sama** (introspect, bukan recreate) — data user & progress tetap utuh.
4. Auth lengkap: register, login, forgot/reset password, email verification — dengan **JWT httpOnly cookie** (perbaikan dari pola lama yang mempercayai email dari localStorage).
5. Halaman dashboard versi sederhana: statistik inti user, pemilih bahasa, ringkasan kurikulum/roadmap, misi harian read-only, jumlah flashcard due.
6. Setup AI SDK (`ai` + `@ai-sdk/openai-compatible`) dengan env `OPENCODE_AI_*` + satu server action smoke test.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Lokasi kode | Dioxus → `dioxus/`; Next.js di root | Referensi tetap di satu repo; prod jalan terus |
| Auth | Session/JWT httpOnly cookie | Memperbaiki kelemahan pola lama; kompatibel dengan hash bcrypt existing |
| Deployment (nanti) | Vercel | Pasangan natural Next.js + Prisma + Neon |
| UI | Pertahankan tampilan lama (Tailwind class, dark mode, teks Indonesia) | Sudah terbukti dipakai user; menghindari regresi UX |
| AI | Vercel AI SDK + `@ai-sdk/openai-compatible` → `https://opencode.ai/go/v1` | Pengganti wrapper Gemini langsung; env sudah tersedia |
| Database | Introspect skema Neon existing + baseline migration | Tidak ada migrasi data; akun & progress user utuh |

## Struktur repo target

```
lingomind/
├─ dioxus/            # app lama dipindah via git mv: src/, migrations/, assets/, scripts, README, AGENTS.md (disesuaikan)
├─ app/               # Next.js App Router
│  ├─ (auth)/login/page.tsx, register, forgot-password, reset-password, verify-email
│  ├─ dashboard/page.tsx
│  ├─ layout.tsx
│  └─ globals.css
├─ components/        # navbar, ui primitives (diport dari views/navbar.rs + class Tailwind lama)
├─ lib/
│  ├─ db.ts           # Prisma singleton
│  ├─ auth.ts         # JWT sign/verify, getSession()
│  ├─ mail.ts         # nodemailer (SMTP Gmail)
│  └─ ai.ts           # createOpenAICompatible provider
├─ prisma/schema.prisma
├─ public/            # aset lama yang relevan (logo, icon)
├─ .env               # DATABASE_URL, AUTH_SECRET, SMTP_*, APP_URL, OPENCODE_AI_*
├─ package.json
```

Daftar berkas lama yang ikut ke `dioxus/` (git mv): `src/`, `migrations/`, `assets/`, `public/`, `test_smtp.rs`, `examples/`, `apply_dark_mode.py`, `clear_ai_cache.sh`, `reset_progress.sh`, `Dioxus.toml`, `clippy.toml`, `tailwind.css`, `error.txt`, `Cargo.toml`, `Cargo.lock`, `README.md` (asal), `.gitignore` (asal).

Catatan: `migrations/` SQL historis tetap disimpan di `dioxus/migrations/` sebagai referensi; **Prisma schema adalah sumber kebenaran mulai fase ini** (ada baseline migration yang menandai tabel existing sebagai sudah diterapkan, sehingga `prisma migrate dev` tidak mencoba recreate).

Setelah pindahan, root `AGENTS.md` ditulis ulang untuk menggambarkan repo Next.js (perintah npm, struktur app/–lib/–prisma, konvensi server action + `getSession()`, env baru). `AGENTS.md` di `dioxus/` mempertahankan panduan Dioxus untuk referensi.

## Stack & dependency

- Next.js (App Router, versi stabil terbaru) + TypeScript
- `prisma` + `@prisma/client` — introspect Neon, baseline migration
- `jose` — JWT (sign/verify, httpOnly cookie, umur 30 hari)
- `bcryptjs` — verifikasi hash bcrypt lama (tetap berfungsi untuk akun existing)
- `nodemailer` — SMTP Gmail (template email Indonesia diport dari `services/auth.rs`)
- `ai` + `@ai-sdk/openai-compatible` — AI provider
- Tailwind (versi yang kompatibel dengan class existing; dark mode via `.dark` class)

## Environment variables (`.env` di root)

```
DATABASE_URL=<Neon, sama dengan yang dipakai Dioxus>
AUTH_SECRET=<baru, dipakai jose>
SMTP_USERNAME=<sama>        # default lingomindid@gmail.com
SMTP_PASSWORD=<sama>        # Gmail app password
APP_URL=http://localhost:3000   # default baru (aplikasi Next.js)
OPENCODE_AI_API_KEY=<dari environment>
OPENCODE_AI_ENDPOINT=https://opencode.ai/go/v1/chat/completions
OPENCODE_AI_MODEL=deepseek-v4-flash
```

Semua variabel hanya dibaca server-side (server action / route handler), tidak pernah bocor ke client bundle.

## Auth flow

- **Register:** validasi (nama, email, password ≥ 6) → `bcrypt.hash` → insert `users` → buat token → kirim email verifikasi (tabel `email_verification_tokens` dipakai ulang). Pesan error dalam bahasa Indonesia, sama dengan aplikasi lama.
- **Verifikasi email:** route `/verify-email?token=...` → validasi token dari tabel, set `is_verified = true`.
- **Login:** cek `users`, `bcrypt.compare`, cek `is_verified` → set JWT httpOnly cookie (30 hari). Payload: `{ email, full_name, role }`.
- **Forgot/reset password:** token di tabel `password_resets` (dipakai ulang), kirim email dengan link `/reset-password?token=...`.
- **`getSession()`:** helper di `lib/auth.ts` — verifikasi JWT dari cookie → return `UserProfile` atau null. **Wajib dipanggil di setiap server action yang butuh user** (pengganti parameter `email` dari localStorage).
- **`middleware.ts`:** melindungi `/dashboard` (belum login → redirect `/login`); halaman auth (`/login`, `/register`) redirect ke `/dashboard` jika sudah login.
- **Logout:** hapus cookie.
- **Efek samping yang disepakati:** user yang sedang login di aplikasi lama harus login sekali lagi di aplikasi baru (session pindah dari localStorage ke cookie). Akun & password tetap valid.

## Dashboard (Fase 1)

Komponen/aksi yang dibutuhkan (sumber: `src/services/dashboard.rs`, `engagement.rs`, `curriculum.rs`, `mission.rs`, `flashcard.rs`, `auth.rs`):

- Statistik inti dari `user_engagement_stats` (streak, longest streak, coins, total points, hearts) — pakai query yang sama dengan `get_engagement_stats_server`.
- Pemilih bahasa + simpan preferensi (`update_preferred_language_server` → kolom `preferred_language` di `users`); daftar bahasa dari tabel `languages`.
- Roadmap kurikulum read-only dari tabel `levels` + `topics` (`get_all_curriculum`).
- Ringkasan misi harian read-only dari `user_daily_missions` (`get_daily_mission_server`).
- Jumlah flashcard due (`get_due_flashcard_count_server`).
- **Tidak termasuk Fase 1:** pet, social feed, offline, tour modal, hearts refill, generasi lesson AI, badge, leaderboard.

## AI SDK (Fase 1)

`lib/ai.ts`:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const provider = createOpenAICompatible({
  apiKey: process.env.OPENCODE_AI_API_KEY,
  baseURL: process.env.OPENCODE_AI_ENDPOINT?.replace(/\/chat\/completions$/, ""),
});

export const model = provider(process.env.OPENCODE_AI_MODEL ?? "deepseek-v4-flash");
```

Catatan: SDK menambahkan `/chat/completions` ke baseURL, jadi suffix di `OPENCODE_AI_ENDPOINT` harus di-strip. Smoke test: satu server action kecil (misal tombol di dashboard yang memanggil `generateText` dan menampilkan hasil singkat).

TTS (voice chat, pronunciation) bukan bagian Fase 1; solusinya akan ditentukan di Fase 3.

## UI & dark mode

- Class Tailwind diport apa adanya dari komponen Dioxus (tampilan identik).
- Dark mode: key localStorage `lingomind_theme` (tetap, user lama mempertahankan preferensi), class `.dark` di `<html>`, script anti-flash di `<head>` — meniru `document::Script` di `components/app.rs`.
- Teks UI dan pesan error dalam bahasa Indonesia, mengikuti konvensi repo.
- Navbar: item navigasi diport dari `components/navbar.rs`.

## Verifikasi

- `npm run lint` (next lint)
- `npx tsc --noEmit`
- `npm run build`
- Smoke test manual: daftar akun baru → email verifikasi → login → ganti bahasa → lihat dashboard → logout; login akun lama (hash bcrypt existing) → dashboard.

## Di luar cakupan Fase 1

Gemini/AI fitur aktual (lesson, quiz, chat, story, TTS, pronunciation, placement, exam), flashcard penuh, gamifikasi (badge, mission claim, pet, league, shop, inventory, social, battle), leaderboard, semua halaman admin, cron job reminder, deploy Vercel & cutover dari Dioxus. Masing-masing menjadi fase terpisah dengan spec sendiri.
