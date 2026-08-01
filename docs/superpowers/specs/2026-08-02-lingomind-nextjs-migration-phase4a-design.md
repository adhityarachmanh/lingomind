# Migrasi LingoMind ke Next.js — Fase 4a: Ekonomi & Status (Shop + Badges + Misi + Profile + Guide)

Tanggal: 2026-08-02
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1-3 selesai (auth, dashboard, roadmap, lesson, quiz, flashcard, practice, exam, placement, chat, voice chat, story, pronunciation). Fase 4 = gamifikasi (11 fitur) dibagi dua: **4a Ekonomi & Status** (shop, badges, misi claim, profile, guide, refill nyawa) dan **4b Sosial & Kompetisi** (leaderboard, battle, social feed, analisis, pets).

## Tujuan Fase 4a

1. **Shop** `/shop`: 18 item (utilitas 6, kosmetik 9, telur pet 3), saldo koin, beli + efek + auto-equip.
2. **Refill nyawa koin**: modal di dashboard (60/nyawa, cap 5); tanpa iklan (legacy punya — dilewati).
3. **Badge system**: 3 badge seed; evaluasi otomatis setelah setiap aktivitas skor (hook `updateEngagementAfterQuiz`); log `badge_earned` ke `social_feed` (UI feed di 4b).
4. **Klaim Misi Harian**: 3 peti (Kayu 20 / Perak 50 / Emas 100 + bonus acak) di dashboard; tier 3 butuh `pvp_wins_today` (terkunci sampai 4b — perilaku benar).
5. **Profile** `/profile/:email`: profil publik (frame/gelar/warna, badge, statistik) + galeri kosmetik (equip, profil sendiri saja).
6. **Guide** `/guide`: halaman statis 9 kartu.
7. **Navbar**: link Toko, Panduan, avatar profil.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Pembagian fase | 4a dulu, 4b menyusul | 11 fitur terlalu besar satu fase |
| Seed badges + shop_items | Update `prisma/seed.ts` (upsert idempotent) + `prisma db seed` | Perubahan DATA bukan skema — tanpa migration; tabel sudah ada dari fase 1 |
| Hook badge | Di akhir `updateEngagementAfterQuiz` (lib/progress.ts) | Setia legacy (engagement.rs memanggil evaluate_and_award_badges) — otomatis untuk quiz/exam/story/general practice |
| Tier 3 misi | Tetap diimplementasi (butuh pvp_wins — terkunci sampai 4b) | Perilaku benar, tidak ada perubahan nanti |
| Ad refill | Dilewati | Tidak ada ad network; UI cukup refill koin |
| Cosmetics | Auto-equip saat beli + equip manual di galeri profil | Setia legacy |

## Arsitektur

```
app/(app)/shop/page.tsx + components/ShopView.tsx (client)
app/(app)/profile/[email]/page.tsx + components/ProfileView.tsx
app/(app)/guide/page.tsx (server statis)
lib/shop.ts          # getShopItems / buyItem (port lengkap) / refillHearts
lib/badges.ts        # evaluateBadgeMatches (MURNI) + evaluateAndAwardBadges + getUserBadges
lib/mission.ts       # tambah claimMissionReward(email, tier) + decideTierRequirement (MURNI) + decideMysteryRoll (MURNI)
lib/actions/shop.ts  # getShopAction / buyItemAction / refillHeartsAction
lib/actions/mission.ts # tambah claimMissionRewardAction(tier)
lib/actions/profile.ts # getPublicProfileAction(email) / equipFrameAction / equipTitleAction / equipColorAction
lib/progress.ts      # updateEngagementAfterQuiz → panggil evaluateAndAwardBadges
```

## Perilaku yang diport (sumber: riset mendalam dioxus/src/)

