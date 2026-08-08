# TTS Pesan User + Arti/Ucapan Pesan User dari Streaming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pesan kita di chat bisa didengarkan (TTS) dan arti+ucapan pesan kita tampil langsung dari streaming AI (bukan menunggu analisis kedua).

**Architecture:** Format stream mode bahasa diperluas — AI emit `||UROM||` (romanisasi pesan user, non-Latin saja) dan `||UTRANS||` (arti pesan user, semua bahasa) sebelum balasan; parser murni `parseStreamedSections` di `lib/chat-helpers.ts` memisahkan seksi; ChatView memakai hasil parse untuk menampilkan arti/ucapan pesan user saat stream selesai dan menambah tombol suara di bubble user.

**Tech Stack:** Next.js App Router, `ai` (streamText), TypeScript, vitest, shadcn/ui, lucide-react, Web Speech `/api/tts` via `SpeakButton`/`voice-tts.ts`.

**Spec:** `docs/superpowers/specs/2026-08-08-chat-user-tts-stream-meta-design.md`

## Global Constraints

- UI & pesan **bahasa Indonesia**; string error lama wajib dipertahankan
- Format stream: marker `||UROM||` (non-Latin saja), `||UTRANS||` (semua bahasa), `||ROM||` (non-Latin, format lama) — marker di AWAL baris, isi di baris yang sama (bila kosong → baris berikutnya)
- Urutan seksi: `||UROM||` → `||UTRANS||` → balasan → `||ROM||`; `parseStreamedSections` lenient (tanpa marker = seluruh teks jadi `replyText`)
- Nilai streaming menang atas analisis untuk arti/ucapan pesan user (`msg.romanization || analysis...`)
- General mode: TANPA marker; hanya dapat tombol TTS (tanpa arti/ucapan streaming)
- Fungsi murni diuji vitest (`*.test.ts` di `lib/`); verifikasi: `npx tsc --noEmit`, `npm run lint`, `npm test`
- Jangan sentuh file unrelated di working tree (ada modified `docs/superpowers/plans/2026-08-05-chat-scenarios-history-pwa.md` + untracked `CLAUDE.md` — TIDAK boleh di-commit); jangan commit `.env`

---

### Task 1: Parser murni `parseStreamedSections` + test

**Files:**
- Modify: `lib/chat-helpers.ts` (tambah fungsi di akhir file)
- Test: `lib/chat-helpers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ParsedStreamSections {
    userRomanization?: string;
    userTranslation?: string;
    replyText: string;
    replyRomanization?: string;
  }
  export function parseStreamedSections(acc: string): ParsedStreamSections
  ```

- [ ] **Step 1: Write the failing tests**

Tambahkan di akhir `lib/chat-helpers.test.ts` (import `parseStreamedSections` dari `"./chat-helpers"`):

```ts
describe("parseStreamedSections", () => {
  it("memisahkan userRomanization, userTranslation, replyText, replyRomanization (format lengkap)", () => {
    const result = parseStreamedSections(
      "||UROM||annyeonghaseyo\n||UTRANS||Halo\n안녕하세요! 어떻게 지내요?\n||ROM||\nannyeonghaseyo! eotteoke jinaeyo?"
    );
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요! 어떻게 지내요?",
      replyRomanization: "annyeonghaseyo! eotteoke jinaeyo?",
    });
  });

  it("bahasa Latin: hanya ||UTRANS|| (tanpa UROM/ROM)", () => {
    const result = parseStreamedSections("||UTRANS||Halo\nHi there! How are you?");
    expect(result).toEqual({
      userTranslation: "Halo",
      replyText: "Hi there! How are you?",
    });
    expect(result.userRomanization).toBeUndefined();
    expect(result.replyRomanization).toBeUndefined();
  });

  it("marker dengan isi kosong → ambil baris berikutnya (format lama ||ROM||)", () => {
    const result = parseStreamedSections("안녕하세요!\n||ROM||\nannyeonghaseyo!");
    expect(result).toEqual({
      replyText: "안녕하세요!",
      replyRomanization: "annyeonghaseyo!",
    });
  });

  it("||UROM|| dengan isi kosong → ambil baris berikutnya", () => {
    const result = parseStreamedSections("||UROM||\nannyeonghaseyo\n||UTRANS||Halo\n안녕하세요!");
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요!",
    });
  });

  it("tanpa marker sama sekali → seluruh teks jadi replyText (general/polos)", () => {
    const result = parseStreamedSections("Halo, silakan tanya apa saja!");
    expect(result).toEqual({ replyText: "Halo, silakan tanya apa saja!" });
  });

  it("trim whitespace pada tiap seksi", () => {
    const result = parseStreamedSections("||UTRANS||   Halo   \n  Balasan.  \n");
    expect(result).toEqual({ userTranslation: "Halo", replyText: "Balasan." });
  });

  it("replyText kosong bila tidak ada isi", () => {
    const result = parseStreamedSections("");
    expect(result).toEqual({ replyText: "" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/chat-helpers.test.ts`
