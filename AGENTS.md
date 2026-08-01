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
- `app/(app)/*` — area berlogin; layout melindungi via `getSession()` + `middleware.ts` juga melindungi `/dashboard`; routes: `/dashboard`, `/roadmap`, `/lesson/:goal`, `/quiz/:goal`, `/flashcard-review`, `/general-practice`, `/practice/:goal`, `/exam/:level`, `/placement`, `/chat/:goal`, `/voice-chat/:goal`, `/story/:goal`, `/pronunciation-practice`
- `lib/` — `db.ts` (Prisma singleton + driver adapter), `auth.ts` (JWT + `getSession()`), `profile.ts`, `mail.ts`, `dashboard.ts` (logika data), `validation.ts`, `ai.ts`, `progress.ts` (streak + quiz outcome), `mission.ts` (skor & misi harian), `flashcards.ts` (SM-2), `weakness.ts` (classifier skill/weakness), `chat.ts` (split `Koreksi:`), `sanitize.ts` (sanitize-html), `ai-content/` (`parse.ts`, `lesson.ts`, `quiz.ts`, `exam.ts`, `placement.ts`, `chat.ts`, `story.ts`, `pronunciation.ts` — pipeline AI), `lib/actions/*` = server actions (pengganti `#[server]` fn Dioxus) — termasuk `lesson.ts`, `quiz.ts`, `flashcard.ts`, `mission.ts`, `practice.ts`, `exam.ts`, `placement.ts`, `chat.ts`, `story.ts`, `pronunciation.ts`
- `prisma/schema.prisma` — skema ditulis manual; sumber kebenaran; nama model singular (`db.user`, `db.language`); tambah model per fase lewat migration baru
- `dioxus/` — aplikasi lama utuh (Dioxus 0.7 + sqlx migrations di `dioxus/migrations/`). Sumber referensi perilaku & pesan error (Indonesia)

## Catatan lingkungan

- Node >= 22.12.0 (dibutuhkan `sanitize-html`)

## Konvensi

- UI & pesan error **bahasa Indonesia**; string error lama wajib dipertahankan (lihat `lib/actions/*`)
- Setiap server action yang butuh user memanggil `getSession()` — jangan pakai parameter email dari client
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

## Status migrasi

Fase 1 selesai: auth lengkap + dashboard ringkas + AI SDK setup. Fase 2a selesai: roadmap + lesson + quiz + flashcard (SM-2), streak/misi/hearts, pipeline AI (generate lesson/quiz + cache). Fase 2b selesai: practice/exam/placement (pipeline generic `generateQuizWithPrompt`, halaman `/general-practice`, `/practice/:goal`, `/exam/:level`, `/placement`, CTA di dashboard + tombol exam di roadmap). Fase 3 selesai: AI interaktif — chat (`/chat/:goal`, sesi DB + `Koreksi:`), voice-chat (`/voice-chat/:goal`, STT SpeechRecognition + TTS Web Speech), story (`/story/:goal`, reward `applyQuizResult` 20 pts), pronunciation (`/pronunciation-practice`, scoring akurasi). Tersisa: gamifikasi (fase 4), admin (fase 5), cron + deploy Vercel + cutover (fase 6). Spec: `docs/superpowers/specs/2026-07-31-lingomind-nextjs-migration-phase1-design.md`.
