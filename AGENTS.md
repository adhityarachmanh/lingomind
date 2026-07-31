# LingoMind

Aplikasi belajar bahasa. **Fase 1 migrasi dari Dioxus ke Next.js sedang berlangsung** — aplikasi aktif (Next.js) ada di root; aplikasi lama di `dioxus/` (referensi; masih live di production sampai cutover).

## Perintah

- Dev: `npm run dev` (http://localhost:3000)
- Verify: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` (vitest — hanya lib murni)
- DB: `npm run db:generate` (generate Prisma Client), `npm run db:status` (migrate status), `npm run db:seed`, `npm run db:check` (cek koneksi + jumlah data), `npx prisma studio`
- Legacy Dioxus (referensi saja, tidak dikembangkan): `cargo check --features server` di dalam `dioxus/`

## Lingkungan (.env di root — jangan commit)

- `DATABASE_URL` — Neon PostgreSQL. Prisma 7 butuh driver adapter (`PrismaPg` di `lib/db.ts`); config Prisma ada di `prisma.config.ts` (bukan package.json). DB kosong saat setup — skema ditulis manual di `prisma/schema.prisma` (tidak ada `db:pull`); migration yang sudah applied: `20260731165924_init` + `20260731170113_align_fk_actions`
- `AUTH_SECRET` — jose JWT (cookie httpOnly `lingomind_session`, 30 hari)
- `SMTP_USERNAME`/`SMTP_PASSWORD` (Gmail app password) — tanpa password, email dicetak ke console server (mode dev)
- `APP_URL` (default `http://localhost:3000`)
- `OPENCODE_AI_API_KEY`/`OPENCODE_AI_ENDPOINT`/`OPENCODE_AI_MODEL` — AI provider opencode.ai (`ai` + `@ai-sdk/openai-compatible`); endpoint default `https://opencode.ai/zen/go/v1/chat/completions` (suffix `/chat/completions` di-strip di `lib/ai.ts`); model default `deepseek-v4-flash`

## Arsitektur

- `app/(auth)/*` — login, register, verify-email, forgot/reset password (tanpa navbar)
- `app/(app)/*` — area berlogin; layout melindungi via `getSession()` + `middleware.ts` juga melindungi `/dashboard`
- `lib/` — `db.ts` (Prisma singleton + driver adapter), `auth.ts` (JWT + `getSession()`), `profile.ts`, `mail.ts`, `dashboard.ts` (logika data), `validation.ts`, `ai.ts`; `lib/actions/*` = server actions (pengganti `#[server]` fn Dioxus)
- `prisma/schema.prisma` — skema ditulis manual; sumber kebenaran; nama model singular (`db.user`, `db.language`); tambah model per fase lewat migration baru
- `dioxus/` — aplikasi lama utuh (Dioxus 0.7 + sqlx migrations di `dioxus/migrations/`). Sumber referensi perilaku & pesan error (Indonesia)

## Konvensi

- UI & pesan error **bahasa Indonesia**; string error lama wajib dipertahankan (lihat `lib/actions/*`)
- Setiap server action yang butuh user memanggil `getSession()` — jangan pakai parameter email dari client
- Dark mode: class `.dark` di `<html>`, key localStorage `lingomind_theme` (konsisten dengan aplikasi lama). Session localStorage lama TIDAK dipakai — user harus login ulang
- Admin seed: `admin@lingomind.com` (password `admin`) — **ganti password di produksi**
- Jangan commit `.env`; `test_smtp.rs` di `dioxus/` berisi password SMTP keras (rahasia)

## Status migrasi

Fase 1 selesai: auth lengkap + dashboard ringkas + AI SDK setup. Belum: quiz/lesson/chat/story/TTS/pronunciation (fase 2-3), gamifikasi (fase 4), admin (fase 5), cron + deploy Vercel + cutover (fase 6). Spec: `docs/superpowers/specs/2026-07-31-lingomind-nextjs-migration-phase1-design.md`.
