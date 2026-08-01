# Migrasi LingoMind ke Next.js — Fase 3: AI Interaktif (Chat + Voice Chat + Story + Pronunciation)

Tanggal: 2026-08-01
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1-2b selesai (auth, dashboard, roadmap, lesson, quiz, flashcard, practice, exam, placement). Fase 3 memport 4 fitur AI interaktif: chat roleplay, voice chat, story, dan pronunciation practice. Chat & voice berbagi backend sesi (tabel `chat_sessions`/`chat_messages` sudah ada di Prisma). TTS output memakai Web Speech API (keputusan: zero backend, konsisten fase 2a). STT memakai SpeechRecognition browser (seperti legacy).

## Tujuan Fase 3

1. **Chat roleplay** `/chat/:goal`: sesi per (email, bahasa, level, goal, skenario), 8 skenario preset + custom, auto-start untuk topik roadmap, parsing konvensi `Koreksi:`, window konteks 10 pesan, riwayat 120 pesan.
2. **Voice chat** `/voice-chat/:goal`: backend sesi sama; STT browser → kirim teks → balasan AI diucapkan via speechSynthesis; status loop (menghubungkan/mendengarkan/berpikir/berbicara/muted); avatar animasi.
3. **Story** `/story/:goal`: 4 segmen + soal komprehensi MCQ per segmen + terjemahan; TTS Web Speech auto-play (rate 0.9); selesai → reward 20 XP (`applyQuizResult` + `updateEngagementAfterQuiz`).
4. **Pronunciation** `/pronunciation-practice`: 5 kalimat AI; STT → evaluasi AI (skor 0-100, feedback, word_results); + tombol 🔊 referensi (perbaikan gap legacy).
5. Integrasi: roadmap modal + dashboard CTA; aset avatar dipindah ke `public/`.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Cakupan | Semua 4 fitur satu fase | Chat & voice berbagi backend sesi; story & pronunciation kecil |
| TTS voice chat | Web Speech API (`speechSynthesis` + `tts_lang_code`) | Zero backend, konsisten fase 2a; edge-tts CLI tidak viable di Vercel |
| STT | SpeechRecognition browser (`webkitSpeechRecognition`) | Sama persis legacy; tanpa backend |
| Streaming | Tidak ada (request/response + "Partner AI sedang mengetik...") | Setia legacy; sederhana |
| Reward story | `applyQuizResult(email, lang, goal, 20)` + `updateEngagementAfterQuiz(email, 20)` | Setia legacy (update_user_score dipanggil story juga) |
| Pronunciation scores | Tidak dipersist | Setia legacy |
| Referensi audio pronunciation | Tambah SpeakButton (gap legacy yang diperbaiki) | Gratis, jelas bermanfaat |

## Arsitektur

```
app/(app)/chat/[goal]/page.tsx           # wrapper → ChatView (client)
app/(app)/voice-chat/[goal]/page.tsx     # wrapper → VoiceChatView (client)
app/(app)/story/[goal]/page.tsx          # wrapper → StoryView (client)
app/(app)/pronunciation-practice/page.tsx # wrapper → PronunciationView (client)
components/useSpeechRecognition.ts       # hook STT browser (voice chat + pronunciation)
components/ChatView.tsx, VoiceChatView.tsx, StoryView.tsx, PronunciationView.tsx
lib/chat.ts                              # getOrCreateSession / fetchHistory / window 10 / Koreksi split helper
lib/ai-content/chat.ts                   # buildOpeningPrompt / buildReplyPrompt / buildChatHistory (murni) + generateChatReply
lib/ai-content/story.ts                  # buildStoryPrompt (murni) + generateStory
lib/ai-content/pronunciation.ts          # buildSentencePrompt + parseSentenceArray; buildEvaluationPrompt + parseEvaluation (murni)
lib/actions/chat.ts                      # getOrCreateChatSessionAction, sendChatMessageAction
lib/actions/story.ts                     # getStoryAction, completeStoryAction
lib/actions/pronunciation.ts             # getSentencesAction, evaluatePronunciationAction
public/avatar_*.gif/png                  # dipindah dari dioxus/assets/
```

## Perilaku yang diport (sumber: riset mendalam dioxus/src/)

### Chat roleplay
- `getOrCreateChatSessionAction(goal, setting?)`: cari sesi (email, language, level, goal, roleplaySetting) → ada: return riwayat 120; tidak ada: create + generate opening AI (prompt topik/persona verbatim) + insert pesan AI pertama
- `sendChatMessageAction(sessionId, message)`: validasi "Pesan tidak boleh kosong."; owner check sesi (error "Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi."); insert pesan user; window 10 pesan terakhir (reversed); buildChatHistory (ai → "model" role); prompt reply (topik/persona + instruksi "Koreksi:"); insert balasan; return riwayat 120
- UI: picker 8 preset (Cafe/Hotel/Airport/Restaurant/Office/Shopping/Hospital/Taxi) + custom (max 50, in-memory) — auto-start bila goal != "Bebas"; bubbles (user kanan teal, AI kiri putih); split "Koreksi:" → bubble + kotak 💡 amber; optimistic push; "Partner AI sedang mengetik..."; "Keluar Sesi" → dashboard
- String: "Gagal memuat sesi obrolan: {e}", "Gagal mengirim pesan: {e}", "Sesi chat belum siap. Coba pilih ulang skenario."

