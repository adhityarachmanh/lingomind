# Validasi Duplikat Flashcard + Penanda "Tersimpan" di Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mencegah flashcard duplikat saat disimpan (case-insensitive per bahasa) dan menandai kata yang sudah tersimpan di kartu vocab_highlight chat dengan tombol "Tersimpan".

**Architecture:** Cek duplikat dilakukan server-side di `saveFlashcardAction`/`maybeAutoSaveVocab` (tanpa migration, karena DB diblokir Zscaler); ChatView menjaga Set kata tersimpan per bahasa di state client, diisi dari action baru `getSavedVocabWordsAction` dan diperbarui setelah save/auto-save. Helper murni `normalizeVocabWord` dipakai sebagai sumber kebenaran normalisasi (trim + lowercase) dan diuji dengan vitest.

**Tech Stack:** Next.js (App Router, server actions), Prisma (PostgreSQL), TypeScript, vitest, shadcn/ui (Button, toast sonner), lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-08-flashcard-dedup-chat-mark-design.md`

## Global Constraints

- UI & pesan error **bahasa Indonesia**; string error lama wajib dipertahankan: `"Sesi berakhir. Silakan login kembali."`, `"Pengguna tidak ditemukan."`
- Definisi duplikat: `frontText` case-insensitive **per bahasa** (`userId` + `language` + `frontText` insensitive)
- Duplikat manual = tolak insert + info (bukan error): return `{ message: "ok", alreadySaved: true }`
- Tanpa migration / unique index DB; tanpa perubahan VoiceChatView; tanpa merge `backText`
- Fungsi murni diuji vitest (`*.test.ts` di `lib/`); verifikasi: `npm run lint`, `npx tsc --noEmit`, `npm test`
- Semua server action panggil `getSession()` — jangan pakai email dari client
- Jangan commit `.env`

---

### Task 1: Helper murni `normalizeVocabWord` + test

**Files:**
- Create: `lib/vocab.ts`
- Test: `lib/vocab.test.ts`

**Interfaces:**
- Produces: `export function normalizeVocabWord(word: string): string` — `word.trim().toLowerCase()`

- [ ] **Step 1: Write the failing test**

Create `lib/vocab.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeVocabWord } from "./vocab";

