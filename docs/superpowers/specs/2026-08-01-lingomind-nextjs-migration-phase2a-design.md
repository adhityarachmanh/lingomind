# Migrasi LingoMind ke Next.js — Fase 2a: Roadmap + Lesson + Quiz + Flashcard

Tanggal: 2026-08-01
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1 selesai (Next.js 16 + Prisma 7 + auth JWT + dashboard). Fase 2a memport siklus belajar utama dari aplikasi Dioxus lama (`dioxus/src/`): roadmap kurikulum, lesson (AI), quiz (AI), dan flashcard review (SRS). AI memakai Vercel AI SDK → opencode.ai (`OPENCODE_AI_*` env, model `deepseek-v4-flash`) — bukan Gemini lagi.

## Tujuan Fase 2a

1. **Roadmap** (`/roadmap`): peta kurikulum A1–C2 dengan unlock rules + modal "Mulai Topik" (2 metode aktif: Pelajari Materi, Latihan Kuis).
2. **Lesson** (`/lesson/:goal`): materi AI multi-part, cache, adaptive modifier, HTML content + kosa kata + contoh kalimat + TTS (Web Speech API browser).
3. **Quiz** (`/quiz/:goal`): 5 soal AI, hearts gate, cek jawaban client-side, per-answer side effects (flashcard, weakness log, skill log, deduct heart), submit chain skor + level-up + engagement + mission.
4. **Flashcard review** (`/flashcard-review`): SM-2 variant, 3 tombol grade, due list.
5. Navbar: tambah link "Kurikulum".

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Cakupan | 2a: roadmap+lesson+quiz+flashcard; practice/exam/placement → 2b | Siklus belajar utama lengkap & saling terkait |
| TTS | Web Speech API browser (`speechSynthesis` + `tts_lang_code`) | Gratis, tanpa backend; TTS canggih → fase 3 |
| Cache kuis | 5 varian per (language, level, goal, modifier), pilih acak | Perbaiki bug kolom legacy (payload vs content_json — pakai `contentJson`); hemat biaya + variasi |
| AI | Port prompt persis dari Gemini → `generateText` + parse JSON (schema di prompt, tanpa responseSchema) + quality gate + retry | Endpoint openai-compatible tidak punya responseSchema |
| Sanitasi HTML | `sanitize-html` sebelum `dangerouslySetInnerHTML` | Perbaikan XSS vs `dangerous_inner_html` lama |
| Verifikasi jawaban | Client-side (string equality), setia pada asli | Anti-cheat bukan prioritas fase ini |

## Arsitektur

```
app/(app)/roadmap/page.tsx          # server component: data + render peta
app/(app)/lesson/[goal]/page.tsx    # wrapper server → LessonView (client)
app/(app)/quiz/[goal]/page.tsx      # wrapper server → QuizView (client)
app/(app)/flashcard-review/page.tsx # wrapper server → FlashcardView (client)
components/SpeakButton.tsx          # Web Speech API
components/LessonView.tsx, QuizView.tsx, FlashcardView.tsx, RoadmapClient.tsx (modal)
lib/progress.ts      # port update_user_score: level-up, progress log, skor, double XP, mission quiz
lib/mission.ts       # incrementMissionProgress / incrementCorrectAnswers
lib/flashcards.ts    # sm2Next() murni + query due/review/add
lib/weakness.ts      # classifyWeaknessTopic / classifySkill (murni) + logWeakness/logSkill
lib/ai-content/parse.ts    # parse AI JSON (strip fence, fallback), (murni)
lib/ai-content/lesson.ts   # generateLesson: prompt + enrichment gate (logika murni + AI call)
lib/ai-content/quiz.ts     # normalize/validate/quality/retry (murni) + generateQuiz (AI call)
lib/actions/lesson.ts / quiz.ts / flashcard.ts   # server actions, getSession() wajib
```

## Perilaku yang diport (sumber: riset mendalam dioxus/src/)

### Lesson
- Request: `getLessonAction(goal, part)` — session → base_level (`A1` dari `current_level["{lang}"]` format `"A1.2"`), modifier dari `user_engagement_stats` (streak ≥3 & quiz ≥5 → hard; quiz >0 & streak 0 → easy; else normal)
- Cache `cached_lessons` key `(language, level, goal, part, modifier)`; gagal parse → regenerate
- Prompt port: TARGET BAHASA, level CEFR, goal, part note, pedoman level, kualitas (content HTML ≥700, vocab ≥8, contoh ≥8, judul bagian Konsep Inti/Pola/Kesalahan Umum/Tips Praktik); enrichment 1x jika tidak kaya (≥700, ≥6, ≥6)
- View: loading "Menyusun Materi Belajar...", retry, error + Coba Lagi/Kembali; header ✕ + title + badges; content sanitized HTML; sidebar kosa kata + contoh kalimat; "Lesson Selanjutnya" (part+1, fire-and-forget mission "lesson"), "Mulai Quiz", "Kembali ke Dashboard"; mobile bottom bar
- Offline cache localStorage TIDAK diport (fitur offline dashboard belum ada)

