# Migrasi LingoMind ke Next.js — Fase 2b: Practice + Exam + Placement

Tanggal: 2026-08-01
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 2a selesai (roadmap, lesson, quiz, flashcard + pipeline AI). Fase 2b memport 4 fitur sisanya dari siklus belajar lama: weakness practice, general practice, exam (kenaikan tingkat), dan placement test. Semua memakai pipeline quiz AI yang sudah ada (normalize/validate/quality/retry/cache).

## Tujuan Fase 2b

1. **General practice** (`/general-practice`): 5 soal acak; selesai sempurna → +1 nyawa + engagement(15 pts); selain itu engagement(10 pts). Tanpa skor/level/misi.
2. **Weakness practice** (`/practice/:goal`): 3 soal fokus kelemahan utama (fallback `goal`); salah → log weakness; selesai → misi "weakness". Tanpa skor/hearts.
3. **Exam** (`/exam/:level`): 8 soal, lulus 75%; gates (level & topik ≥4, hearts, cooldown 24 jam, tiket retake); naik level CEFR saat lulus di topik terakhir.
4. **Placement test** (`/placement`): chat 3 pertanyaan scripted → evaluasi AI → level CEFR tersimpan ke `user_language_progress` (PERBAIKAN bug legacy yang menulis ke kolom terhapus).
5. Integrasi: tombol exam di roadmap (locked/unlocked), 3 CTA card di dashboard (Latihan Acak, Latihan Kelemahan, Tes Penempatan).

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Cakupan | Semua 4 fitur satu fase | Pipeline sama; tiap fitur relatif kecil |
| Placement persist | `user_language_progress` (base_level, topic_idx=0) | Legacy menulis ke `users.current_level` (kolom DROP — hasil tak tersimpan); format `"B1.0"` cocok persis |
| Integrasi | Tombol exam di roadmap + 3 CTA dashboard | Titik masuk alami; "Beli Tiket di Toko" disembunyikan (toko fase 4) |
| Pipeline AI | Refactor `lib/ai-content/quiz.ts` → generic `generateQuizWithPrompt({prompt, expectedCount, label, weaknessFocus})` | Hindari duplikasi; prompt per fitur diport verbatim |
| String hadiah general practice | Perbaiki ketidakakuratan legacy: UI "15 Koin" padahal DB menambah 15 poin + koin config (10) | Tampilkan "1 Nyawa ❤️ & 15 Poin + 10 Koin 🪙" / "10 Poin + 10 Koin 🪙" |
| Weakness context | Join dengan newline asli (bukan literal `\n` — quirk legacy) | Perbaikan kecil, prompt lebih jelas |

## Arsitektur

```
app/(app)/general-practice/page.tsx + components/PracticeView.tsx   # shared quiz UI (konfigurasi)
app/(app)/practice/[goal]/page.tsx   → PracticeView (mode weakness)
app/(app)/exam/[level]/page.tsx + components/ExamView.tsx
app/(app)/placement/page.tsx + components/PlacementView.tsx
lib/ai-content/quiz.ts          # refactor: generateQuizWithPrompt + buildGeneralPracticePrompt + buildWeaknessPrompt + buildWeaknessContext (murni)
lib/ai-content/exam.ts          # buildExamPrompt (murni) + generateExam (via pipeline generic)
lib/ai-content/placement.ts     # buildPlacementPrompt + parseCefrLevel (murni)
lib/progress.ts                 # tambah: addHeart, submitExamResult (port auth.rs:607-732), computeExamOutcome (murni)
lib/actions/practice.ts         # getWeaknessPracticeAction, getGeneralPracticeAction, logPracticeAnswerAction, submitGeneralPracticeResultAction
lib/actions/exam.ts             # checkExamCooldownAction, consumeRetakeTicketAction, submitExamResultAction
lib/actions/placement.ts        # evaluatePlacementAction
```

## Perilaku yang diport (sumber: riset mendalam dioxus/src/)

### General practice
- `getGeneralPracticeAction`: level user → cache (goal `"general_practice"`, modifier `"normal"`, ≤5 varian acak) → shuffle → 5 soal
- Selesai: `submitGeneralPracticeResultAction({ perfect })` → perfect: `addHeart(email)` + `updateEngagementAfterQuiz(email, 15)`; else `updateEngagementAfterQuiz(email, 10)`
- `addHeart` (port engagement.rs): cap 5; saat 5 → `last_heart_refill = NULL`
- UI: loading "Menyiapkan Latihan..." / "Sedang merancang soal latihan umum untuk Anda. Mohon tunggu sebentar."; selesai "Latihan Selesai!" / "Kamu berhasil menuntaskan latihan acak ini." / hadiah; tombol Cek Jawaban/Pertanyaan Berikutnya/Selesai/Menyimpan...; tanpa per-jawaban side effects

