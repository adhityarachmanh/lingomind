# Migrasi LingoMind ke Next.js — Fase 4b: Sosial & Kompetisi (Leaderboard + Battle + Feed + Analytics + Pets)

Tanggal: 2026-08-02
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1-4a selesai (auth, belajar inti, AI interaktif, ekonomi & status). Fase 4b melengkapi gamifikasi: leaderboard & liga mingguan, quiz battle, social feed, analisis kelemahan, dan virtual pets.

## Tujuan Fase 4b

1. **Leaderboard** `/leaderboard`: 4 tab (Liga Mingguan/Global/Teman/Cari), liga lazy auto-assign (4 divisi, promosi/degradasi, kapasitas 30), global top 100, follow/unfollow, modal challenge.
2. **Quiz Battle**: challenge → `/quiz/:goal?battle_id=N` → submit skor → pemenang +50 koin + `pvp_wins_today`; dashboard "Arena Pertarungan".
3. **Social feed**: dashboard "Beranda Aktivitas Teman" (50 feed + like); aktivasi hook `streak_milestone` & `level_up`.
4. **Analisis** `/analytics`: 2 tab (Peta Topik Kelemahan + Tren 7 Hari), SVG chart murni.
5. **Pets**: dashboard kartu pet aktif + modal koleksi + beri makan.
6. **Navbar**: link Leaderboard + Analisis.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Cakupan | Semua 5 fitur satu fase | Saling terhubung (battle↔leaderboard↔feed) |
| Liga assignment | Lazy (saat buka leaderboard) + FOR UPDATE row lock via `$queryRaw` dalam interactive tx | Setia legacy; satu-satunya raw SQL yang dibutuhkan |
| Hook streak_milestone/level_up | Aktifkan di updateEngagementAfterQuiz / submitExamResult | Legacy mengirim ke social_feed — tabel sudah hidup dari 4a (badge/pet) |
| League score | Tambah update `user_league_members.league_score += actualDelta` di applyQuizResult | Hook yang terlewat dari 2a |
| Battle di quiz | `battle_id` searchParams opsional di `/quiz/:goal`; submit setelah submitQuizResult | Setia legacy (quiz.rs submit chain) |
| Charts | SVG murni (tanpa library) | Setia legacy; ukuran kecil |
| Raw SQL | Hanya `SELECT ... FOR UPDATE` untuk kapasitas group | Prisma tidak punya row-lock setara |

## Arsitektur

```
app/(app)/leaderboard/page.tsx + components/LeaderboardView.tsx (4 tab + modal challenge)
app/(app)/analytics/page.tsx + components/AnalyticsView.tsx (SVG)
lib/leaderboard.ts    # decideNextDivision (MURNI) / getWeeklyLeague (lazy tx) / getGlobalLeaderboard / getFollowingLeaderboard / daysLeft
lib/social.ts         # searchUsers / toggleFollow / getSocialFeed / likeActivity / formatFeedDate (MURNI)
lib/battle.ts         # decideBattleOutcome (MURNI) / createBattle / getActiveBattles / submitBattleScore
lib/pets.ts           # computePetStage / petEmojiLabel (MURNI) / getActivePet / getAllPets / setActivePet / feedPet
lib/weakness.ts       # tambah getWeaknessAnalytics / getSkillProgress7d
lib/actions/leaderboard.ts / social.ts / pets.ts / analytics.ts
lib/progress.ts       # applyQuizResult += league score; updateEngagementAfterQuiz += streak_milestone; submitExamResult += level_up
components/SocialFeedSection.tsx / BattleArenaSection.tsx / PetCard.tsx (+ modal koleksi)
app/(app)/quiz/[goal]/page.tsx + QuizView  # battle_id opsional
```

## Perilaku yang diport (sumber: riset mendalam dioxus/src/)