### Quiz
- Request: `getQuizAction(goal)` — session → level, konteks kelemahan (top 3 weakness_logs) → generate/cache
- Generate: prompt port (5 soal, 4 opsi, 1 benar, explanation Indonesia ≥2 kalimat, ≥2 listening, ≥1 vocabulary, cloze `__`, question_type text|listening, HTML question, tanpa trivia) → normalize → validate (5 soal, 4 opsi unik, answer ∈ options, listen_text ≥6) → quality (dupe, pendek, ambigu, skill ≥2, listening ≥2, bias posisi) → max 3 percobaan dengan feedback; cache ≤5 varian → random; shuffle opsi server-side
- View: loading "Merancang Kuis Kustom...", hearts gate (≤0 → "Nyawa Kamu Habis!"), progress bar, listening TTS, 4 opsi A/B/C/D, "Cek Jawaban" → penjelasan ✓/✗, per-jawaban side effects (lihat bawah), "Pertanyaan Berikutnya", "Selesai & Simpan Skor"
- Side effects per "Cek Jawaban": tambah flashcard (front=soal, back=`Jawaban benar: {c} | Penjelasan: {e}`); benar → skor += pts level + logSkill(true); salah → deductHeart + logWeakness(classify) + logSkill(false)
- Submit chain (di `submitQuizResultAction`): incrementCorrectAnswers → `applyQuizResult` (required=pts×5; passed=skor penuh & topik sesuai; level-up topic_idx+1 jika passed; upsert `user_language_progress`; insert `user_progress_logs`; skor global += delta (×2 jika double XP); mission "quiz") → `updateEngagementAfterQuiz` (upsert stats: streak/freeze/amulet logic + coins dari app_config + total; badge hook DILEWATI fase ini)
- Result: "Kuis Selesai!", confetti, unlock/terkunci message, "Kembali ke Roadmap"

### Flashcard (SM-2 variant)
- `sm2Next(easeFactor, intervalDays, repetition, quality)`: ef = max(1.3, ef + 0.1 − (5−q)(0.08 + (5−q)·0.02)); q<3 → (ef, 1, 0); else rep+1, interval 1/3/round(interval·ef)
- Grade: Ulangi=2, Bagus=4, Mudah=5; due_at = NOW() + interval hari; mission "flashcard" per review
- add: ON CONFLICT (email, language, front_text, back_text) DO NOTHING
- View: kartu, "Tampilkan Terjemahan", 3 tombol grade, selesai → "Sesi Selesai!", empty → "Semua Kartu Bersih!"

### Roadmap
- Server component: profile (level map), languages, curriculum → render 6 level nodes + topic grid + modal client
- Unlock: level ≤ aktif; topik level aktif ≤ topic_idx; exam ≥4 topik (tombol exam disembunyikan — 2b); modal hanya 2 metode
- Header "Peta Kurikulum {language}", "Posisi Anda", ✓/🔒

### Umum
- Semua server action: `getSession()` dulu (redirect/error "Sesi berakhir. Silakan login kembali.")
- String UI/error Indonesia persis (lihat riset: "Gagal Memuat Materi", "Kunci jawaban...", dsb)
- Fire-and-forget dari client: server actions tetap dieksekusi (HTTP POST)
- HTML AI disanitasi `sanitize-html` (allow: br, b, i, ul, ol, li, p, strong, em, u, a[href], blockquote, code, h3-h4)

## Dependensi baru
`sanitize-html` (+ @types). TTS: Web Speech API native (tanpa paket).

## Testing
- vitest TDD untuk: sm2Next, normalizeQuiz, validateQuizShape, qualityIssues, classifyWeaknessTopic, classifySkill, parseAiJson (strip fence), passed/level-up math, modifier computation
- Verifikasi: lint, tsc, build, migrate status (tanpa migration baru — skema sudah ada), smoke manual di akhir oleh user (tanpa dev server di subagent)

## Di luar cakupan 2a
Weakness/general practice, exam, placement (fase 2b); chat/voice/story, TTS backend (fase 3); gamifikasi lengkap, battle, league (fase 4); admin (fase 5); cron/deploy/cutover (fase 6); halaman analisis weakness; offline localStorage.
