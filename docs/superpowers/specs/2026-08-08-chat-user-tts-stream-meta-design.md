# TTS Pesan User + Arti/Ucapan Pesan User dari Streaming di Chat

Tanggal: 2026-08-08
Status: Disetujui user

## Masalah

1. Pesan kita sendiri di chat tidak bisa didengarkan (tidak ada tombol TTS) — hanya bubble AI yang punya `SpeakButton`.
2. Arti (terjemahan Indonesia) & ucapan (romanisasi) pesan kita muncul **setelah** streaming selesai **dan** analisis selesai (panggilan AI kedua non-streaming `analyzeChatMessageAction`) — muncul ~1-2 detik lebih lambat dari balasan, padahal bisa langsung dari streaming (sejajar dengan romanisasi balasan yang sudah tampil saat stream selesai).

## Keputusan (dari brainstorming)

- **TTS pesan user**: tombol suara (`SpeakButton`, ikon Volume2) di samping kanan bubble pesan kita, `lang={ttsLang}` (sama seperti bubble AI), berlaku di semua mode (polyglot + general).
- **Arti & ucapan dari streaming**: format stream diperluas — AI juga emit romanisasi + arti pesan USER sebelum balasan. Tampil saat stream selesai (timing sama dengan romanisasi balasan hari ini), tanpa menunggu panggilan analisis.
- Nilai streaming **menang** atas hasil analisis untuk arti/ucapan pesan user (analisis fallback bila streaming kosong).

## Perubahan

### 1. Format stream (prompt `buildPolyglotStreamPrompt`, lib/ai-content/chat.ts)

Format baru, marker di awal baris dengan isi menyusul di baris yang sama:

```
||UROM||<romanisasi pesan user>      ← HANYA bahasa non-Latin (NON_LATIN_LANGUAGES); Latin: baris ini ditiadakan
||UTRANS||<arti pesan user dalam Bahasa Indonesia>   ← semua bahasa
<balasan AI>
||ROM||<romanisasi balasan>          ← format lama (non-Latin), dipertahankan
```

Aturan prompt baru (non-Latin):
- AWALI balasan dengan baris `||UROM||` + romanisasi pesan USER huruf Latin (baris sama; bila kosong, baris berikutnya).
- Setelah itu baris `||UTRANS||` + arti pesan USER dalam Bahasa Indonesia (baris sama).
- Bahasa Latin: JANGAN sertakan `||UROM||` — mulai langsung dari `||UTRANS||`.
- Aturan `||ROM||` balasan tetap seperti sekarang.

### 2. Parser murni `parseStreamedSections` (lib/chat-helpers.ts + test)

```ts
export interface ParsedStreamSections {
  userRomanization?: string;
  userTranslation?: string;
  replyText: string;
  replyRomanization?: string;
}
export function parseStreamedSections(acc: string): ParsedStreamSections
```

- Scan baris demi baris; baris yang dimulai `||UROM||` / `||UTRANS||` / `||ROM||` → isi = sisa baris; bila sisa kosong → ambil baris berikutnya (kompatibel format lama `\n||ROM||\nrom`).
- `replyText` = semua teks setelah seksi user, sebelum `||ROM||`.
- Lenient: tanpa marker → seluruh teks = `replyText`; semua hasil di-trim.
- Menggantikan `acc.split("||ROM||")` di ChatView (ChatView.tsx:284 dan 586).

Vitest (`lib/chat-helpers.test.ts`): format lengkap 3 marker; Latin (tanpa UROM/ROM, dengan UTRANS); marker kosong + isi di baris berikut; teks polos general; whitespace; reply kosong/trim.

### 3. ChatView (components/ChatView.tsx)

- Setelah stream selesai (sekitar baris 273-276): `const parsed = parseStreamedSections(acc)`; `replyText = parsed.replyText`; `romanization = parsed.replyRomanization`; lalu langsung update pesan user:
  ```tsx
  if (parsed.userRomanization || parsed.userTranslation) {
    setMessages((m) => m.map((msg) =>
      msg.id === userMsgId
        ? { ...msg, romanization: parsed.userRomanization ?? msg.romanization, translation: parsed.userTranslation ?? msg.translation }
        : msg
    ));
  }
  ```
- Map hasil analisis (baris 340-344 & 381-385): ubah menjadi `msg.romanization || res.analysis.user_message_romanization` (streaming menang, analisis fallback).
- Bubble streaming (baris 586): tampilkan `parseStreamedSections(streamingText).replyText` (hindari marker mentah di layar).
- Bubble user (baris 520-531): bungkus baris konten dengan flex, `SpeakButton` di samping kanan bubble:
  ```tsx
  <div className="flex items-start gap-2 max-w-[80%]">
    <div dir="auto" className="px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">…</div>
    <SpeakButton text={m.content} lang={ttsLang} />
  </div>
  ```
  Baris romanization/translation di bawah tetap `max-w-[80%]`. `ttsLang` sudah ada (baris 95); `SpeakButton` sudah diimport.

### 4. Tes prompt (lib/ai-content/chat.test.ts)

- Non-Latin: instructions memuat `||UROM||` dan `||UTRANS||`.
- Latin: instructions memuat `||UTRANS||`, TIDAK memuat `||UROM||`.
- General (`buildGeneralStreamPrompt`): tetap tanpa ketiga marker.

## Di luar scope

- Voice-chat (`/voice-chat/:goal`) — tidak diubah.
- Auto-play TTS setelah kirim.
- Format pesan tersimpan di DB (history lama tetap dari `analysisJson`).
- Mode general tidak mendapat arti/ucapan streaming (tanpa analisis) — hanya TTS tombol.

## Testing

- `lib/chat-helpers.test.ts` (parser), `lib/ai-content/chat.test.ts` (prompt) — `npm test`.
- `npx tsc --noEmit`, `npm run lint`.
- Manual: kirim pesan bahasa non-Latin (Jepang) → saat stream selesai, bubble user langsung menampilkan ucapan + arti; tombol suara di bubble user berbunyi; bahasa Latin (English) → arti tampil, ucapan tidak; mode general → hanya tombol suara.