### Voice chat
- Backend identik chat; input STT; output speechSynthesis (lang tts_lang_code, rate 1.0); mute toggle; hang-up (topik → roadmap, "Bebas" → picker)
- Status: "Menghubungkan asisten AI...", "Silakan berbicara... (AI Mendengarkan)", "AI sedang berpikir...", "AI sedang berbicara...", "Mikrofon Dinonaktifkan (Muted)", "Menunggu..."
- Transcript "Anda berkata" + Koreksi AI box; avatar ring glow (border per status, animate-pulse saat listening); error "Browser tidak mendukung Speech Recognition" / "Merekam suara gagal"
- useSpeechRecognition hook: SpeechRecognition || webkitSpeechRecognition; continuous=false, interimResults=false, maxAlternatives=1; onresult/onend/onerror (no-speech → timeout); cleanup stop

### Story
- `getStoryAction(goal)`: level dari profil; prompt verbatim (4 segmen, soal komprehensi, 4 opsi 1 benar, translation, JSON murni); retry 3x; parse → StoryData {title, title_translation, segments[{text, speaker?, translation, question?}]}
- UI: progress (idx/total), header + title_translation, kartu narasi + speaker badge + translation footer + 🔊 replay (rate 0.9 auto-play), soal MCQ → ✨ Benar!/❌ Salah + explanation, "Lanjut", selesai → 🎉 "Cerita Selesai!" + reward + "Selesai & Kembali" → roadmap
- `completeStoryAction(goal)`: applyQuizResult(email, lang, goal, 20) + updateEngagementAfterQuiz(email, 20) → { message } (error → "Cerita selesai. (Gagal menyimpan skor)")
- String: "Menyiapkan Cerita Interaktif...", "Gagal Memuat Cerita", "Coba Lagi", "Kembali ke Peta"

### Pronunciation
- `getSentencesAction()`: 5 kalimat (prompt verbatim, JSON array string, parse murni); batch baru saat habis
- `evaluatePronunciationAction(sentence, transcript)`: prompt verbatim (skor 0-100, feedback Indonesia, word_results sama persis dengan kata target berurutan); temperature 0.2; parse → {score, feedback, word_results}
- UI: mic button (idle teal 🎙️ / listening rose pulse "Sedang mendengarkan..." / evaluating amber ⏳ "Mengevaluasi..."), kartu "Ucapkan Kalimat Ini:" + 🔊 referensi (SpeakButton rate 0.9 — perbaikan), kata berwarna (emerald/rose wavy/slate line-through), SVG score circle (>=80 emerald, >=50 amber, else rose), feedback 💡 biru, transcript dalam kutip, "Kalimat Selanjutnya"
- String: "Menyiapkan kalimat latihan...", "Browser tidak mendukung Speech Recognition", "Gagal menangkap suara.", "Suara tidak terdengar.", "Tekan mic dan mulai bicara"

### Integrasi
- Roadmap modal (RoadmapClient): tambah 3 tombol — 💬 Chat Percakapan → `/chat/:topic`, 🎙️ Roleplay Suara → `/voice-chat/:topic`, 🎧 Mode Story → `/story/:topic` (desc legacy)
- Dashboard: tambah CTA — Chat AI (`/chat/Bebas`, "Simulasi percakapan teks bebas."), Live Voice AI (`/voice-chat/Bebas`, "Ngobrol langsung dengan suara."), Speech Scoring (`/pronunciation-practice`, "Latih akurasi pronunciation.")
- Aset: `dioxus/assets/avatar_male_talking.gif`, `avatar_male_idle.png`, `avatar_female_talking.gif`, `avatar_female_idle.png` → `public/`

## Model AI & konfigurasi
- `OPENCODE_AI_MODEL` (lib/ai.ts model); `maxOutputTokens: 8192`; temperature: opening 0.8, reply 0.7, story 0.7, sentences 0.7, evaluation 0.2
- Error AI: "Gagal menghasilkan..." dengan pesan Indonesia; retry: chat reply 1 retry, story 3 attempts, evaluation 1 retry (kesepakatan port: retry terbatas, error UI jelas)

## Testing
- vitest TDD (fungsi murni): buildChatHistory (role mapping + window 10), splitKoreksi (splitn(2)), prompt builders (contains), parseSentenceArray (valid/fence/invalid), parseEvaluation (valid/missing fields), parseStoryData (4 segmen/validasi)
- Verifikasi: lint, tsc, build, migrate status (tanpa migration baru — tabel chat sudah ada)
- Smoke AI nyata: 1× opening chat, 1× reply chat (cek format "Koreksi:"), 1× story (4 segmen), 1× sentences (5), 1× evaluation — 5 panggilan
- Smoke manual akhir oleh user (STT/audio butuh browser nyata — Chrome/Edge)

## Di luar cakupan
TTS backend (msedge-tts/Gemini/edge-tts CLI), streaming chat, avatar 3D/animasi lanjutan, persist skor pronunciation, gamifikasi (4), admin (5), cron/deploy/cutover (6).