### Seed (prisma/seed.ts — tambah)
- `badges`: First Step (🎯, quiz_completed, 1) / Week Warrior (🔥, streak, 7) / Rich Scholar (💰, coins, 100) — upsert by name
- `shop_items` (18, upsert by name): Streak Freeze ❄️ 50 streak_freeze; Double XP Potion 🧪 100 double_xp; Weekend Amulet 🛡️ 80 weekend_amulet; Gold Profile Frame 🖼️ 250 profile_frame_gold; Mystery Box 🎁 50 mystery_box; Diamond Profile Frame 💎 500 profile_frame_diamond; Mythic Profile Frame 🌌 1000 profile_frame_mythic; Gelar Polyglot 🎓 500 title_polyglot; Gelar Sultan 👑 1000 title_sultan; Gelar Legend 🌟 2000 title_legend; Warna Gold ✨ 800 name_color_gold; Warna Crimson 🔥 800 name_color_crimson; Warna Neon Blue ⚡ 800 name_color_neon_blue; Streak Repair 🩹 2000 streak_repair; Tiket Ujian Ulang 🎫 1000 exam_retake; Telur Naga Api 🥚 250 egg_dragon; Telur Burung Malam 🥚 250 egg_owl; Telur Serigala Es 🥚 250 egg_fenrir

### Shop (lib/shop.ts)
- `getShopItems(email)`: items ORDER BY cost ASC + owned set dari user_inventory.item_type
- `buyItem(email, itemId)` urutan persis legacy: item tak ada → "Item tidak ditemukan."; stats tak ada → insert row coins 0; coins < cost → "Koin tidak cukup (butuh {cost})."; tx: decrement coins + match effect_type:
  - streak_freeze → streak_freezes +1
  - streak_repair → decideStreakRepair (MURNI): diff 1 → "Streak Anda masih aktif hari ini. Lakukan 1 kuis untuk mempertahankannya!"; diff >= 2 → current = previous+1, last_active = kemarin, "Streak Anda berhasil dipulihkan!"; else "Streak Anda belum hangus."; tanpa last_active → "Anda belum memiliki riwayat belajar."
  - double_xp → double_xp_until = now + 24 jam
  - exam_retake → exam_retake_tickets +1
  - weekend_amulet → has_weekend_amulet = true
  - profile_frame_* → dup check → "Anda sudah memiliki bingkai ini!"; insert inventory; auto-equip active_frame (gold/diamond/mythic)
  - title_* → dup "Anda sudah memiliki gelar ini!"; insert; auto-equip active_title
  - name_color_* → dup "Anda sudah memiliki warna ini!"; insert; auto-equip active_name_color
  - mystery_box → decideMysteryRoll (MURNI): <=40 zonk +10 koin "Mystery Box: Zonk! Kamu dapat kembalian 10 koin."; <=75 double xp 1 jam "Hoki!"; <=95 +1 freeze "Mantap!"; else +100 koin "JACKPOT! 🎉"
  - egg_* → dup "Anda sudah memiliki jenis peliharaan ini!"; insert user_pets (stage 1, exp 0, is_active = belum ada pet aktif); log pet_hatched
- `refillHearts(email)`: hearts >= 5 → "Nyawa sudah penuh!"; cost = missing*60; coins < cost → "Koin tidak cukup! Butuh {n} Koin."; update coins -cost, hearts 5, last_heart_refill null

### Badges (lib/badges.ts)
- `evaluateBadgeMatches({currentStreak, totalQuizCompleted, coins}, badges)`: MURNI — quiz_completed >= value / streak >= value / coins >= value
- `evaluateAndAwardBadges(email)`: stats + unowned badges → match → insert ON CONFLICT DO NOTHING → jika ada yang baru, log_activity "badge_earned" ("Mendapatkan lencana baru: {name}!")
- `getUserBadges(email)`: JOIN user_badges ORDER BY earned_at DESC
- Hook: di akhir `updateEngagementAfterQuiz` → `evaluateAndAwardBadges(email)` (fire-and-forget .catch(() => {}) — jangan gagalkan flow utama)