Expected: FAIL (function not defined)

- [ ] **Step 3: Write minimal implementation**

Tambahkan di akhir `lib/chat-helpers.ts`:

```ts
export interface ParsedStreamSections {
  userRomanization?: string;
  userTranslation?: string;
  replyText: string;
  replyRomanization?: string;
}

export function parseStreamedSections(acc: string): ParsedStreamSections {
  const lines = acc.split("\n");
  let userRomanization: string | undefined;
  let userTranslation: string | undefined;
  let replyRomanization: string | undefined;
  const replyLines: string[] = [];
  const romLines: string[] = [];
  let mode: "before" | "reply" | "rom" = "before";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (mode !== "rom" && line.startsWith("||ROM||")) {
      mode = "rom";
      const rest = line.slice("||ROM||".length);
      if (rest.trim()) {
        romLines.push(rest);
      } else if (lines[i + 1] !== undefined) {
        romLines.push(lines[i + 1]);
        i += 1;
      }
      continue;
    }

    if (mode === "before") {
      if (line.startsWith("||UROM||")) {
        const rest = line.slice("||UROM||".length);
        if (rest.trim()) {
          userRomanization = rest.trim();
        } else if (lines[i + 1] !== undefined) {
          userRomanization = lines[i + 1].trim() || undefined;
          i += 1;
        }
        continue;
      }
      if (line.startsWith("||UTRANS||")) {
        const rest = line.slice("||UTRANS||".length);
        if (rest.trim()) {
          userTranslation = rest.trim();
        } else if (lines[i + 1] !== undefined) {
          userTranslation = lines[i + 1].trim() || undefined;
          i += 1;
        }
        continue;
      }
      mode = "reply";
    }

    if (mode === "reply") {
      replyLines.push(line);
    } else if (mode === "rom") {
      romLines.push(line);
    }
  }

  return {
    ...(userRomanization ? { userRomanization } : {}),
    ...(userTranslation ? { userTranslation } : {}),
    replyText: replyLines.join("\n").trim(),
    ...(romLines.length > 0 ? { replyRomanization: romLines.join("\n").trim() } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/chat-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Full verification + commit**

Run: `npm test`
Expected: PASS (semua)
Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS

```bash
git add lib/chat-helpers.ts lib/chat-helpers.test.ts
git commit -m "feat: parser parseStreamedSections untuk seksi ||UROM||/||UTRANS||/||ROM||"
```

---

### Task 2: Prompt streaming diperluas + test

**Files:**
- Modify: `lib/ai-content/chat.ts:120-129` (`buildPolyglotStreamPrompt` blok "Aturan:")
- Test: `lib/ai-content/chat.test.ts` (describe `buildPolyglotStreamPrompt`)

**Interfaces:**
- Consumes: `parseStreamedSections` (Task 1) — klien akan mem-parsing output baru ini
- Produces: `buildPolyglotStreamPrompt(userMessage, language, level, scenario, history)` — format output baru: `||UROM||` (non-Latin) → `||UTRANS||` → balasan → `||ROM||` (non-Latin)

- [ ] **Step 1: Write the failing tests**

Di `lib/ai-content/chat.test.ts`, di dalam describe `buildPolyglotStreamPrompt` (setelah test "tidak menyertakan pemisah romanisasi untuk bahasa Latin", baris 109-112), tambah:

```ts
  it("menyertakan pemisah ||UROM|| dan ||UTRANS|| untuk bahasa non-Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("안녕하세요", "Korean", "A1", "Restaurant", []);
    expect(instructions).toContain("||UROM||");
    expect(instructions).toContain("||UTRANS||");
  });

  it("menyertakan ||UTRANS|| tanpa ||UROM|| untuk bahasa Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", []);
    expect(instructions).toContain("||UTRANS||");
    expect(instructions).not.toContain("||UROM||");
  });
