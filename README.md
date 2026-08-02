# LingoMind

Aplikasi belajar bahasa (Next.js App Router + Prisma + Neon + Tailwind + Vercel AI SDK). Migrasi dari Dioxus SELESAI.

## Menjalankan

1. Salin `.env.example` → `.env`, isi `DATABASE_URL`, `AUTH_SECRET`, `OPENCODE_AI_*` (dan `SMTP_PASSWORD` bila mau email sungguhan).
2. `npm install`
3. `npm run db:generate` (client Prisma; migration sudah applied)
4. `npm run db:seed` — 28 bahasa + admin default `admin@lingomind.com` (password `admin`; **ganti di produksi**) — hanya bila DB masih kosong
5. `npm run dev` → http://localhost:3000

## Verifikasi

`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npx prisma migrate status`.

Akun admin default: `admin@lingomind.com` (password `admin`).

## Status

Fase 1–6 selesai (auth, kurikulum, AI interaktif, ekonomi & status, sosial & kompetisi, admin, cron reminder). Lihat `docs/superpowers/specs/` untuk rancangan fase.