### Misi claim (lib/mission.ts + action)
- `decideTierRequirement(row, tier)` MURNI: tier 1 (quizzes_completed < 1 → "Selesaikan 1 Kuis terlebih dahulu!"; claimed → "Peti Kayu sudah diklaim!"; reward 20 "Berhasil membuka Peti Kayu! Dapat 20 koin."), tier 2 (correct_answers_today < 50 → "Jawab 50 pertanyaan dengan benar terlebih dahulu!"; "Peti Perak sudah diklaim!"; 50 "Berhasil membuka Peti Perak! Dapat 50 koin."), tier 3 (pvp_wins_today < 3 → "Menangkan 3 PvP Battle terlebih dahulu!"; "Peti Emas sudah diklaim!"; 100 + bonus "Berhasil membuka Peti Emas! Dapat 100 koin + Hadiah Misteri!"), lain → "Tier tidak valid"
- `claimMissionReward(email, tier)`: row tak ada → "Misi belum dimulai"; set tierX_claimed; coins += reward; tier 3 → decideMysteryRoll (<=50 +1 freeze " Bonus: 1 Streak Freeze!" / else double_xp 1 jam " Bonus: Double XP 1 Jam!")
- `claimMissionRewardAction(tier)`: getSession + delegasi

### Profile (lib/actions/profile.ts + view)
- `getPublicProfileAction(email)`: user (full_name, score) → "Pengguna tidak ditemukan"; stats (streak, longest, frame, title, color); badges; joined_date = "Member" (port setia)
- `equipFrameAction(value)` / `equipTitleAction` / `equipColorAction`: session-only (profil sendiri); "" → null; update user_engagement_stats
- View: header avatar (initial + frame classes mythic/diamond/gold/default + badge MYTHIC/DIAMOND/VIP), nama (color class + title badge), email, stats grid (Total Skor / Streak / Max Streak), badges section ("🏅 Lencana yang Diraih" + empty "Pengguna ini belum mengumpulkan lencana apapun."), own-only → "🎨 Ganti Kosmetik" modal (tabs Bingkai/Gelar/Warna, aktif "Dipakai" / "Pakai", default → "")

### Guide (/guide)
- Statis: "Panduan Lengkap LingoMind 🚀" + 9 kartu (teks per riset) + footer "Teruslah berlatih, pertahankan Streak Anda, dan jadilah Master Bahasa! 🔥"

### Dashboard (4a additions)
- Section "🏅 Badges / Lencana" (pill rows icon + name + description; hidden bila kosong)
- Section "📜 Quest Harian Bertingkat" (3 peti: Kayu 🪵 "Selesaikan 1 Kuis Apapun." progress "{quizzes}/1 Selesai" tombol "Klaim 20 Koin!" amber pulse; Perak 🥈 "Jawab 50 pertanyaan dengan benar hari ini." "{correct}/50 Benar" "Klaim 50 Koin!"; Emas 🥇 "Menangkan 3 PvP Battle hari ini." "{pvp}/3 Menang" "Klaim 100 Koin + Bonus!" yellow bounce; state Diklaim/Terkunci; sukses → pesan + refresh)
- Modal refill nyawa: tombol di kartu hearts (❤️ {hearts}/5) → modal "Isi Ulang Nyawa" (cost 60/nyawa, "Isi Ulang Sekarang", error strings persis)

### Navbar
- Link "Toko" → /shop (sebelum badge skor), "Panduan" → /guide; avatar profil (inisial dari full_name) → /profile/:email — Navbar butuh full_name (sudah ada di props)

## Testing
- vitest TDD (murni): evaluateBadgeMatches (3 jenis + threshold), decideMysteryRoll (4 batas), decideStreakRepair (5 kasus + pesan), decideTierRequirement (3 tier + claimed + invalid)
- Verifikasi: lint, tsc, build, migrate status; smoke read-only: shop_items count 18, badges count 3 (setelah seed)
- Smoke manual akhir oleh user (beli item, equip, klaim peti, refill nyawa)

## Di luar cakupan 4a
Leaderboard/liga, battle, social feed UI, analisis weakness, pets display, ad refill — 4b.