```

Lalu pada test `buildGeneralStreamPrompt` (baris 123), ganti `expect(instructions).not.toContain("||ROM||");` menjadi tiga baris:

```ts
    expect(instructions).not.toContain("||ROM||");
    expect(instructions).not.toContain("||UROM||");
    expect(instructions).not.toContain("||UTRANS||");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL (assertions ||UROM||/||UTRANS|| belum ada di prompt)

- [ ] **Step 3: Write minimal implementation**

Di `lib/ai-content/chat.ts`, ganti blok "Aturan:" di `buildPolyglotStreamPrompt` (baris 120-129) menjadi:

```ts
      "Aturan:",
      `- Balas TANPA JSON, tanpa markdown, tanpa label — hanya teks polos dalam bahasa ${language}.`,
      ...(isNonLatin
        ? [
            "- AWALI balasan dengan baris '||UROM||' lalu romanisasi pesan USER (pesan yang baru dikirim) dengan huruf Latin pada baris yang sama. Contoh: '||UROM||annyeonghaseyo'.",
          ]
        : []),
      "- Setelah baris ||UROM|| (atau langsung di awal untuk bahasa Latin), tambahkan baris '||UTRANS||' lalu arti pesan USER dalam Bahasa Indonesia pada baris yang sama. Contoh: '||UTRANS||Halo, apa kabar?'.",
      ...(isNonLatin
        ? [
            "- Setelah balasan, tambahkan baris baru, lalu pemisah persis ||ROM||, lalu cara baca (romanisasi) SELURUH balasan tersebut dengan huruf Latin. Contoh: '안녕하세요!\\n||ROM||\\nannyeonghaseyo!'",
          ]
        : []),
      "- Setiap pemisah (||UROM||, ||UTRANS||, ||ROM||) harus berada di AWAL baris; isinya langsung menyusul di baris yang sama (bila kosong, letakkan di baris berikutnya). Hanya gunakan pemisah tersebut sesuai aturan di atas — tidak ada teks lain di luar balasan.",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: PASS

- [ ] **Step 5: Full verification + commit**

Run: `npm test` → PASS; `npx tsc --noEmit` → PASS; `npm run lint` → PASS

```bash
git add lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: prompt streaming emit ||UROM||/||UTRANS|| arti+ucapan pesan user"
```

---

### Task 3: ChatView — parse stream, arti/ucapan user, tombol TTS di bubble user

**Files:**
- Modify: `components/ChatView.tsx:9` (import chat-helpers), `components/ChatView.tsx:273-276` (parse setelah stream), `components/ChatView.tsx:340-344` (map sendPolyglot), `components/ChatView.tsx:381-385` (map analyze), `components/ChatView.tsx:520-531` (bubble user + SpeakButton), `components/ChatView.tsx:586` (bubble streaming)

**Interfaces:**
- Consumes: `parseStreamedSections` dari `@/lib/chat-helpers` (Task 1); `SpeakButton` sudah diimport (ChatView.tsx:12); `ttsLang` sudah ada (ChatView.tsx:95)

- [ ] **Step 1: Tambah import**

Di `components/ChatView.tsx:9`, ganti import chat-helpers menjadi:

```tsx
import { normalizeSuggestedReplies, parseStreamedSections, type SuggestedReply } from "@/lib/chat-helpers";
```

- [ ] **Step 2: Parse hasil stream + set arti/ucapan pesan user**

Di `components/ChatView.tsx` (sebelumnya baris 273-276), ganti:

```tsx
    const parts = acc.split("||ROM||");
    const replyText = (parts[0] ?? "").trim();
    const romanization = (parts[1] ?? "").trim();
    setStreamingRomanization(romanization);
