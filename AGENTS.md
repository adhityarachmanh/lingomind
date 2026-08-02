# LingoMind

Aplikasi belajar bahasa. **Migrasi dari Dioxus ke Next.js SELESAI (Fase 6)** — aplikasi aktif = Next.js (main) di root; Dioxus di `dioxus/` hanya referensi (tidak dikembangkan).

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
- `CRON_SECRET` — melindungi endpoint cron (Bearer `CRON_SECRET`); Vercel Cron otomatis kirim header `x-vercel-cron`

## Arsitektur

- `app/(auth)/*` — login, register, verify-email, forgot/reset password (tanpa navbar)
- `app/(app)/*` — area berlogin; layout melindungi via `getSession()` + `middleware.ts` juga melindungi `/dashboard`; routes: `/dashboard`, `/roadmap`, `/lesson/:goal`, `/quiz/:goal`, `/flashcard-review`, `/general-practice`, `/practice/:goal`, `/exam/:level`, `/placement`, `/chat/:goal`, `/voice-chat/:goal`, `/story/:goal`, `/pronunciation-practice`, `/shop`, `/profile/:email`, `/guide`, `/leaderboard`, `/analytics`
- `app/(admin)/*` — area admin (tanpa navbar user): `/admin/login` (login admin) + `/admin/:tab` (5 panel: konfigurasi, toko, bahasa, kurikulum, pengguna); layout sendiri via `AdminShell` (sidebar + topbar)
- `app/api/cron/daily-reminder` — Vercel Cron `0 1 * * *` UTC (= 08:00 WIB): kirim reminder harian ke user TERVERIFIKASI yang BELUM aktif hari ini (08:00 WIB) via `lib/reminder.ts`; guard `x-vercel-cron` ATAU Bearer `CRON_SECRET`
- `lib/` — `db.ts` (Prisma singleton + driver adapter), `auth.ts` (JWT + `getSession()` + `requireAdmin()`), `admin.ts` (20 fn query/transaksi admin — port `dioxus/src/services/admin.rs`), `profile.ts`, `mail.ts`, `dashboard.ts` (logika data), `validation.ts`, `ai.ts`, `progress.ts` (streak + quiz outcome + hook badge), `mission.ts` (skor & misi harian + claim), `shop.ts` (toko: item/cost/transaksi), `badges.ts` (evaluasi & award badge), `flashcards.ts` (SM-2), `weakness.ts` (classifier skill/weakness), `leaderboard.ts` (liga mingguan + global + friends), `social.ts` (feed, follow, like, notifications), `battle.ts` (battle 1v1 + submit skor), `pets.ts` (pet, items, feed, care), `chat.ts` (split `Koreksi:`), `sanitize.ts` (sanitize-html), `reminder.ts` (build body + kirim reminder harian — tanpa SMTP password, email dicetak ke console), `ai-content/` (`parse.ts`, `lesson.ts`, `quiz.ts`, `exam.ts`, `placement.ts`, `chat.ts`, `story.ts`, `pronunciation.ts` — pipeline AI), `lib/actions/*` = server actions (pengganti `#[server]` fn Dioxus) — termasuk `lesson.ts`, `quiz.ts`, `flashcard.ts`, `mission.ts`, `practice.ts`, `exam.ts`, `placement.ts`, `chat.ts`, `story.ts`, `pronunciation.ts`, `shop.ts`, `profile.ts`, `leaderboard.ts`, `social.ts`, `pets.ts`, `battle.ts`, `analytics.ts` (query weakness/analisis), `admin.ts` (21 actions admin, guard `requireAdmin()` → `"Akses ditolak."`); komponen UI di `components/` (termasuk `ChestCard.tsx`, `HeartsRefillModal.tsx`, `ProfileView.tsx`, `ShopView.tsx`, `LeaderboardView.tsx`, `AnalyticsView.tsx`, admin: `AdminShell.tsx`, `AdminLoginForm.tsx`, `AdminConfigPanel.tsx`, `AdminShopPanel.tsx`, `AdminLanguagePanel.tsx`, `AdminCurriculumPanel.tsx`, `AdminUsersPanel.tsx`, `ui.tsx`)
- `prisma/schema.prisma` — skema ditulis manual; sumber kebenaran; nama model singular (`db.user`, `db.language`); tambah model per fase lewat migration baru
- `dioxus/` — aplikasi lama utuh (Dioxus 0.7 + sqlx migrations di `dioxus/migrations/`). Sumber referensi perilaku & pesan error (Indonesia)

## Catatan lingkungan

- Node >= 22.12.0 (dibutuhkan `sanitize-html`)

## Konvensi

