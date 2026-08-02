# Migrasi LingoMind ke Next.js — Fase 6: Cron Reminder + Deploy

Tanggal: 2026-08-02
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1-5 selesai (auth, belajar inti, AI interaktif, gamifikasi, admin). Fase 6 = fase terakhir: cron pengingat harian (port `cron.rs`) ke Vercel Cron, persiapan deploy, dan push ke origin (Vercel sudah didaftarkan user).

## Tujuan Fase 6

1. **Cron reminder**: `vercel.json` + `app/api/cron/daily-reminder/route.ts` — jadwal `0 1 * * *` (01:00 UTC = 08:00 WIB), guard `CRON_SECRET`, query + email port persis `cron.rs`.
2. **Pure helper TDD**: `buildReminderBody` (template body persis legacy).
3. **Polish**: link "Beli Tiket di Toko 🏪" aktif di layar cooldown exam (toko sudah ada).
4. **Deploy prep**: `.env.example` + AGENTS.md + CRON_SECRET; verifikasi lengkap; `git push origin main`.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Cron | Vercel Cron (vercel.json) + route handler | Platform deploy Vercel; tanpa server tambahan |
| Jadwal | `0 1 * * *` UTC = 08:00 WIB | Legacy jam 08:00 server |
| Guard | Header `Authorization: Bearer ${CRON_SECRET}` | Standar Vercel; 401 tanpa/ salah |
| Query | Gabung manual di JS (users + stats + due counts) | UserEngagementStat tanpa relasi di Prisma |
| Email | `sendMail` (lib/mail.ts) dengan template persis | Reuse; fallback console bila SMTP_PASSWORD kosong |
| Push | `git push origin main` (setelah semua review) | Vercel auto-deploy; user isi env dashboard |

## Arsitektur

```
vercel.json                                # crons config
app/api/cron/daily-reminder/route.ts       # GET handler + guard + send
lib/reminder.ts                            # buildReminderBody (MURNI) + sendDailyReminders (DB)
lib/reminder.test.ts
app/(app)/exam/[level]/  (ExamView.tsx)    # + link "Beli Tiket di Toko 🏪" → /shop
.env.example                               # + CRON_SECRET
AGENTS.md                                  # status Fase 6 + catatan deploy
```

## Perilaku yang diport (cron.rs)

- Query: users `is_verified = true` JOIN stats dengan `(last_active_date < CURRENT_DATE OR last_active_date IS NULL)` + `due_flashcards` (COUNT flashcards due <= NOW) per user
- SMTP_PASSWORD kosong → log "SMTP_PASSWORD tidak diatur. Pengingat tidak akan dikirimkan." + return (tanpa error)
- Subject: `Saatnya Belajar Bahasa di LingoMind! 🚀`
- Body (buildReminderBody):
  - `Hai {full_name},\n\n`
  - streak > 0 → `Hebat! Pertahankan streak {n} harimu! Mari luangkan waktu beberapa menit hari ini untuk belajar dan menjaga streak-mu agar tidak kembali ke nol.\n\n`
  - else → `Mari mulai belajar hari ini dan bangun streak-mu di LingoMind! Konsistensi adalah kunci dalam mempelajari bahasa baru.\n\n`
  - due > 0 → `🧠 Smart Reminder: Ada {n} kosakata yang hampir terlupakan dan sudah waktunya untuk di-review hari ini!\n\n`
  - penutup → `Klik di sini untuk mulai belajar: {APP_URL}\n\nSalam hangat,\nLingoMind Team`
- Per email: sendMail (gagal per user → log, lanjut); response `{ sent: n }`

## Testing
- vitest TDD: buildReminderBody (streak>0, streak=0, due>0, due=0, kombinasi)
- Verifikasi: lint, tsc, test, build, migrate status
- Smoke: jalankan route handler lokal? (tanpa dev server — tes handler via tsx langsung panggil sendDailyReminders dengan SMTP kosong → log fallback; JANGAN kirim email nyata ke user)
- Push: `git push origin main` (setelah semua review + final verify)

## Di luar cakupan
DNS/custom domain; rate-limit login admin; hardening battle race (tercatat); VPS deploy.sh TIDAK dipakai lagi (struktur repo Next.js); env Vercel dashboard diisi user.
