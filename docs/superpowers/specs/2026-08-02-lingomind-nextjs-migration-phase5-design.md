# Migrasi LingoMind ke Next.js — Fase 5: Admin Panels

Tanggal: 2026-08-02
Status: Disetujui (desain), menunggu rencana implementasi

## Latar belakang

Fase 1-4b selesai (auth, belajar inti, AI interaktif, gamifikasi lengkap). Fase 5 memport panel admin legacy (5 tab + login) ke Next.js dengan guard role berbasis session (pengganti pola email-as-arg legacy).

## Tujuan Fase 5

1. **Route group `app/(admin)/`**: layout sendiri (sidebar LingoAdmin + topbar), di luar navbar user; middleware melindungi `/admin/*` (session + role admin).
2. **Admin login** `/admin/login`: reuse `loginAction` + cek role (`"Akses ditolak. Anda bukan admin."`).
3. **5 panel**: Konfigurasi (app_config + mission_config), Toko (CRUD tanpa delete), Bahasa (CRUD + edge_tts_voice), Kurikulum (levels + topics), Pengguna (list/search, edit stats, reset progress, toggle role).
4. **Guard**: `requireAdmin()` helper (getSession + role check, string `"Akses ditolak."`) di semua server actions admin.

## Keputusan arsitektur (hasil brainstorming)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Guard | `getSession()` + role check per action (helper requireAdmin) | Konvensi repo; pengganti email-as-arg legacy |
| Route structure | `app/(admin)/admin/[tab]/page.tsx` + middleware | Parity routes legacy (/admin/:tab); group terpisah tanpa navbar user |
| Panel | 5 tab (konfigurasi/toko/bahasa/kurikulum/pengguna), default konfigurasi | Parity legacy (tanpa stats dashboard) |
| Delete fn | Tidak ada (parity) | Legacy tidak punya |
| edge_tts_voice | Ditambahkan di form Bahasa (perbaikan kecil) | Kolom dipakai voice chat; legacy tak mengelola |
| Reset progress | Transaksi 13 tabel + score 0 (chat_messages TIDAK dihapus) | Parity persis legacy |

## Arsitektur

```
app/(admin)/layout.tsx            # guard session+role → AdminShell (sidebar+topbar)
app/(admin)/admin/login/page.tsx  # AdminLoginForm (client)
app/(admin)/admin/[tab]/page.tsx  # server wrapper → panel per tab
components/admin/AdminLoginForm.tsx, AdminShell.tsx
components/admin/AdminConfigPanel.tsx, AdminShopPanel.tsx, AdminLanguagePanel.tsx,
  AdminCurriculumPanel.tsx, AdminUsersPanel.tsx
lib/auth.ts           # tambah requireAdmin()
lib/admin.ts          # 17 fn port (query + transaksi)
lib/actions/admin.ts  # server actions (guard requireAdmin)
middleware.ts         # + /admin guard
```

## Perilaku yang diport (sumber: riset dioxus/src/services/admin.rs)

### Guard & auth
- `requireAdmin()`: getSession → null → redirect `/admin/login` (layout) atau `{ error: "Akses ditolak." }` (action); role !== "admin" → sama
- Login: `loginAction` → profil.role !== "admin" → `"Akses ditolak. Anda bukan admin."`; sukses → panel konfigurasi
- Layout admin: sidebar w-64 (logo + "LingoAdmin" + "Enterprise", 5 tab, footer "LingoMind v1.0.0"), topbar (judul tab + avatar + "Aplikasi Utama" + "Logout"); content max-w-7xl

### Panel Konfigurasi
- app_config: list (key, value, description), edit value (key disabled); simpan → update
- mission_config: list (name, 5 target), edit numeric (parse fallback ke nilai asli); update
- Strings: "Sistem Konfigurasi Utama", "Konfigurasi Misi Harian", "Edit Konfigurasi", "Edit Misi Harian", "Simpan Perubahan"

### Panel Toko
- List ORDER BY cost; Tambah/Edit modal (Ikon default 🎁, Harga default 10, Nama, Tipe Efek free-text placeholder "e.g. shield, streak_freeze, double_xp", Deskripsi); simpan disabled bila nama kosong
- Strings: "Katalog Toko", "Tambah Item", "Edit Item Toko"/"Tambah Item Toko", "Menyimpan...", "Batal", "Simpan"

### Panel Bahasa
- List ORDER BY name; Tambah/Edit modal (Bendera default 🌐, Kode ID disabled saat edit, Nama, Nama Asli, Kategori default Eropa, Kode TTS Voice, CSS Kelas Tema default bg-indigo-500, CSS Kelas Tombol, Deskripsi, + Edge TTS Voice — perbaikan); simpan disabled bila id/nama kosong
- Strings: "Katalog Bahasa", "Tambah Bahasa", "Edit Katalog Bahasa"/"Tambah Katalog Bahasa"

### Panel Kurikulum
- Dua pane: levels kiri (list ORDER BY order_index, Tambah/Edit: Kode disabled saat edit, Nama, Base Reward default 100, Order Index, Deskripsi), topics kanan (list per level ORDER BY order_index, Tambah/Edit: Level display, Nama Topik, Order Index); level pertama auto-select; empty states
- Strings: "Levels (CEFR)", "Daftar Topik: ", "Tambah Topik", "Belum ada level.", "Tidak ada topik ditemukan di level ini.", "Pilih salah satu Level di sebelah kiri..."

### Panel Pengguna
- List ORDER BY email (email, full_name, role, is_verified, score, coins, streak) + search client-side (email/nama contains, case-insensitive; "Cari email atau nama...", "Tidak ada pengguna yang cocok.")
- Edit Stats modal (Coins + Streak) → update_user_stats (upsert: coins, current_streak, longest_streak = GREATEST)
- Reset → reset_user_progress (tx deleteMany 13 tabel + update users score 0 preferred_language English)
- Role toggle → "Jadikan Admin"/"Cabut Admin"
- Strings: "Edit Stats", "Reset", "Simpan", "Batal", "Memuat Data Pengguna..."

## Testing
- vitest TDD: requireAdmin (pure-ish — mock getSession? requireAdmin pakai getSession dari lib/auth yang pakai cookies — test via fungsi murni pembantu? — pisahkan `isAdminRole(role)` murni + test; requireAdmin DB-dependent tidak di-unit-test)
- Verifikasi: lint, tsc, build, migrate status; smoke read-only DB
- Smoke manual akhir oleh user (login admin → 5 panel → edit/add/reset/toggle)

## Di luar cakupan
Fase 6 (cron + deploy Vercel + cutover); delete-user fn; admin stats dashboard; search server-side.
