# Arti + Bacaan Balasan AI dari Streaming di Chat

Tanggal: 2026-08-08
Status: Disetujui user

## Masalah

Arti (terjemahan Indonesia) dan bacaan (romanisasi) **balasan AI** di chat hanya tampil setelah fase "Menerjemahkan & menganalisis..." selesai — padahal balasan teksnya sudah streaming. Romanisasi balasan memang tampil di fase analyzing (dari `||ROM||`), tapi arti balasan sama sekali tidak ada sampai analisis selesai (`reply_translation_in_indonesian` dari panggilan AI kedua non-streaming).

## Keputusan (dari brainstorming)

- **Arti balasan AI** ikut keluar dari streaming lewat marker baru `||RTRANS||` (semua bahasa), di posisi setelah balasan, sebelum `||ROM||`.
- **Bacaan balasan AI** (`||ROM||`) sudah dari streaming — perbaikan hanya memastikan nilai streaming menang atas analisis di bubble final (konsisten dengan arti/ucapan pesan user).
- Format stream final: `||UROM||` (non-Latin) → `||UTRANS||` (semua) → balasan → `||RTRANS||` (semua) → `||ROM||` (non-Latin).
- Fase "Menerjemahkan & menganalisis..." tetap ada untuk skor/koreksi/vocab/saran — tidak diubah.

## Perubahan

### 1. Format stream (prompt `buildPolyglotStreamPrompt`, lib/ai-content/chat.ts)

Tambah aturan baru setelah aturan `||UTRANS||` (sebelum aturan `||ROM||`):

```
- Setelah balasan, tambahkan baris '||RTRANS||' lalu arti balasan dalam Bahasa Indonesia pada baris yang sama. Contoh: '||RTRANS||Halo, saya minta kopi.'
```

Urutan instruksi final: `||UROM||` → `||UTRANS||` → balasan → `||RTRANS||` → `||ROM||`. Aturan "Setiap pemisah..." diperbarui daftar markernya menjadi `||UROM||`, `||UTRANS||`, `||RTRANS||`, `||ROM||` (varian Latin tanpa `||UROM||`/`||ROM||`).

### 2. Parser `parseStreamedSections` (lib/chat-helpers.ts)

- Interface tambah field: `replyTranslation?: string`.
- Kenali marker `||RTRANS||` (awal baris, isi baris sama; kosong → baris berikutnya).
- Ubah perilaku mode setelah reply: `||ROM||` tidak lagi menyerap SEMUA baris setelahnya — baris marker lain (`||RTRANS||`) tetap dikenali meski muncul setelah `||ROM||` (robust terhadap urutan RTRANS/ROM dibalik AI).
- Implementasi: mode `"before" | "reply" | "after"`; di mode `after`, baris berawalan `||RTRANS||`/`||ROM||` masuk section masing-masing, baris biasa masuk section yang terakhir aktif (rtrans atau rom).
- Tetap lenient: tanpa marker → seluruh teks `replyText`; semua seksi di-trim; kompatibel format lama `\n||ROM||\nrom`.

Vitest (`lib/chat-helpers.test.ts`): format lengkap 4 marker (UROM/UTRANS/RTRANS/ROM); Latin (UTRANS + RTRANS, tanpa UROM/ROM); urutan terbalik ROM sebelum RTRANS tetap terpisah benar; marker kosong → baris berikutnya (UROM & ROM); polos; trim; kosong. Test lama tetap hijau (format lama masih bekerja).

### 3. ChatView (components/ChatView.tsx)

- State baru `streamingReplyTranslation` (string) — di-set saat stream selesai dari `parsed.replyTranslation ?? ""`, dipakai bubble streaming saat analyzing DAN bubble final (nilai streaming menang).
- Saat stream selesai: `streamingReplyTranslation = parsed.replyTranslation ?? ""`.
- Bubble streaming saat analyzing: tampilkan `Arti:` (TranslationLine) dari `streamingReplyTranslation`, sejajar dengan `Baca:` (RomanizationLine) yang sudah ada (baris ~605).
- Bubble final (blok sukses `analyzeChatMessageAction`): nilai streaming menang atas analisis:
  - `translation: streamingReplyTranslation || res.analysis.reply_translation_in_indonesian`
  - `romanization: romanization || res.analysis.reply_romanization` (ubah prioritas dari yang sekarang: analisis menang)
  - (untuk `sendPolyglotMessageAction` — fallback stream kosong — tidak ada nilai stream; biarkan seperti sekarang)
- Blok `!replyText` (stream kosong) tidak berubah.

### 4. Tes prompt (lib/ai-content/chat.test.ts)

- Non-Latin: instructions memuat `||RTRANS||`.
- Latin: memuat `||RTRANS||`, tidak memuat `||UROM||`/`||ROM||`.
- General: tetap tanpa keempat marker (`||RTRANS||` juga tidak ada).

## Di luar scope

- Voice-chat; auto-play TTS; format pesan tersimpan di DB; fase analisis (skor/koreksi/vocab/saran); arti live per-kata saat balasan masih mengetik (marker `||RTRANS||` di akhir balasan → arti lengkap saat stream selesai, sama seperti romanisasi).

## Testing

- `lib/chat-helpers.test.ts` (parser), `lib/ai-content/chat.test.ts` (prompt) — `npm test`.
- `npx tsc --noEmit`, `npm run lint`.
- Manual: kirim pesan (English & Jepang) → saat streaming selesai, bubble AI langsung menampilkan baris Arti + Baca tanpa menunggu analisis; bubble final nilai sama (tidak ada perubahan visual saat analisis selesai).