### Leaderboard & liga
- `getWeeklyLeague(email)`: member minggu ini? → ya: return (group, members, days_left); tidak: lazy assign — rank minggu lalu (ROW_NUMBER partition group_id order league_score desc) → `decideNextDivision(prevIdx, rnk)` (rnk<=5 → min(3, prev+1); rnk>=26 → max(0, prev-1); else prev; tanpa riwayat → 0/Bronze) → `SELECT id ... WHERE division AND week_start_date AND member_count < 30 LIMIT 1 FOR UPDATE` (tx) → update member_count+1 / insert group baru → insert membership → return
- `getGlobalLeaderboard(limit)`: users role != admin ORDER BY score desc (10..100); `getFollowingLeaderboard(email)`: UNION followed + self
- Status zone: rnk<=5 "promosi", >=26 "degradasi", else "aman"
- UI: header gradient "🏆 Papan Peringkat" + "Pantau progresmu dan tantang temanmu!"; tab: Liga (divisi heading 🥉🥈🥇💎 + "Sisa {days_left} hari lagi minggu ini!" + rows rank circle zone-colored + nama (self amber "Anda") + title badge + ⬆/⬇ tag + "{score} pts"), Global/Teman (podium 🥇🥈🥉 + rows 🔥 streak + "{score} pts" + "⚔️ Tantang" hanya tab Teman), Cari (placeholder "Cari nama atau email teman...", ≥3 huruf → "Ketik minimal 3 huruf..." / "Tidak ditemukan.", Follow/Unfollow)
- Challenge modal: "Pilih topik kuis yang ingin Anda ujikan. Siapa yang paling tinggi skornya, dia yang dapat Koin!" + input placeholder "Contoh: Past Tense, Passive Voice..." + status "Topik kuis tidak boleh kosong!" / "Mengirim tantangan..." / "Tantangan berhasil dikirim! Tutup jendela ini."

### Battle
- `createBattle(challengerEmail, challengedEmail, language, goal)`; `getActiveBattles(email)` (50, join names); `submitBattleScore(battleId, email, score)`: status != pending → "Tantangan sudah selesai atau dibatalkan."; bukan peserta → "Anda tidak berpartisipasi dalam tantangan ini."; update skor sendiri; kedua skor ada → complete + `decideBattleOutcome(myScore, oppScore, amChallenger)` → pemenang +50 koin + pvp_wins_today; messages: menang "Selamat! Anda menang dalam tantangan ini dan mendapat 50 Koin!" / kalah "Anda kalah dalam tantangan ini. Coba lagi lain kali!" / seri "Hasilnya SERI! Kalian berdua sama-sama hebat." / challenger pertama "Skor berhasil disimpan! Menunggu lawan menyelesaikan kuis." / else "Skor berhasil disimpan!"
- Quiz flow: wrapper baca searchParams battle_id → QuizView prop → setelah submitQuizResult sukses → submitBattleScoreAction(battleId, score) (fire-and-forget atau await — legacy await dalam chain; await, error tidak menggagalkan result screen)

### Social feed
- `getSocialFeed(email)`: feed sendiri + yang di-follow, 50, join full_name + emoji pet aktif (COALESCE vp.emoji '👤'), has_liked correlated, created_at format "%d %b %Y, %H:%M" → formatFeedDate (bulan Indonesia: Januari..Desember)
- `likeActivity(feedId, email)`: insert like ON CONFLICT + likes_count++ (tx); tanpa unlike (setia legacy)
- `searchUsers(query, email)`: LIKE full_name/email (lower), limit 20, is_following correlated, streak/total_quiz_completed/frame/title/color, rank
- `toggleFollow(follower, followed, follow)`: insert ON CONFLICT / delete
- Hooks: `updateEngagementAfterQuiz` → jika currentStreak > 0 && % 7 == 0 → socialFeed "streak_milestone" "Luar biasa! Berhasil mencapai {n} hari beruntun belajar!"; `submitExamResult` → saat level-up → socialFeed "level_up" "Berhasil naik ke Level {new} di bahasa {lang}!"

