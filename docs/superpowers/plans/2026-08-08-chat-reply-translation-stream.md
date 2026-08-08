# Arti + Bacaan Balasan AI dari Streaming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arti (terjemahan Indonesia) dan bacaan (romanisasi) balasan AI tampil langsung dari stream saat streaming selesai, tanpa menunggu fase "Menerjemahkan & menganalisis...".

**Architecture:** Format stream mode bahasa diperluas dengan marker `||RTRANS||` (arti balasan, semua bahasa) di antara balasan dan `||ROM||`; parser `parseStreamedSections` dikembangkan (field `replyTranslation`, mode `after`, robust terhadap urutan RTRANS/ROM); ChatView menyimpan `streamingReplyTranslation` dari parse, menampilkannya di bubble streaming saat analyzing, dan bubble final memakai nilai streaming menang atas analisis.

**Tech Stack:** Next.js App Router, `ai` (streamText), TypeScript, vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-08-chat-reply-translation-stream-design.md`

## Global Constraints

- UI & pesan **bahasa Indonesia**; string error lama wajib dipertahankan
- Format stream: `||UROM||` (non-Latin) → `||UTRANS||` (semua) → balasan → `||RTRANS||` (semua) → `||ROM||` (non-Latin); marker di AWAL baris, isi di baris sama (kosong → baris berikutnya)
- Parser lenient: tanpa marker = seluruh teks `replyText`; kompatibel format lama `\n||ROM||\nrom`; semua seksi di-trim
- Latin: prompt TIDAK menyebut `||UROM||`/`||ROM||`, tapi menyebut `||UTRANS||` DAN `||RTRANS||`; general TANPA keempat marker
- Nilai streaming menang atas analisis untuk rom/trans balasan di bubble final
- Fungsi murni diuji vitest (`*.test.ts` di `lib/`); verifikasi: `npx tsc --noEmit`, `npm run lint`, `npm test`
- Jangan sentuh file unrelated di working tree (ada modified `docs/superpowers/plans/2026-08-05-chat-scenarios-history-pwa.md` + untracked `CLAUDE.md` — TIDAK boleh di-commit); jangan commit `.env`

---

### Task 1: Parser `parseStreamedSections` + `||RTRANS||` + test

**Files:**
- Modify: `lib/chat-helpers.ts:51-118` (interface + fungsi parser)
- Test: `lib/chat-helpers.test.ts`

**Interfaces:**
- Produces (kontrak Task 3):
  ```ts
  export interface ParsedStreamSections {
    userRomanization?: string;
    userTranslation?: string;
    replyText: string;
    replyTranslation?: string;
    replyRomanization?: string;
  }
  export function parseStreamedSections(acc: string): ParsedStreamSections
  ```
  Semua field dan perilaku lama TIDAK berubah; hanya tambah `replyTranslation` + kenali `||RTRANS||`.

- [ ] **Step 1: Write the failing tests**

Tambahkan di akhir describe `parseStreamedSections` di `lib/chat-helpers.test.ts`:

```ts
  it("memisahkan replyTranslation dari ||RTRANS|| (format lengkap 4 marker)", () => {
    const result = parseStreamedSections(
      "||UROM||annyeonghaseyo\n||UTRANS||Halo\n안녕하세요!\n||RTRANS||Halo!\n||ROM||\nannyeonghaseyo!"
    );
    expect(result).toEqual({
      userRomanization: "annyeonghaseyo",
      userTranslation: "Halo",
      replyText: "안녕하세요!",
      replyTranslation: "Halo!",
      replyRomanization: "annyeonghaseyo!",
    });
  });

  it("bahasa Latin: ||UTRANS|| + ||RTRANS|| tanpa UROM/ROM", () => {
    const result = parseStreamedSections("||UTRANS||Halo\nHi there!\n||RTRANS||Halo juga!");
    expect(result).toEqual({
      userTranslation: "Halo",
      replyText: "Hi there!",
      replyTranslation: "Halo juga!",
    });
    expect(result.userRomanization).toBeUndefined();
    expect(result.replyRomanization).toBeUndefined();
  });

  it("||RTRANS|| tetap dikenali walau muncul SETELAH ||ROM|| (urutan dibalik AI)", () => {
    const result = parseStreamedSections("안녕!\n||ROM||\nannyeong!\n||RTRANS||Halo!");
    expect(result).toEqual({
      replyText: "안녕!",
      replyRomanization: "annyeong!",
      replyTranslation: "Halo!",
    });
  });

  it("||RTRANS|| dengan isi kosong → ambil baris berikutnya", () => {
    const result = parseStreamedSections("Hi!\n||RTRANS||\nHalo!");
    expect(result).toEqual({
      replyText: "Hi!",
      replyTranslation: "Halo!",
    });
  });

  it("format lama tetap bekerja: balasan lalu ||ROM|| (tanpa RTRANS)", () => {
    const result = parseStreamedSections("안녕하세요!\n||ROM||\nannyeonghaseyo!");
    expect(result).toEqual({
      replyText: "안녕하세요!",
      replyRomanization: "annyeonghaseyo!",
    });
    expect(result.replyTranslation).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/chat-helpers.test.ts`
Expected: FAIL (field `replyTranslation` tidak ada / `||RTRANS||` tidak dikenali)

- [ ] **Step 3: Write minimal implementation**

Ganti SELURUH isi `lib/chat-helpers.ts:51-118` (interface `ParsedStreamSections` + `parseStreamedSections`) dengan:

```ts
export interface ParsedStreamSections {
  userRomanization?: string;
  userTranslation?: string;
  replyText: string;
  replyTranslation?: string;
  replyRomanization?: string;
}

export function parseStreamedSections(acc: string): ParsedStreamSections {
  const lines = acc.split("\n");
  let userRomanization: string | undefined;
  let userTranslation: string | undefined;
  let replyTranslation: string | undefined;
  let replyRomanization: string | undefined;
  const replyLines: string[] = [];
  const transLines: string[] = [];
  const romLines: string[] = [];
  let mode: "before" | "reply" | "after" = "before";
  let afterSection: "trans" | "rom" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("||RTRANS||")) {
      mode = "after";
      afterSection = "trans";
      const rest = line.slice("||RTRANS||".length);
      if (rest.trim()) {
        transLines.push(rest);
      } else if (lines[i + 1] !== undefined) {
        transLines.push(lines[i + 1]);
        i += 1;
      }
      continue;
    }

    if (line.startsWith("||ROM||")) {
      mode = "after";
      afterSection = "rom";
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
    } else if (mode === "after") {
      if (afterSection === "trans") {
        transLines.push(line);
      } else {
        romLines.push(line);
      }
    }
  }

  return {
    ...(userRomanization ? { userRomanization } : {}),
    ...(userTranslation ? { userTranslation } : {}),
    replyText: replyLines.join("\n").trim(),
    ...(transLines.length > 0 ? { replyTranslation: transLines.join("\n").trim() } : {}),
    ...(romLines.length > 0 ? { replyRomanization: romLines.join("\n").trim() } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/chat-helpers.test.ts`
Expected: PASS (test lama + 5 test baru)

- [ ] **Step 5: Full verification + commit**

Run: `npm test` → PASS; `npx tsc --noEmit` → PASS; `npm run lint` → PASS

```bash
git add lib/chat-helpers.ts lib/chat-helpers.test.ts
git commit -m "feat: parser kenali ||RTRANS|| arti balasan dari streaming"
```

---

### Task 2: Prompt streaming + `||RTRANS||` + test

**Files:**
- Modify: `lib/ai-content/chat.ts` (blok "Aturan:" di `buildPolyglotStreamPrompt`, baris ±120-145)
- Test: `lib/ai-content/chat.test.ts` (describe `buildPolyglotStreamPrompt` + `buildGeneralStreamPrompt`)

**Interfaces:**
- Consumes: `parseStreamedSections` (Task 1) — parser akan mem-parsing output baru ini
- Produces: `buildPolyglotStreamPrompt` — format output: `||UROM||` (non-Latin) → `||UTRANS||` → balasan → `||RTRANS||` → `||ROM||` (non-Latin)

- [ ] **Step 1: Write the failing tests**

Di `lib/ai-content/chat.test.ts`, di dalam describe `buildPolyglotStreamPrompt` (setelah test "menyertakan ||UTRANS|| tanpa ||UROM|| untuk bahasa Latin"), tambah:

```ts
  it("menyertakan pemisah ||RTRANS|| untuk bahasa non-Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("안녕하세요", "Korean", "A1", "Restaurant", []);
    expect(instructions).toContain("||RTRANS||");
  });

  it("menyertakan ||RTRANS|| tanpa ||UROM||/||ROM|| untuk bahasa Latin", () => {
    const { instructions } = buildPolyglotStreamPrompt("Hello", "English", "A1", "Restaurant", []);
    expect(instructions).toContain("||RTRANS||");
    expect(instructions).not.toContain("||UROM||");
    expect(instructions).not.toContain("||ROM||");
  });
```

Lalu pada test `buildGeneralStreamPrompt` (baris ±137-138 yang memuat 3 assertion `not.toContain`), tambah satu baris:

```ts
    expect(instructions).not.toContain("||RTRANS||");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: FAIL (||RTRANS|| belum ada di prompt)

- [ ] **Step 3: Write minimal implementation**

Di `lib/ai-content/chat.ts`, blok "Aturan:" `buildPolyglotStreamPrompt` saat ini (baris 122-145) berbentuk 6 blok (UROM conditional, UTRANS conditional 2 varian, ROM conditional, pemisah conditional 2 varian). Ganti blok UTRANS-conditional sampai baris terakhir (baris 127-145) dengan kode eksak berikut (tambah baris `||RTRANS||` unconditional setelah blok UTRANS; ROM menyebut "Setelah baris ||RTRANS||"; daftar pemisah diperbarui per varian):

```ts
      ...(isNonLatin
        ? [
            "- Setelah baris ||UROM||, tambahkan baris '||UTRANS||' lalu arti pesan USER dalam Bahasa Indonesia pada baris yang sama. Contoh: '||UTRANS||Halo, apa kabar?'.",
          ]
        : [
            "- Di awal balasan, tambahkan baris '||UTRANS||' lalu arti pesan USER dalam Bahasa Indonesia pada baris yang sama. Contoh: '||UTRANS||Halo, apa kabar?'.",
          ]),
      "- Setelah balasan, tambahkan baris '||RTRANS||' lalu arti balasan dalam Bahasa Indonesia pada baris yang sama. Contoh: '||RTRANS||Halo, saya minta kopi'.",
      ...(isNonLatin
        ? [
            "- Setelah baris ||RTRANS||, tambahkan baris baru, lalu pemisah persis ||ROM||, lalu cara baca (romanisasi) SELURUH balasan tersebut dengan huruf Latin. Contoh: '안녕하세요!\\n||ROM||\\nannyeonghaseyo!'",
          ]
        : []),
      ...(isNonLatin
        ? [
            "- Setiap pemisah (||UROM||, ||UTRANS||, ||RTRANS||, ||ROM||) harus berada di AWAL baris; isinya langsung menyusul di baris yang sama (bila kosong, letakkan di baris berikutnya). Hanya gunakan pemisah tersebut sesuai aturan di atas — tidak ada teks lain di luar balasan.",
          ]
        : [
            "- Setiap pemisah (||UTRANS||, ||RTRANS||) harus berada di AWAL baris; isinya langsung menyusul di baris yang sama (bila kosong, letakkan di baris berikutnya). Hanya gunakan pemisah tersebut sesuai aturan di atas — tidak ada teks lain di luar balasan.",
          ]),
```

Blok UROM (baris 122-126) TIDAK diubah. Periksa hasil: untuk English, instructions mengandung `||UTRANS||` dan `||RTRANS||`, dan TIDAK mengandung literal `||UROM||` maupun `||ROM||`; untuk Korean mengandung keempatnya.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai-content/chat.test.ts`
Expected: PASS

- [ ] **Step 5: Full verification + commit**

Run: `npm test` → PASS; `npx tsc --noEmit` → PASS; `npm run lint` → PASS

```bash
git add lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "feat: prompt streaming emit ||RTRANS|| arti balasan"
```

---

### Task 3: ChatView — arti balasan dari stream

**Files:**
- Modify: `components/ChatView.tsx:71` (state), `components/ChatView.tsx:286-287` (set dari parse), `components/ChatView.tsx:605` (bubble streaming), `components/ChatView.tsx:421-422` (bubble final map), `components/ChatView.tsx:431-436` (reset di finally)

**Interfaces:**
- Consumes: `parseStreamedSections` (Task 1) — hasilnya kini punya `replyTranslation?: string`

- [ ] **Step 1: Tambah state**

Di `components/ChatView.tsx`, tepat setelah `const [streamingRomanization, setStreamingRomanization] = useState("");` (baris 71), tambah:

```tsx
  const [streamingReplyTranslation, setStreamingReplyTranslation] = useState("");
```

- [ ] **Step 2: Set dari parse saat stream selesai**

Di `components/ChatView.tsx` (baris 286-287), ganti:

```tsx
    const romanization = parsed.replyRomanization ?? "";
    setStreamingRomanization(romanization);
```

menjadi:

```tsx
    const romanization = parsed.replyRomanization ?? "";
    setStreamingRomanization(romanization);
    setStreamingReplyTranslation(parsed.replyTranslation ?? "");
```

- [ ] **Step 3: Tampilkan arti balasan di bubble streaming**

Di `components/ChatView.tsx` (baris 605), ganti:

```tsx
                    {!isGeneral && streamingRomanization && <RomanizationLine text={streamingRomanization} />}
```

menjadi:

```tsx
                    {!isGeneral && streamingRomanization && <RomanizationLine text={streamingRomanization} />}
                    {!isGeneral && streamingReplyTranslation && <TranslationLine text={streamingReplyTranslation} />}
```

- [ ] **Step 4: Bubble final — streaming menang atas analisis**

Di `components/ChatView.tsx` (baris 421-422), di blok sukses `analyzeChatMessageAction`, ganti:

```tsx
          romanization: res.analysis.reply_romanization ?? (romanization || undefined),
          translation: res.analysis.reply_translation_in_indonesian,
```

menjadi:

```tsx
          romanization: romanization || res.analysis.reply_romanization,
          translation: streamingReplyTranslation || res.analysis.reply_translation_in_indonesian,
```

- [ ] **Step 5: Reset state di finally**

Di `components/ChatView.tsx`, di blok `finally` dari `analyzeChatMessageAction` (baris 431-436, yang memuat `setStreamingRomanization("")`), tambahkan reset setelahnya:

```tsx
        setStreamingRomanization("");
        setStreamingReplyTranslation("");
```

(Biarkan blok finally lain — general & `!replyText` fallback — tanpa reset tambahan; state ini hanya di-set di path stream non-general. Jika ingin konsisten, reset juga boleh ditambahkan — tetapi minimal wajib di blok analyze path.)

- [ ] **Step 6: Verifikasi**

Run: `npx tsc --noEmit` → PASS; `npm run lint` → PASS; `npm test` → PASS

- [ ] **Step 7: Verifikasi manual (dev server — catat hasil, jangan ubah kode atas dasar hasil ini)**

Run: `npm run dev` → buka `/chat?session=...`:
1. Mode bahasa Latin (English): kirim pesan → saat streaming selesai, bubble AI langsung menampilkan baris "Arti" (dari `||RTRANS||`) tanpa menunggu analisis; tidak ada baris "Baca".
2. Mode bahasa non-Latin (Jepang): bubble AI langsung menampilkan baris "Arti" DAN "Baca" saat streaming selesai.
3. Setelah analisis selesai (skeleton hilang), nilai arti/baca tidak berubah (tidak flicker).
4. Mode general: tidak ada baris Arti/Baca; hanya teks balasan.

- [ ] **Step 8: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: arti+bacaan balasan AI tampil langsung dari streaming"
```