- UI & pesan error **bahasa Indonesia**; string error lama wajib dipertahankan (lihat `lib/actions/*`)
- Setiap server action yang butuh user memanggil `getSession()` — jangan pakai parameter email dari client
- Setiap server action admin memanggil `requireAdmin()` (di `lib/auth.ts`) → `"Akses ditolak."`; middleware melindungi `/admin` (session), role di-check layout admin (`app/(admin)/layout.tsx`)
- Dark mode: class `.dark` di `<html>`, key localStorage `lingomind_theme` (konsisten dengan aplikasi lama). Session localStorage lama TIDAK dipakai — user harus login ulang
- Admin seed: `admin@lingomind.com` (password `admin`) — **ganti password di produksi**
- Jangan commit `.env`; `test_smtp.rs` di `dioxus/` berisi password SMTP keras (rahasia)
- HTML AI (lesson content, soal quiz) WAJIB lewat `sanitizeHtml()` (`lib/sanitize.ts`) sebelum `dangerouslySetInnerHTML`
- Fungsi murni (SM-2 di `flashcards.ts`, streak/outcome di `progress.ts`, validasi quiz, classifier `weakness.ts`, parser `ai-content/parse.ts`) diuji dengan vitest (`*.test.ts` di `lib/`)
- TTS = Web Speech API (`components/SpeakButton.tsx`), bahasa dari `language.tts_lang_code` (fallback `en-US`)
- STT = SpeechRecognition browser (`components/useSpeechRecognition.ts`; `webkitSpeechRecognition` fallback — butuh Chrome/Edge; `supported` untuk pesan error)
- Chat (fase 3): sesi disimpan di DB (`chat_sessions`/`chat_messages` via `db.chatSession`/`db.chatMessage`); balasan AI memuat blok `Koreksi:` yang di-split `splitKoreksi()` di `lib/chat.ts`; goal `Bebas` → picker (tanpa auto-start)
- Quiz AI: cache 5 varian acak per (language, level, goal, modifier) di `cached_quizzes` (`contentJson`), dipick acak sebelum generate baru
- Pipeline AI generic: `generateQuizWithPrompt` (quiz/practice/exam) di `lib/ai-content/quiz.ts` dengan retry otomatis; lesson punya pipeline sendiri `generateLesson` di `lib/ai-content/lesson.ts`; placement inline di `lib/actions/placement.ts` via `generateText` (helper `buildPlacementPrompt`/`formatPlacementHistory`/`parseCefrLevel` di `lib/ai-content/placement.ts`) — prompt dikirim sebagai argumen; hasil dicek via `parseCefrLevel`, tanpa retry otomatis
- Placement menyimpan hasil ke `user_language_progress` (bukan `users.current_level` — kolom itu legacy, sudah di-drop)
- Badge hook: `evaluateAndAwardBadges(email)` dipanggil `.catch(() => {})` di akhir `updateEngagementAfterQuiz` (`lib/progress.ts`) — jangan pernah menggagalkan flow quiz
- Seed (fase 4a): `npm run db:seed` — badges (3) + shop_items (18); verifikasi via `npm run db:check`
- Dua format error koin berbeda — jangan dicampur: shop `Koin tidak cukup (butuh {cost}).` (`lib/shop.ts`) vs hearts `Koin tidak cukup! Butuh {n} Koin.` (`lib/shop.ts` — refillHearts)
- Liga mingguan (fase 4b): lazy assign grup mingguan via raw SQL `SELECT ... FOR UPDATE` di `lib/leaderboard.ts` (`getWeeklyLeague` MENULIS — jangan dipanggil di test unit); hook streak_milestone/level_up/league score di `lib/progress.ts` (`logActivity`)
- Battle 1v1 (fase 4b): mulai via `/quiz/:goal?battle_id=N` — skor dikirim ke `submitBattleScore`; kedua user submit → update terakhir menang (acceptable, sama dengan legacy)

## Status migrasi

Fase 1 selesai: auth lengkap + dashboard ringkas + AI SDK setup. Fase 2a selesai: roadmap + lesson + quiz + flashcard (SM-2), streak/misi/hearts, pipeline AI (generate lesson/quiz + cache). Fase 2b selesai: practice/exam/placement (pipeline generic `generateQuizWithPrompt`, halaman `/general-practice`, `/practice/:goal`, `/exam/:level`, `/placement`, CTA di dashboard + tombol exam di roadmap). Fase 3 selesai: AI interaktif — chat (`/chat/:goal`, sesi DB + `Koreksi:`), voice-chat (`/voice-chat/:goal`, STT SpeechRecognition + TTS Web Speech), story (`/story/:goal`, reward `applyQuizResult` 20 pts), pronunciation (`/pronunciation-practice`, scoring akurasi). Fase 4a selesai: ekonomi & status — badges (evaluasi di `lib/badges.ts` + hook di `updateEngagementAfterQuiz`), shop (`/shop`, `lib/shop.ts`, item/cost/transaksi, `ChestCard`/`HeartsRefillModal`), profile (`/profile/:email`, `ProfileView`), guide (`/guide`), misi daily claim (`lib/mission.ts`). Fase 4b selesai: sosial & kompetisi — leaderboard (`/leaderboard`, liga mingguan lazy assign + global + friends, `LeaderboardView`), social feed/follow/like/notifications (`lib/social.ts`), battle 1v1 (`lib/battle.ts`, mulai via `/quiz/:goal?battle_id=N`), pets (`lib/pets.ts`, item/feed/care di dashboard), analisis weakness (`/analytics`, `AnalyticsView` + query di `lib/actions/analytics.ts`). Fase 5 selesai: admin — guard `requireAdmin()` (di `lib/auth.ts`, middleware + layout `app/(admin)`), `lib/admin.ts` (20 fn), `lib/actions/admin.ts` (21 actions, termasuk `checkAdminRoleAction`), 5 panel (`AdminConfigPanel`/`AdminShopPanel`/`AdminLanguagePanel`/`AdminCurriculumPanel`/`AdminUsersPanel` + `AdminShell` + `AdminLoginForm`), route `/admin/login` + `/admin/:tab`. **Fase 6 selesai — MIGRASI LENGKAP**: cron reminder harian (`app/api/cron/daily-reminder` + `lib/reminder.ts`) + deploy Vercel. Catatan: aplikasi aktif = Next.js (main); Dioxus di `dioxus/` hanya referensi; deploy Vercel — env diisi di dashboard (DATABASE_URL, AUTH_SECRET, SMTP_*, APP_URL, OPENCODE_AI_*, CRON_SECRET); VPS deploy.sh TIDAK dipakai lagi. Spec: `docs/superpowers/specs/2026-07-31-lingomind-nextjs-migration-phase1-design.md`.
