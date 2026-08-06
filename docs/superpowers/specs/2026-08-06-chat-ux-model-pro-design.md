# Design: Chat UX (Modal Penjelasan, Sticky Input, Saran Collapsible) + Model Pro untuk Non-Stream

Tanggal: 2026-08-06
Status: Approved

## Ringkasan

Empat perubahan di halaman chat (`components/ChatView.tsx`) dan pemilihan model AI untuk jalur non-stream:

1. **Penjelasan → modal**: "Lihat Penjelasan" membuka `Dialog` (radix-ui) berisi analisis bahasa, menggantikan card inline yang di-expand per pesan.
2. **Input selalu di bawah**: baris input (beserta error & saran jawaban) dipindah ke dalam scroll container dan di-pin dengan `sticky bottom-0`, plus fallback `100vh` untuk container luar.
3. **Saran jawaban collapsible**: section "Saran jawaban" bisa di-collapse; default open, reset open tiap saran baru datang.
4. **Model deepseek-v4-pro untuk non-stream**: semua `generateText` di `lib/actions/chat.ts` memakai model pro; streaming (`app/api/chat/route.ts`) tetap flash.

## Perubahan file

### `lib/ai.ts`
- Tambah `export const modelPro = provider(process.env.OPENCODE_AI_MODEL_PRO || "deepseek-v4-pro")`.

### `lib/actions/chat.ts`
- Ganti `model` → `modelPro` di: `openSessionAction`, `sendPolyglotMessageAction`, `analyzeChatMessageAction`, `sendGeneralMessageAction` (4 call site `generateText` non-stream).

### `components/ChatView.tsx`
- Ganti state `expanded` per pesan dengan `analysisTarget: Message | null`; "Lihat Penjelasan" membuka `Dialog`; isi modal = konten card lama (skor, detailed_analysis, native_rephrasing, vocab_highlight + tombol Simpan), body `max-h-[70vh] overflow-y-auto`.
- Pindah `{error}`, section saran, dan baris input ke dalam `scrollRef` div dibungkus `sticky bottom-0 z-10 bg-background pt-3`.
- Outer container: tambah fallback `h-[calc(100vh_-_3.5rem_-_env(safe-area-inset-top))] supports-[height:100dvh]:h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))]`.
- State `suggestionsOpen` default `true`; tombol chevron di header "Saran jawaban"; reset ke open setiap saran baru.

### `lib/chat-helpers.ts`
- Tidak berubah.

### `.env.example` & `AGENTS.md`
- Tambah `OPENCODE_AI_MODEL_PRO=deepseek-v4-pro` (opsional, default `deepseek-v4-pro`).

## Keputusan

- Voice-chat ikut mendapat model pro (via `sendPolyglotMessageAction`) — konsisten, non-stream.
- Stream tetap flash agar balasan real-time cepat.
- Tanpa perubahan DB / migration.