describe("normalizeVocabWord", () => {
  it("trim spasi di kedua sisi", () => {
    expect(normalizeVocabWord("  cat  ")).toBe("cat");
  });

  it("lowercase huruf besar", () => {
    expect(normalizeVocabWord("Cat")).toBe("cat");
    expect(normalizeVocabWord("CAT")).toBe("cat");
  });

  it("tidak merusak aksara non-Latin", () => {
    expect(normalizeVocabWord("猫")).toBe("猫");
    expect(normalizeVocabWord("안녕")).toBe("안녕");
  });

  it("string kosong / spasi saja tetap kosong", () => {
    expect(normalizeVocabWord("")).toBe("");
    expect(normalizeVocabWord("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/vocab.test.ts`
Expected: FAIL (file/module tidak ditemukan)

- [ ] **Step 3: Write minimal implementation**

Create `lib/vocab.ts`:

```ts
export function normalizeVocabWord(word: string): string {
  return word.trim().toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/vocab.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/vocab.ts lib/vocab.test.ts
git commit -m "feat: helper normalizeVocabWord untuk dedupe flashcard"
```

---

### Task 2: Dedupe di server actions + `getSavedVocabWordsAction` + flag `vocabSaved`

**Files:**
- Modify: `lib/actions/chat.ts:42-46` (interface `ChatResult`), `lib/actions/chat.ts:90-155` (`sendPolyglotMessageAction`), `lib/actions/chat.ts:157-170` (`saveFlashcardAction`), `lib/actions/chat.ts:299-363` (`analyzeChatMessageAction`), `lib/actions/chat.ts:365-382` (`maybeAutoSaveVocab`)
- Test: (tidak ada unit test — server action butuh DB; verifikasi via lint/tsc + manual)

**Interfaces:**
- Consumes: `normalizeVocabWord` dari `./vocab` (Task 1)
- Produces:
  - `saveFlashcardAction(frontText, backText, language): Promise<ActionResult & { alreadySaved?: boolean }>`
  - `getSavedVocabWordsAction(language): Promise<{ words: string[] } | { error: string }>`
  - `ChatResult` + field baru `vocabSaved?: boolean`
  - `analyzeChatMessageAction` return `AnalyzeResult & { vocabSaved?: boolean }` (`AnalyzeResult` di `lib/actions/chat.ts:294-297`)

- [ ] **Step 1: Import helper**

Di `lib/actions/chat.ts`, tambah import setelah import `parseAiJson`:

```ts
import { normalizeVocabWord } from "./vocab";
```

- [ ] **Step 2: Tambah field `vocabSaved` di `ChatResult`**

Ubah interface (lib/actions/chat.ts:42-46):

```ts
export interface ChatResult {
  analysis: PolyglotAnalysis;
  sessionId: string;
  messageId: string;
  vocabSaved?: boolean;
}
```

- [ ] **Step 3: Dedupe di `saveFlashcardAction`**

Ganti isi fungsi (lib/actions/chat.ts:157-170) menjadi:

```ts
export async function saveFlashcardAction(
  frontText: string,
  backText: string,
  language: string
): Promise<ActionResult & { alreadySaved?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.flashcard.findFirst({
    where: { userId: user.id, language, frontText: { equals: frontText, mode: "insensitive" } },
  });
  if (existing) return { message: "ok", alreadySaved: true };
  await db.flashcard.create({
    data: { userId: user.id, frontText, backText, language },
  });
  return { message: "ok", alreadySaved: false };
}
```

- [ ] **Step 4: Dedupe + return boolean di `maybeAutoSaveVocab`**

Ganti fungsi (lib/actions/chat.ts:365-382) — tambah filter `language`, case-insensitive, return boolean:

```ts
async function maybeAutoSaveVocab(
  userId: string,
  analysis: PolyglotAnalysis,
  language: string,
  enabled?: boolean
): Promise<boolean> {
  if (!enabled) return false;
  const word = analysis.vocab_highlight?.word_target;
  const meaning = analysis.vocab_highlight?.meaning_in_indonesian;
  if (!word || !meaning) return false;
  const existing = await db.flashcard.findFirst({
    where: { userId, language, frontText: { equals: word, mode: "insensitive" } },
  });
  if (existing) return true;
  await db.flashcard.create({
    data: { userId, frontText: word, backText: meaning, language },
  });
  return true;
}
```

- [ ] **Step 5: Expose `vocabSaved` dari `sendPolyglotMessageAction`**

Di `sendPolyglotMessageAction` (lib/actions/chat.ts:152), ganti baris pemanggilan dan return:

```ts
  const vocabSaved = await maybeAutoSaveVocab(user.id, analysis, language, autoSaveVocab);

  return { analysis, sessionId, messageId: aiMsg.id, vocabSaved };
```

- [ ] **Step 6: Expose `vocabSaved` dari `analyzeChatMessageAction`**

Tambahkan field `vocabSaved?: boolean` ke interface `AnalyzeResult` (lib/actions/chat.ts:294-297):

```ts
export interface AnalyzeResult {
  messageId: string;
  analysis: PolyglotAnalysis;
  vocabSaved?: boolean;
}
```

Lalu di `analyzeChatMessageAction` (lib/actions/chat.ts:360-362), ganti:

```ts
  const vocabSaved = await maybeAutoSaveVocab(user.id, analysis, language, autoSaveVocab);

  return { messageId: aiMsg.id, analysis, vocabSaved };
```

- [ ] **Step 7: Tambah `getSavedVocabWordsAction`**

Tambahkan fungsi baru tepat setelah `getFlashcardsAction` (setelah baris 184, sebelum interface `FlashcardDto`):

```ts
export async function getSavedVocabWordsAction(
  language: string
): Promise<{ words: string[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const cards = await db.flashcard.findMany({
    where: { userId: user.id, language },
    select: { frontText: true },
  });
  return { words: cards.map((c) => normalizeVocabWord(c.frontText)) };
}
```

- [ ] **Step 8: Verifikasi**

Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/actions/chat.ts
git commit -m "feat: cek duplikat flashcard case-insensitive per bahasa + getSavedVocabWordsAction"
```

---

### Task 3: ChatView — Set kata tersimpan + tombol "Tersimpan"

**Files:**
- Modify: `components/ChatView.tsx:6` (import), `components/ChatView.tsx:64-83` (state), `components/ChatView.tsx:123` (load session), `components/ChatView.tsx:339-357` (sendPolyglot success), `components/ChatView.tsx:380-395` (analyze success), `components/ChatView.tsx:411-415` (saveVocab), `components/ChatView.tsx:699-706` (tombol)

**Interfaces:**
- Consumes: `getSavedVocabWordsAction` dari `@/lib/actions/chat` (Task 2), `normalizeVocabWord` dari `@/lib/vocab` (Task 1)

- [ ] **Step 1: Tambah import**

Di `components/ChatView.tsx:6`, tambah `getSavedVocabWordsAction` ke import dari `@/lib/actions/chat`:

```tsx
import { analyzeChatMessageAction, generateSummaryAction, getSavedVocabWordsAction, removeLastAiMessageAction, saveFlashcardAction, saveStreamedMessageAction, sendGeneralMessageAction, sendPolyglotMessageAction, type PolyglotAnalysis } from "@/lib/actions/chat";
```

Tambah import baru setelah import MarkdownContent (baris 7):

```tsx
import { normalizeVocabWord } from "@/lib/vocab";
```

Catatan: `Bookmark` dan `BookmarkCheck` sudah diimport di baris 4 — tidak perlu tambah.

- [ ] **Step 2: Tambah state Set**

Setelah state `autoSaveVocab` (baris 76-79), tambah:

```tsx
  const [savedVocabWords, setSavedVocabWords] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Load kata tersimpan saat session dimuat**

Di useEffect load session, tepat setelah `setSession(res.session)` (baris 123), tambah:

```tsx
        getSavedVocabWordsAction(res.session.language).then((w) => {
          if (cancelled || "error" in w) return;
          setSavedVocabWords(new Set(w.words));
        });
```

- [ ] **Step 4: Update `saveVocab`**

Ganti fungsi (baris 411-415) menjadi:

```tsx
  async function saveVocab(word: string, meaning: string) {
    const res = await saveFlashcardAction(word, meaning, session?.language ?? "English");
    if ("error" in res) { setError(res.error ?? null); return; }
    const normalized = normalizeVocabWord(word);
    setSavedVocabWords((prev) => new Set(prev).add(normalized));
    if (res.alreadySaved) {
      toast.info(`${word} sudah tersimpan.`);
    } else {
      toast.success(`${word} disimpan ke flashcard!`);
    }
  }
```

- [ ] **Step 5: Tandai kata hasil auto-save (dua lokasi)**

**5a.** Di blok sukses `sendPolyglotMessageAction`, tepat setelah `applySuggestions(...)` (baris 339), tambah:

```tsx
        if (res.vocabSaved && res.analysis.vocab_highlight?.word_target) {
          setSavedVocabWords((prev) => new Set(prev).add(normalizeVocabWord(res.analysis.vocab_highlight!.word_target)));
        }
```

**5b.** Di blok sukses `analyzeChatMessageAction`, tepat setelah `applySuggestions(...)` (baris 380), tambah kode yang sama persis seperti 5a.

- [ ] **Step 6: Tombol jadi "Tersimpan"**

Ganti blok tombol di kartu vocab_highlight (baris 699-706) menjadi:

```tsx
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveVocab(analysisTarget!.analysis!.vocab_highlight.word_target, analysisTarget!.analysis!.vocab_highlight.meaning_in_indonesian)}
                      className="shrink-0"
                      disabled={savedVocabWords.has(normalizeVocabWord(analysisTarget.analysis.vocab_highlight.word_target))}
                    >
                      {savedVocabWords.has(normalizeVocabWord(analysisTarget.analysis.vocab_highlight.word_target)) ? (
                        <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5 mr-1" />
                      )}
                      {savedVocabWords.has(normalizeVocabWord(analysisTarget.analysis.vocab_highlight.word_target))
                        ? "Tersimpan"
                        : "Simpan"}
                    </Button>
```

- [ ] **Step 7: Verifikasi**

Run: `npx tsc --noEmit`
Expected: PASS
Run: `npm run lint`
Expected: PASS
Run: `npm test`
Expected: PASS (semua test, termasuk lib/vocab.test.ts)

- [ ] **Step 8: Verifikasi manual (dev server)**

Run: `npm run dev` → buka `/chat/:scenario` dengan bahasa English:
1. Kirim pesan → buka dialog "Lihat Penjelasan" → kata vocab tampil dengan tombol "Simpan" + ikon `Bookmark`.
2. Klik "Simpan" → toast sukses, tombol berubah "Tersimpan" + ikon `BookmarkCheck` + disabled.
3. Tutup & buka dialog lagi → tombol tetap "Tersimpan" (data dari `getSavedVocabWordsAction`).
4. Kirim pesan lain yang kata vocab-nya sama (huruf beda case, mis. "Hello" vs "hello") → klik "Simpan" → toast info "sudah tersimpan." tanpa duplikat di DB (cek `/flashcards` — kata hanya muncul sekali).
5. Nyalakan toggle auto-save vocab → kirim pesan → kata hasil auto-save langsung ditandai "Tersimpan".
6. Bahasa berbeda (mis. French) → kata sama di bahasa lain TIDAK dianggap duplikat (bisa disimpan).

- [ ] **Step 9: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: penanda kata tersimpan di chat (tombol Tersimpan + dedupe toast)"
```