### Analisis
- `getWeaknessAnalytics(email, language, limit 8)`: groupBy topic FILTER 7d/30d, order count_30d desc, count_7d desc
- `getSkillProgress7d(email, language)`: per hari grammar/vocabulary/listening benar
- Tab 1: kartu topik, label "Akurasi kesalahan terdistribusi secara berkala.", bar "7 Hari Terakhir" "{count_7d}x salah" (amber, width count/max_30d*100) + "30 Hari Terakhir" (teal); empty "Belum ada data kelemahan untuk bahasa ini." + "Lakukan kuis atau latihan agar AI dapat memetakan fokus kelemahan Anda."
- Tab 2: SVG 0 0 560 220 (plot 480x160), 3 area+line (grammar #6366f1, vocabulary #ec4899, listening #f59e0b), gridlines 0/0.25/0.5/0.75/1.0, dots r=4, label day[5..10], legend; empty "Belum ada data tren keterampilan." + "Selesaikan materi pelajaran & kuis harian untuk melihat grafik tren keterampilan Anda."

### Pets
- `computePetStage(exp)`: 0-99→1, 100-299→2, 300-999→3, >=1000→4 (exp reset saat naik); `petEmojiLabel(type, stage)`: dragon (🥚 Telur Naga / 🦎 Bayi Naga Api / 🦖 Naga Remaja / 🐉 Naga Raksasa), owl (🥚 Telur Burung / 🐣 Anak Burung / 🐥 Burung Kecil / 🦉 Burung Malam), fenrir (🥚 Telur Serigala / 🐾 Anak Serigala / 🐕 Serigala Muda / 🐺 Serigala Es), fallback (🥚 Telur Misterius)
- `feedPet(email, petId)`: stats null → "User stats tidak ditemukan."; koin < 50 → "Koin tidak cukup! Butuh 50 Koin."; pet bukan milik → "Peliharaan tidak ditemukan!"; exp+50 (stage-up: exp reset; stage>=4 exp terus naik, bar "Max"); "Nyam nyam! Peliharaanmu senang."
- `setActivePet(email, petId)`: tx (all false → true milik)
- Dashboard: kartu pet (emoji text-6xl, "{label} (Lv. {stage})", EXP bar max_exp 100/300/1000, "🍎 Beri Makan (50 Koin)", "🔄 Ganti Peliharaan" → modal koleksi "🐾 Koleksi Peliharaan" (empty "Anda belum memiliki peliharaan. Beli telur di Toko!", card "Jadikan Utama"/"Sedang Dipakai")

### Quiz battle integration
- `app/(app)/quiz/[goal]/page.tsx`: `searchParams: Promise<{ battle_id?: string }>` → parse int → prop battleId
- QuizView: prop battleId?; finishQuiz → setelah submitQuizResult sukses → `if (battleId) await submitBattleScoreAction(battleId, score).catch(() => {})`
- lib/actions/battle.ts: `submitBattleScoreAction(battleId, score)` (getSession; message; error tidak menampilkan di result screen)

## Testing
- vitest TDD (murni): decideNextDivision (naik/turun/tetap/tanpa riwayat/cap), decideBattleOutcome (4 kasus + messages), computePetStage (4 threshold + reset), petEmojiLabel (13), formatFeedDate (bulan Indonesia + jam), decideStreakMilestone (7/14/6/0), analytics bar width
- Verifikasi: lint, tsc, build, migrate status
- Smoke manual akhir oleh user (leaderboard muncul setelah login → liga ter-assign; follow teman; challenge battle → quiz → menang/kalah; feed + like; pet beli telur → tetas → makan; analytics)

## Di luar cakupan 4b
Admin (5), cron + deploy + cutover (6); league finalize mingguan (tetap lazy); ad refill; PWA offline.