```

menjadi:

```tsx
    const parsed = parseStreamedSections(acc);
    const replyText = parsed.replyText;
    const romanization = parsed.replyRomanization ?? "";
    setStreamingRomanization(romanization);
    if (parsed.userRomanization || parsed.userTranslation) {
      setMessages((m) => m.map((msg) =>
        msg.id === userMsgId
          ? {
              ...msg,
              romanization: parsed.userRomanization ?? msg.romanization,
              translation: parsed.userTranslation ?? msg.translation,
            }
          : msg
      ));
    }
```

- [ ] **Step 3: Streaming menang atas analisis (dua lokasi map)**

**3a.** Di blok sukses `sendPolyglotMessageAction` (sebelumnya baris 340-344), ganti:

```tsx
            ? { ...msg, romanization: res.analysis.user_message_romanization || msg.romanization, translation: res.analysis.user_message_translation_in_indonesian || msg.translation }
```

menjadi:

```tsx
            ? { ...msg, romanization: msg.romanization || res.analysis.user_message_romanization, translation: msg.translation || res.analysis.user_message_translation_in_indonesian }
```

**3b.** Di blok sukses `analyzeChatMessageAction` (sebelumnya baris 381-385), ganti dengan kode yang sama persis seperti 3a.

- [ ] **Step 4: Bubble streaming pakai parser**

Di `components/ChatView.tsx` (sebelumnya baris 586), ganti:

```tsx
                  {isGeneral ? <MarkdownContent content={streamingText.includes("||ROM||") ? streamingText.split("||ROM||")[0] : streamingText} /> : streamingText.includes("||ROM||") ? streamingText.split("||ROM||")[0] : streamingText}
```

menjadi:

```tsx
                  {isGeneral ? <MarkdownContent content={streamingText} /> : parseStreamedSections(streamingText).replyText}
```

- [ ] **Step 5: Tombol TTS di bubble user**

Di `components/ChatView.tsx` (sebelumnya baris 521-524), ganti blok bubble user:

```tsx
              <div key={m.id} className="flex flex-col items-end gap-1">
                <div dir="auto" className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
```

menjadi:

```tsx
              <div key={m.id} className="flex flex-col items-end gap-1">
                <div className="flex items-start gap-2 max-w-[80%]">
                  <div dir="auto" className="px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                  <SpeakButton text={m.content} lang={ttsLang} />
                </div>
```

(Baris romanization/translation di bawah — sebelumnya baris 525-530 — tetap tidak berubah.)

- [ ] **Step 6: Verifikasi**

Run: `npx tsc --noEmit` → PASS; `npm run lint` → PASS; `npm test` → PASS

- [ ] **Step 7: Verifikasi manual (dev server — catat hasil, jangan ubah kode atas dasar hasil ini)**

Run: `npm run dev` → buka `/chat?session=...`:
1. Mode bahasa non-Latin (mis. Jepang): kirim pesan → saat streaming selesai, bubble pesan kita LANGSUNG menampilkan ucapan (baris Baca) + arti (baris Arti) — tanpa menunggu "Menerjemahkan & menganalisis..." selesai.
2. Tombol suara (Volume2) di samping kanan bubble pesan kita → berbunyi saat diklik.
3. Mode bahasa Latin (English): arti tampil, ucapan tidak (tidak ada baris Baca).
4. Mode general: hanya tombol suara di bubble user; tidak ada arti/ucapan.
5. History session (muat ulang halaman): pesan lama tetap menampilkan arti/ucapan dari analysisJson seperti sebelumnya.

- [ ] **Step 8: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: TTS pesan user + arti/ucapan pesan user dari streaming di chat"
```