### Weakness practice
- `getWeaknessPracticeAction(goal)`: priority weakness (`getPriorityWeakness`) → fallback `goal`; 3 soal; cache (goal `"weakness"`, modifier = topik kelemahan)
- Konteks: 6 note terakhir topik, truncate 140 char, join `- ...` newline asli
- Salah jawab → `logPracticeAnswerAction({question, selected, correct, explanation})` → `logWeakness(topic, "Practice Q: ...")`; TANPA hearts/flashcard/skill
- Selesai → client `incrementMissionAction("weakness")` (pola lesson)
- UI: "Menyiapkan Latihan Kelemahan..." / "Sedang menganalisis riwayat kelemahan Anda..."; badge "Fokus Kelemahan: {topic}"; selesai "Kamu berhasil menuntaskan latihan fokus kelemahan."

### Exam
- Gates di `getExamAction(level)`: profil level map → `base === level && topicIdx >= 4` else error `Anda belum menyelesaikan semua topik di level {level} untuk mengambil ujian ini.`; hearts (client via initialHearts, ≤0 → "Nyawa Kamu Habis!"); cooldown via `checkExamCooldownAction` → `{ onCooldown, message, tickets }` (message "{h} jam {m} menit"/"{m} menit"); `consumeRetakeTicketAction` (transaction: tickets>0 → -1 + cooldown NULL; errors `Anda tidak memiliki tiket retake exam.` / `Data user tidak ditemukan.`)
- Generate: 8 soal; cache (goal `"exam"`, modifier `"normal"`); prompt verbatim (next-level mapping A1→A2..C1→C2 cap C2; ≥2 reading comprehension; ≥2 listening; explanation ≥3 kalimat)
- Salah → deductHeart (fire-and-forget)
- Hasil: `passingScore = ceil(total * 0.75)`; `passed = correct >= passingScore`; `score = correct * base_reward_points level`; UI "LULUS UJIAN!" / "BELUM LULUS", "Batas kelulusan minimal {n} benar (75%)."
- `submitExamResultAction({level, passed, correctCount, total, score})` → port `submit_exam_result`:
  - misi "quiz" → double-XP multiplier → progress log (`activityType "exam"`, topic `"Level Exam"`, `scoreGained` = score×multiplier, `passed`, baseLevel, topicIdx lama) → level-up bila `passed && topicIdx >= topicsInLevel` (next CEFR, topic_idx=0; social log DILEWATI fase 4) → upsert `user_language_progress` (fail: cooldown = now+24h; pass: NULL) → `users.score = score + gained`
  - Semua dalam `$transaction` (perbaikan vs legacy yang sequential)

### Placement
- Chat: pesan AI awal (verbatim), follow-up scripted [0]=[1]=[2] per user message 1/2, pesan ke-3 → "Terima kasih! Percakapan ini sudah cukup. Silakan klik tombol 'Evaluasi Level Saya' di bawah."
- Tombol "Selesai & Evaluasi Level Saya" (≥1 pesan user) → `evaluatePlacementAction(messages)` → prompt verbatim (`Evaluasi kemampuan bahasa {lang} ... Hanya kembalikan dua karakter...`) → `parseCefrLevel` (scan A1..C2, default "A1") → upsert `user_language_progress` (base_level = kode, topic_idx = 0) → return level
- UI: "Tes Penempatan", "Evaluasi Selesai!", "Level bahasa Anda saat ini adalah:", input + "Kirim"

### Integrasi
- Roadmap: tombol exam per level — unlocked bila `idx < activeLevelIdx` (level terlewati) ATAU `idx === activeLevelIdx && activeTopicIdx >= 4`; locked → "🔒 Ujian Kenaikan Tingkat (Selesaikan semua topik)"; open → "🎓 Ujian Kenaikan Tingkat" → `/exam/:level`; hapus teks "tersedia di fase berikutnya" yang sudah usang
- Dashboard: 3 CTA card (setelah grid statistik): Latihan Acak → `/general-practice` ("+1 Nyawa ❤️ dan +15 Poin + Koin 🪙"), Latihan Kelemahan → `/practice/General`, Tes Penempatan → `/placement` ("Belum yakin dengan level Anda?")

## Testing
- vitest TDD (fungsi murni): `computeExamOutcome` (passing/score), `nextLevelIndex`, `parseCefrLevel`, `buildWeaknessContext` (truncate 140 + join), prompt builders (snapshot-lite: contains checks), `addHeart` logic (via pure helper `computeAddHeart`)
- Verifikasi: lint, tsc, build, migrate status; smoke AI nyata: 1× general practice, 1× weakness, 1× exam, 1× placement (4 panggilan)
- Smoke manual akhir oleh user (tanpa dev server di subagent)

## Di luar cakupan 2b
Chat/voice/story + TTS backend (fase 3); gamifikasi, shop (beli tiket retake), league, social feed/level_up log (fase 4); admin (5); cron/deploy/cutover (6); halaman analisis weakness.
