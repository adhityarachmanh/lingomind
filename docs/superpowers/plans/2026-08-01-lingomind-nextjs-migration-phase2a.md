# LingoMind Fase 2a — Roadmap + Lesson + Quiz + Flashcard — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport siklus belajar utama LingoMind ke Next.js: halaman roadmap kurikulum, lesson AI (cached, adaptive), quiz AI (cached variant, hearts, score submission + level-up), dan flashcard review (SM-2 SRS) — dengan server actions + session guard, TTS Web Speech API browser, dan HTML AI tersanitasi.

**Architecture:** Semua logika murni (SM-2, streak math, quiz validation/quality, classifier, parser JSON AI) dipisah ke `lib/*` dan diuji dengan vitest (TDD). Server actions (`lib/actions/*`) memakai `getSession()` dan Prisma (delegate singular + camelCase — lihat Global Constraints). UI diport dari `dioxus/src/views/{roadmap,lesson,quiz,flashcard_review}.rs` dengan string Indonesia persis.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible` → opencode.ai, model dari `OPENCODE_AI_MODEL`), vitest, sanitize-html, Web Speech API (tanpa paket).

**Referensi kode lama (sumber kebenaran):**
- Lesson: `dioxus/src/services/gemini/lesson.rs` (prompt baris 162-183, enrichment), `dioxus/src/views/lesson.rs`
- Quiz: `dioxus/src/services/gemini/quiz.rs` (prompt 315-407, normalize 23-56, validate 58-128, quality 459-539, variant 542-617), `dioxus/src/views/quiz.rs`
- Skor/level: `dioxus/src/services/auth.rs:167-317` (update_user_score), `:607-732` (submit_exam_result — cooldown saja, exam di 2b)
- Engagement: `dioxus/src/services/engagement.rs:5-95` (update_engagement_after_quiz), `:174-224` (deduct_heart)
- Flashcard: `dioxus/src/services/flashcard.rs` (sm2_next 5-25), `dioxus/src/views/flashcard_review.rs`
- Weakness: `dioxus/src/services/weakness.rs`, classifier di `dioxus/src/views/quiz.rs:166-198`
- Mission: `dioxus/src/services/mission.rs:153-304`
- Roadmap: `dioxus/src/views/roadmap.rs`

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis dari aplikasi lama (di-`quote` di tiap task).
- **Prisma**: delegate singular + camelCase (`db.user`, `db.userEngagementStat`, `db.cachedLesson`, `db.cachedQuiz`, `db.flashcard`, `db.weaknessLog`, `db.skillProgressLog`, `db.userProgressLog`, `db.userLanguageProgress`, `db.level`, `db.topic`, `db.appConfig`, `db.userDailyMission`, `db.user`). Field: `contentJson`, `frontText`, `backText`, `easeFactor`, `intervalDays`, `repetition`, `dueAt`, `lastReviewedAt`, `isCorrect`, `activityType`, `scoreGained`, `baseLevel`, `topicIdx`, `languageId`, `levelId`, `orderIndex`, `baseRewardPoints`, `lessonTarget`, `doubleXpUntil`, `lastActiveDate`, `hasWeekendAmulet`, `examRetakeTickets`, `correctAnswersToday`. `user_daily_missions` PK komposit `@@id([email, date])` → where key `email_date`. Error unique = `P2002`.
- **Setiap server action yang butuh user memanggil `getSession()`** — tidak pernah menerima email dari client.
- **HTML dari AI WAJIB disanitasi** (`sanitize-html`, whitelist: `br, b, i, u, strong, em, p, ul, ol, li, a[href], blockquote, code, h3, h4`) sebelum `dangerouslySetInnerHTML`.
- **Tanpa perubahan skema/migration** — semua tabel sudah ada dari Fase 1. `npx prisma migrate status` harus tetap up to date.
- **Jangan commit `.env`**; jangan jalankan `npm run dev` (menggantung sesi) — verifikasi via lint/tsc/test/build.
- Fire-and-forget server action (per-jawaban) TIDAK boleh menggagalkan UI — client menangkap semua promise dengan `.catch(() => {})`.
- Opsi kuis di-shuffle **server-side** sebelum dikirim ke client.
- Model AI: gunakan `model` dari `lib/ai.ts` (sudah ada). Quiz: `temperature: 0.6`; lesson: tanpa temperature (default).
- Nama field JSON AI mengikuti kontrak lama: snake_case (`question_type`, `listen_text`, `correct_answer`, `example_sentences`, `vocabulary`).

---

### Task 1: lib/progress.ts — streak math + quiz outcome (TDD, fungsi murni)

**Files:**
- Create: `lib/progress.ts`, `lib/progress.test.ts`
- Modify: `lib/types.ts` (perluas `EngagementStats`), `lib/dashboard.ts` (map 2 field baru)

**Interfaces:**
- Consumes: — (fungsi murni, tanpa DB)
- Produces:
  ```ts
  export interface StreakInput {
    currentStreak: number; previousStreak: number; longestStreak: number;
    lastActiveDate: Date | null; streakFreezes: number; hasWeekendAmulet: boolean | null;
  }
  export interface StreakOutput {
    currentStreak: number; previousStreak: number; longestStreak: number;
    streakFreezes: number; lastActiveDate: Date;
  }
  export function computeStreakAfterActivity(input: StreakInput, now: Date): StreakOutput
  export interface QuizOutcomeInput {
    baseLevel: string; topicIdx: number; topicsInLevel: number;
    playedTopicIdx: number; ptsPerQuestion: number; scoreGained: number;
  }
  export function computeQuizOutcome(input: QuizOutcomeInput): { passed: boolean; newTopicIdx: number }
  ```

- [ ] **Step 1: Perluas tipe EngagementStats**

Edit `lib/types.ts` — tambah 2 field ke interface `EngagementStats` (di akhir, opsional):
```ts
  last_active_date: Date | null;
  has_weekend_amulet: boolean | null;
```

Edit `lib/dashboard.ts` — di `getEngagementStats`, tambahkan mapping sebelum `return {`:
```ts
  const engagement: EngagementStats = { ...existing fields... };
```
Ganti pemanggilan `getEngagementStats` di `app/(app)/dashboard/page.tsx`? TIDAK — mapping ditambah di return object:
```ts
  return {
    current_streak: row.currentStreak ?? 0,
    /* ... field lain tetap ... */
    last_heart_refill: lastRefill,
    last_active_date: row.lastActiveDate,
    has_weekend_amulet: row.hasWeekendAmulet,
  };
```

- [ ] **Step 2: Tulis tes gagal (TDD)**

Create `lib/progress.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeQuizOutcome, computeStreakAfterActivity } from "./progress";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("computeStreakAfterActivity", () => {
  it("belum pernah aktif → streak 1, lastActiveDate hari ini", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 0, previousStreak: 0, longestStreak: 0, lastActiveDate: null, streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(1);
    expect(r.longestStreak).toBe(1);
    expect(r.lastActiveDate).toEqual(d("2026-08-01"));
  });
  it("aktif hari yang sama → streak tetap, previous tetap", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 5, previousStreak: 5, longestStreak: 7, lastActiveDate: d("2026-08-01"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(5);
    expect(r.previousStreak).toBe(5);
  });
  it("kemarin → streak +1, previous tetap", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 3, previousStreak: 2, longestStreak: 3, lastActiveDate: d("2026-07-31"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(4);
    expect(r.previousStreak).toBe(2);
    expect(r.longestStreak).toBe(4);
  });
  it("gap 2 hari tanpa freeze → reset 1, previous = streak lama", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 6, previousStreak: 0, longestStreak: 6, lastActiveDate: d("2026-07-30"), streakFreezes: 0, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(1);
    expect(r.previousStreak).toBe(6);
    expect(r.longestStreak).toBe(6);
  });
  it("gap 2 hari dengan 2 freeze → +1 dan freeze berkurang", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 4, previousStreak: 0, longestStreak: 4, lastActiveDate: d("2026-07-30"), streakFreezes: 2, hasWeekendAmulet: false },
      d("2026-08-01")
    );
    expect(r.currentStreak).toBe(5);
    expect(r.streakFreezes).toBe(1);
  });
  it("Senin (dow 1) gap 3 hari dengan weekend amulet → +1", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 7, previousStreak: 0, longestStreak: 7, lastActiveDate: d("2026-07-29"), streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-08-03") // Senin
    );
    expect(r.currentStreak).toBe(8);
  });
  it("Minggu (dow 0) gap 2 hari dengan weekend amulet → +1", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 9, previousStreak: 0, longestStreak: 9, lastActiveDate: d("2026-07-31") /* Jumat */, streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-08-02") // Minggu
    );
    expect(r.currentStreak).toBe(10);
  });
  it("hari lain (Selasa) gap 2 hari dengan amulet → reset (amulet hanya akhir pekan)", () => {
    const r = computeStreakAfterActivity(
      { currentStreak: 3, previousStreak: 0, longestStreak: 3, lastActiveDate: d("2026-07-28") /* Selasa */, streakFreezes: 0, hasWeekendAmulet: true },
      d("2026-07-30") // Kamis
    );
    expect(r.currentStreak).toBe(1);
    expect(r.previousStreak).toBe(3);
  });
});

describe("computeQuizOutcome", () => {
  it("nilai sempurna & topik sesuai → passed, topic_idx +1", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 0, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r).toEqual({ passed: true, newTopicIdx: 1 });
  });
  it("nilai kurang → tidak passed, tidak naik", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 0, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 40 });
    expect(r).toEqual({ passed: false, newTopicIdx: 0 });
  });
  it("nilai penuh tapi topik bukan topik aktif → tidak passed", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 2, topicsInLevel: 4, playedTopicIdx: 0, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r.passed).toBe(false);
  });
  it("passed di topik terakhir → topic_idx tidak overflow", () => {
    const r = computeQuizOutcome({ baseLevel: "A1", topicIdx: 3, topicsInLevel: 4, playedTopicIdx: 3, ptsPerQuestion: 10, scoreGained: 50 });
    expect(r).toEqual({ passed: true, newTopicIdx: 3 });
  });
});
```

- [ ] **Step 3: Run test — harus gagal**

Run: `npx vitest run lib/progress.test.ts`
Expected: FAIL (module `./progress` tidak ada).

- [ ] **Step 4: Implementasi `lib/progress.ts`**

```ts
export interface StreakInput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  streakFreezes: number;
  hasWeekendAmulet: boolean | null;
}

export interface StreakOutput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastActiveDate: Date;
}

function dayNumber(dt: Date): number {
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function computeStreakAfterActivity(input: StreakInput, now: Date): StreakOutput {
  const today = dayNumber(now);
  const last = input.lastActiveDate ? dayNumber(input.lastActiveDate) : null;
  const diff = last === null ? Number.POSITIVE_INFINITY : Math.round((today - last) / 86400000);
  const dow = now.getUTCDay(); // 0=Sunday, 1=Monday, 6=Saturday
  const amulet = input.hasWeekendAmulet === true;

  let current: number;
  let previous = input.previousStreak;
  let freezes = input.streakFreezes;

  if (last === null || diff > 0 && diff === Number.POSITIVE_INFINITY) {
    // no previous activity
    if (last === null) {
      current = 1;
    } else {
      current = 1;
    }
  } else if (diff <= 0) {
    current = input.currentStreak; // same day
  } else if (diff === 1) {
    current = input.currentStreak + 1;
  } else if (freezes >= diff - 1) {
    current = input.currentStreak + 1;
    freezes -= diff - 1;
  } else if (amulet && dow === 1 && diff <= 3) {
    current = input.currentStreak + 1; // Monday, weekend amulet
  } else if (amulet && dow === 0 && diff <= 2) {
    current = input.currentStreak + 1; // Sunday, weekend amulet
  } else {
    previous = input.currentStreak;
    current = 1;
  }

  const longest = Math.max(input.longestStreak, current);
  return { currentStreak: current, previousStreak: previous, longestStreak: longest, streakFreezes: freezes, lastActiveDate: new Date(today) };
}

export interface QuizOutcomeInput {
  baseLevel: string;
  topicIdx: number;
  topicsInLevel: number;
  playedTopicIdx: number;
  ptsPerQuestion: number;
  scoreGained: number;
}

export function computeQuizOutcome(input: QuizOutcomeInput): { passed: boolean; newTopicIdx: number } {
  const requiredScore = input.ptsPerQuestion * 5;
  const passed = input.scoreGained >= requiredScore && input.playedTopicIdx === input.topicIdx;
  let newTopicIdx = input.topicIdx;
  if (passed && input.topicIdx < input.topicsInLevel) {
    newTopicIdx += 1;
  }
  return { passed, newTopicIdx };
}
```

Catatan: blok `if (last === null || ...)` di atas ditulis berlebihan — sederhanakan menjadi `if (last === null) { current = 1; }` (branch `diff === Infinity` tidak mungkin dicapai setelah guard pertama). Pastikan test tetap lulus.

- [ ] **Step 5: Run test — harus lulus**

Run: `npx npm test` → semua test lulus (11 baru + 17 lama = 28).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/dashboard.ts lib/progress.ts lib/progress.test.ts
git commit -m "feat: streak and quiz outcome math (pure functions, TDD)"
```

---

### Task 2: lib/progress.ts DB ops + lib/mission.ts

**Files:**
- Create: `lib/mission.ts`, `lib/actions/mission.ts` ("use server")
- Modify: `lib/progress.ts` (tambah fungsi DB)

**Interfaces:**
- Consumes: `computeStreakAfterActivity`, `computeQuizOutcome` (Task 1), `db` (lib/db.ts), `getUserProfile` (lib/profile.ts), `getCurriculum` (lib/dashboard.ts), tipe `EngagementStats` (Task 1)
- Produces:
  ```ts
  // lib/mission.ts
  export async function incrementMissionProgress(email: string, activityType: "lesson" | "quiz" | "weakness" | "flashcard"): Promise<void>
  export async function incrementCorrectAnswers(email: string, count: number): Promise<void>

  // lib/actions/mission.ts
  export async function incrementMissionAction(activityType: "lesson" | "quiz" | "weakness" | "flashcard"): Promise<ActionResult>
  // getSession guard; memanggil incrementMissionProgress(session.email, activityType)

  // lib/progress.ts (tambah)
  export async function applyQuizResult(email: string, language: string, goal: string, scoreGained: number): Promise<UserProfile>
  export async function updateEngagementAfterQuiz(email: string, points: number): Promise<void>
  export async function deductHeart(email: string): Promise<{ hearts: number }>
  ```

- [ ] **Step 1: Tulis `lib/mission.ts`**

```ts
import { db } from "./db";

const COLUMN_BY_ACTIVITY = {
  lesson: "lessonsCompleted",
  quiz: "quizzesCompleted",
  weakness: "weaknessPracticesCompleted",
  flashcard: "flashcardsReviewed",
} as const;

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function incrementMissionProgress(
  email: string,
  activityType: "lesson" | "quiz" | "weakness" | "flashcard"
): Promise<void> {
  const column = COLUMN_BY_ACTIVITY[activityType];
  await db.userDailyMission.upsert({
    where: { email_date: { email, date: todayLocal() } },
    create: { email, date: todayLocal() },
    update: {},
  });
  // Prisma tidak bisa increment field dinamis; baca lalu set
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: todayLocal() } } });
  if (!row) return;
  await db.userDailyMission.update({
    where: { email_date: { email, date: todayLocal() } },
    data: { [column]: (row[column] ?? 0) + 1 },
  });
}

export async function incrementCorrectAnswers(email: string, count: number): Promise<void> {
  if (count <= 0) return;
  const today = todayLocal();
  await db.userDailyMission.upsert({
    where: { email_date: { email, date: today } },
    create: { email, date: today },
    update: {},
  });
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: today } } });
  if (!row) return;
  await db.userDailyMission.update({
    where: { email_date: { email, date: today } },
    data: { correctAnswersToday: (row.correctAnswersToday ?? 0) + count },
  });
}
```

- [ ] **Step 2: Tulis `lib/actions/mission.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { incrementMissionProgress } from "../mission";
import type { ActionResult } from "./types";

export async function incrementMissionAction(
  activityType: "lesson" | "quiz" | "weakness" | "flashcard"
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await incrementMissionProgress(session.email, activityType);
  return { message: "ok" };
}
```

- [ ] **Step 3: Tambah fungsi DB ke `lib/progress.ts`**

```ts
import { db } from "./db";
import { getUserProfile } from "./profile";
import { getCurriculum } from "./dashboard";
import { incrementMissionProgress } from "./mission";
import type { UserProfile } from "./types";

export async function applyQuizResult(
  email: string,
  language: string,
  goal: string,
  scoreGained: number
): Promise<UserProfile> {
  const profile = await getUserProfile(email);
  if (!profile) throw new Error("User tidak ditemukan");

  const currentLevel = profile.current_level[language] ?? "A1.0";
  const baseLevel = currentLevel.split(".")[0] || "A1";
  const topicIdx = Number(currentLevel.split(".")[1] ?? 0);

  const curriculum = await getCurriculum();
  const levelData = curriculum.find((c) => c.level === baseLevel);
  const ptsPerQuestion = levelData?.base_reward_points ?? 20;
  const topicsInLevel = levelData?.topics.length ?? 4;

  const playedTopicIdx = levelData
    ? levelData.topics.findIndex((t) => t === goal)
    : -1;

  const { passed, newTopicIdx } = computeQuizOutcome({
    baseLevel,
    topicIdx,
    topicsInLevel,
    playedTopicIdx,
    ptsPerQuestion,
    scoreGained,
  });

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const doubleXp = !!stats?.doubleXpUntil && stats.doubleXpUntil >= new Date();
  const actualDelta = doubleXp ? scoreGained * 2 : scoreGained;

  await db.$transaction([
    db.userProgressLog.create({
      data: {
        email,
        language,
        activityType: "quiz",
        topic: goal,
        scoreGained,
        passed,
        baseLevel,
        topicIdx,
      },
    }),
    db.userLanguageProgress.upsert({
      where: { email_languageId: { email, languageId: language } },
      create: { email, languageId: language, baseLevel, topicIdx: newTopicIdx },
      update: { baseLevel, topicIdx: newTopicIdx },
    }),
    db.user.update({
      where: { email },
      data: { score: { increment: actualDelta } },
    }),
  ]);

  await incrementMissionProgress(email, "quiz");
  return getUserProfile(email);
}

export async function updateEngagementAfterQuiz(email: string, points: number): Promise<void> {
  const cfg = await db.appConfig.findUnique({ where: { key: "quiz_completion_coins" } });
  const coinReward = cfg ? (parseInt(cfg.value, 10) || 10) : 10;

  const now = new Date();
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const doubleXp = !!stats?.doubleXpUntil && stats.doubleXpUntil >= now;
  const pointsEarned = doubleXp ? points * 2 : points;

  if (!stats) {
    await db.userEngagementStat.create({
      data: {
        email,
        currentStreak: 1,
        longestStreak: 1,
        totalQuizCompleted: 1,
        totalPointsEarned: pointsEarned,
        lastActiveDate: now,
        coins: coinReward,
        streakFreezes: 0,
        previousStreak: 0,
        examRetakeTickets: 0,
        hearts: 5,
      },
    });
    return;
  }

  const streak = computeStreakAfterActivity(
    {
      currentStreak: stats.currentStreak,
      previousStreak: stats.previousStreak,
      longestStreak: stats.longestStreak,
      lastActiveDate: stats.lastActiveDate,
      streakFreezes: stats.streakFreezes,
      hasWeekendAmulet: stats.hasWeekendAmulet,
    },
    now
  );

  await db.userEngagementStat.update({
    where: { email },
    data: {
      currentStreak: streak.currentStreak,
      previousStreak: streak.previousStreak,
      longestStreak: streak.longestStreak,
      streakFreezes: streak.streakFreezes,
      lastActiveDate: streak.lastActiveDate,
      totalQuizCompleted: { increment: 1 },
      totalPointsEarned: { increment: pointsEarned },
      coins: { increment: coinReward },
    },
  });
}

export async function deductHeart(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const now = new Date();
  if (!stats) {
    await db.userEngagementStat.create({
      data: { email, hearts: 4, lastHeartRefill: now },
    });
    return { hearts: 4 };
  }
  if (stats.hearts <= 0) return { hearts: 0 };
  const hearts = stats.hearts - 1;
  await db.userEngagementStat.update({
    where: { email },
    data: { hearts, lastHeartRefill: hearts === 4 ? now : stats.lastHeartRefill },
  });
  return { hearts };
}
```

Catatan: `db.userLanguageProgress.upsert` where key komposit `@@id([email, languageId])` → Prisma meng-generate nama `email_languageId`; cek `prisma/schema.prisma` dan sesuaikan bila berbeda (misal `email_language_id`). `applyQuizResult` melempar error jika user hilang — dipanggil hanya dari action yang sudah memvalidasi session; kegagalan = 500 yang ditangani client sebagai error form.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit` — bersih.
Run: `npx vitest run lib/progress.test.ts` — 11 pass.
Smoke read-only: `npx tsx --env-file=.env -e "import { db } from './lib/db'; db.level.count().then(c => { console.log('levels:', c); process.exit(c === 6 ? 0 : 1); })"` → `levels: 6`.
JANGAN panggil applyQuizResult/updateEngagement/deductHeart di tes (menulis data) — smoke manual oleh controller.

- [ ] **Step 5: Commit**

```bash
git add lib/progress.ts lib/mission.ts lib/actions/mission.ts
git commit -m "feat: quiz result pipeline (score, level-up, engagement, hearts, missions)"
```

---

### Task 3: lib/flashcards.ts — SM-2 + queries (TDD)

**Files:**
- Create: `lib/flashcards.ts`, `lib/flashcards.test.ts`
- Modify: `lib/types.ts` (tambah `FlashcardItem`)

**Interfaces:**
- Consumes: `db`, `incrementMissionProgress` (Task 2)
- Produces:
  ```ts
  // lib/types.ts
  export interface FlashcardItem {
    id: number; email: string; language: string; front_text: string; back_text: string;
    ease_factor: number; interval_days: number; repetition: number;
  }
  export interface NewFlashcard { language: string; front_text: string; back_text: string; }

  // lib/flashcards.ts
  export function sm2Next(easeFactor: number, intervalDays: number, repetition: number, quality: number): { easeFactor: number; intervalDays: number; repetition: number }
  export async function addFlashcards(email: string, cards: NewFlashcard[]): Promise<void>
  export async function getDueFlashcards(email: string, language: string, limit: number): Promise<FlashcardItem[]>
  export async function getDueFlashcardCount(email: string, language: string): Promise<number>
  export async function reviewFlashcard(id: number, quality: number): Promise<void>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/flashcards.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { sm2Next } from "./flashcards";

describe("sm2Next", () => {
  it("quality 2 (Ulangi) → interval 1, repetition reset 0, ef turun", () => {
    const r = sm2Next(2.5, 5, 3, 2);
    expect(r.intervalDays).toBe(1);
    expect(r.repetition).toBe(0);
    expect(r.easeFactor).toBeLessThan(2.5);
  });
  it("quality 4 (Bagus) rep 1 → interval 1, rep 1", () => {
    const r = sm2Next(2.5, 1, 0, 4);
    expect(r.intervalDays).toBe(1);
    expect(r.repetition).toBe(1);
    expect(r.easeFactor).toBeGreaterThan(2.5);
  });
  it("quality 4 rep 2 → interval 3", () => {
    const r = sm2Next(2.5, 1, 1, 4);
    expect(r.intervalDays).toBe(3);
    expect(r.repetition).toBe(2);
  });
  it("quality 5 rep 3 → interval round(interval * ef)", () => {
    const r = sm2Next(2.6, 3, 2, 5);
    expect(r.intervalDays).toBe(Math.round(3 * 2.6));
    expect(r.repetition).toBe(3);
  });
  it("ef tidak pernah di bawah 1.3", () => {
    const r = sm2Next(1.3, 1, 0, 2);
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it("interval tidak pernah 0", () => {
    const r = sm2Next(1.3, 1, 99, 5);
    expect(r.intervalDays).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/flashcards.test.ts`
Expected: FAIL (module tidak ada).

- [ ] **Step 3: Implementasi**

Tambah ke `lib/types.ts`:
```ts
export interface FlashcardItem {
  id: number;
  email: string;
  language: string;
  front_text: string;
  back_text: string;
  ease_factor: number;
  interval_days: number;
  repetition: number;
}

export interface NewFlashcard {
  language: string;
  front_text: string;
  back_text: string;
}
```

Create `lib/flashcards.ts`:
```ts
import { db } from "./db";
import { incrementMissionProgress } from "./mission";
import type { FlashcardItem, NewFlashcard } from "./types";

export function sm2Next(
  easeFactor: number,
  intervalDays: number,
  repetition: number,
  quality: number
): { easeFactor: number; intervalDays: number; repetition: number } {
  let ef = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  if (quality < 3) return { easeFactor: ef, intervalDays: 1, repetition: 0 };
  const newRepetition = repetition + 1;
  const newInterval =
    newRepetition === 1 ? 1 : newRepetition === 2 ? 3 : Math.round(intervalDays * ef);
  return { easeFactor: ef, intervalDays: Math.max(1, newInterval), repetition: newRepetition };
}

function toItem(f: {
  id: number; email: string; language: string; frontText: string; backText: string;
  easeFactor: number; intervalDays: number; repetition: number;
}): FlashcardItem {
  return {
    id: f.id, email: f.email, language: f.language, front_text: f.frontText,
    back_text: f.backText, ease_factor: f.easeFactor, interval_days: f.intervalDays, repetition: f.repetition,
  };
}

export async function addFlashcards(email: string, cards: NewFlashcard[]): Promise<void> {
  const valid = cards.filter((c) => c.front_text.trim() && c.back_text.trim());
  if (valid.length === 0) return;
  await db.flashcard.createMany({
    data: valid.map((c) => ({
      email,
      language: c.language,
      frontText: c.front_text,
      backText: c.back_text,
    })),
    skipDuplicates: true,
  });
}

export async function getDueFlashcards(email: string, language: string, limit: number): Promise<FlashcardItem[]> {
  const safeLimit = limit <= 0 ? 10 : Math.min(limit, 50);
  const rows = await db.flashcard.findMany({
    where: { email, language, dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: safeLimit,
  });
  return rows.map(toItem);
}

export async function getDueFlashcardCount(email: string, language: string): Promise<number> {
  return db.flashcard.count({ where: { email, language, dueAt: { lte: new Date() } } });
}

export async function reviewFlashcard(id: number, quality: number): Promise<void> {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error("Quality review harus 0..5.");
  }
  const card = await db.flashcard.findUnique({ where: { id } });
  if (!card) throw new Error("Flashcard tidak ditemukan.");

  const next = sm2Next(card.easeFactor, card.intervalDays, card.repetition, quality);
  const now = new Date();
  const dueAt = new Date(now.getTime() + next.intervalDays * 24 * 60 * 60 * 1000);

  await db.flashcard.update({
    where: { id },
    data: { easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetition: next.repetition, dueAt, lastReviewedAt: now },
  });
  await incrementMissionProgress(card.email, "flashcard");
}
```

- [ ] **Step 4: Run — harus lulus**

Run: `npx npm test` → 34 test pass (28 + 6 baru).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/flashcards.ts lib/flashcards.test.ts
git commit -m "feat: sm-2 flashcard algorithm and queries (TDD)"
```

---

### Task 4: lib/weakness.ts — classifier + logs (TDD)

**Files:**
- Create: `lib/weakness.ts`, `lib/weakness.test.ts`

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  export function classifyWeaknessTopic(explanation: string): string
  export function classifySkill(question: string, explanation: string, questionType: string): "listening" | "vocabulary" | "grammar"
  export async function logWeakness(email: string, language: string, topic: string, note: string): Promise<void>
  export async function logSkillProgress(email: string, language: string, skill: string, isCorrect: boolean): Promise<void>
  export async function getTopWeaknesses(email: string, language: string, limit: number): Promise<{ topic: string; count: number }[]>
  export async function getPriorityWeakness(email: string, language: string): Promise<string | null>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/weakness.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { classifySkill, classifyWeaknessTopic } from "./weakness";

describe("classifyWeaknessTopic", () => {
  it("tense/past → Grammar: Tense", () => {
    expect(classifyWeaknessTopic("Kalimat menggunakan past tense yang salah.")).toBe("Grammar: Tense");
  });
  it("preposition → Grammar: Preposition", () => {
    expect(classifyWeaknessTopic("Penggunaan preposition 'in' dan 'on' keliru.")).toBe("Grammar: Preposition");
  });
  it("article → Grammar: Article", () => {
    expect(classifyWeaknessTopic("Artikel 'the' seharusnya dipakai di sini.")).toBe("Grammar: Article");
  });
  it("vocabulary/word choice → Vocabulary: Word Choice", () => {
    expect(classifyWeaknessTopic("Pilihan kata (word choice) kurang tepat.")).toBe("Vocabulary: Word Choice");
  });
  it("fallback → General: Answer Accuracy", () => {
    expect(classifyWeaknessTopic("Penjelasan umum tentang tata bahasa.")).toBe("General: Answer Accuracy");
  });
});

describe("classifySkill", () => {
  it("question_type listening → listening", () => {
    expect(classifySkill("Dengarkan audio", "Penjelasan", "listening")).toBe("listening");
  });
  it("kata kosakata → vocabulary", () => {
    expect(classifySkill("Apa arti kata 'apple'?", "Kosakata baru.", "text")).toBe("vocabulary");
  });
  it("fallback → grammar", () => {
    expect(classifySkill("Pilih kalimat yang benar", "Pola kalimat.", "text")).toBe("grammar");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/weakness.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasi `lib/weakness.ts`**

```ts
import { db } from "./db";

const GRAMMAR_TENSE_KEYWORDS = ["tense", "past", "present", "future"];
const GRAMMAR_PREPOSITION_KEYWORDS = ["preposition", " in ", " on ", " at "];
const GRAMMAR_ARTICLE_KEYWORDS = ["article", " a ", " an ", " the "];
const VOCABULARY_KEYWORDS = ["vocabulary", "word choice"];
const SKILL_LISTENING = ["pengucapan", "pendengaran", "suara"];
const SKILL_VOCABULARY = ["kosakata", "arti kata", "sinonim", "terjemahan", "makna", "kata ini"];

export function classifyWeaknessTopic(explanation: string): string {
  const e = explanation.toLowerCase();
  if (GRAMMAR_TENSE_KEYWORDS.some((k) => e.includes(k))) return "Grammar: Tense";
  if (GRAMMAR_PREPOSITION_KEYWORDS.some((k) => e.includes(k))) return "Grammar: Preposition";
  if (GRAMMAR_ARTICLE_KEYWORDS.some((k) => e.includes(k))) return "Grammar: Article";
  if (VOCABULARY_KEYWORDS.some((k) => e.includes(k))) return "Vocabulary: Word Choice";
  return "General: Answer Accuracy";
}

export function classifySkill(
  question: string,
  explanation: string,
  questionType: string
): "listening" | "vocabulary" | "grammar" {
  const text = `${question} ${explanation}`.toLowerCase();
  if (questionType === "listening") return "listening";
  if (SKILL_LISTENING.some((k) => text.includes(k))) return "listening";
  if (SKILL_VOCABULARY.some((k) => text.includes(k))) return "vocabulary";
  return "grammar";
}

export async function logWeakness(email: string, language: string, topic: string, note: string): Promise<void> {
  if (!topic.trim() || !note.trim()) return;
  await db.weaknessLog.create({ data: { email, language, topic, note } });
}

export async function logSkillProgress(email: string, language: string, skill: string, isCorrect: boolean): Promise<void> {
  const s = skill.toLowerCase();
  if (!["grammar", "vocabulary", "listening"].includes(s)) return;
  await db.skillProgressLog.create({ data: { email, language, skill: s, isCorrect } });
}

export async function getTopWeaknesses(email: string, language: string, limit: number): Promise<{ topic: string; count: number }[]> {
  const safeLimit = limit <= 0 ? 3 : Math.min(limit, 10);
  const rows = await db.weaknessLog.groupBy({
    by: ["topic"],
    where: { email, language },
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: safeLimit,
  });
  return rows.map((r) => ({ topic: r.topic, count: r._count.topic }));
}

export async function getPriorityWeakness(email: string, language: string): Promise<string | null> {
  const rows = await db.weaknessLog.groupBy({
    by: ["topic"],
    where: { email, language },
    _count: { topic: true },
    orderBy: { _count: { topic: "desc" } },
    take: 1,
  });
  return rows[0]?.topic ?? null;
}
```

Catatan: `getPriorityWeakness` legacy memakai rate 7d vs 30d — penyederhanaan ke top count untuk fase 2a adalah perbaikan kecil yang wajar (dipakai weakness practice di 2b; quiz hanya butuh top-3). Boleh juga port rate penuh bila ingin — konsistensi dengan legacy lebih utama; pilih salah satu dan catat di report.

- [ ] **Step 4: Run — harus lulus**

Run: `npx npm test` → 42 test pass (34 + 8 baru).

- [ ] **Step 5: Commit**

```bash
git add lib/weakness.ts lib/weakness.test.ts
git commit -m "feat: weakness classifiers and logs (TDD)"
```

---

### Task 5: lib/ai-content/parse.ts — parse JSON AI (TDD)

**Files:**
- Create: `lib/ai-content/parse.ts`, `lib/ai-content/parse.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  export function parseAiJson<T>(text: string): T | null
  // strip fense ```json ... ```, ambil potongan {...} terluar, JSON.parse; null jika gagal
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/ai-content/parse.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseAiJson } from "./parse";

describe("parseAiJson", () => {
  it("JSON polos", () => {
    expect(parseAiJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
  it("dibungkus fense ```json", () => {
    expect(parseAiJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("fense tanpa label json", () => {
    expect(parseAiJson<{ a: number }>('```\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("ada prosa sebelum/sesudah JSON", () => {
    expect(parseAiJson<{ a: number }>('Berikut hasilnya: {"a":3} Sekian.')).toEqual({ a: 3 });
  });
  it("invalid → null", () => {
    expect(parseAiJson("{not json}")).toBeNull();
  });
  it("kosong → null", () => {
    expect(parseAiJson("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/ai-content/parse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasi `lib/ai-content/parse.ts`**

```ts
export function parseAiJson<T>(text: string): T | null {
  let t = text.trim();
  if (!t) return null;
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run — harus lulus**

Run: `npx npm test` → 48 test pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai-content/parse.ts lib/ai-content/parse.test.ts
git commit -m "feat: robust AI JSON parser (TDD)"
```

---

### Task 6: lib/ai-content/lesson.ts — generateLesson (prompt port + enrichment)

**Files:**
- Create: `lib/ai-content/lesson.ts`
- Modify: `lib/types.ts` (tambah `LessonContainer`)

**Interfaces:**
- Consumes: `model` (lib/ai.ts), `generateText` (ai), `parseAiJson` (Task 5)
- Produces:
  ```ts
  // lib/types.ts
  export interface VocabularyItem { word: string; meaning: string; }
  export interface ExampleSentence { target: string; meaning: string; }
  export interface LessonContainer {
    title: string; content: string;
    vocabulary: VocabularyItem[]; example_sentences: ExampleSentence[];
  }

  // lib/ai-content/lesson.ts
  export function buildLessonPrompt(language: string, level: string, goal: string, part: number, modifier: string): string
  export function isRichLesson(lesson: LessonContainer): boolean
  export async function generateLesson(params: { language: string; level: string; goal: string; part: number; modifier: string }): Promise<LessonContainer>
  // throw Error dengan pesan Indonesia; panggil buildLessonPrompt → generateText → parse → validasi →
  // jika !isRichLesson → 1x enrichment re-prompt → parse → validasi final
  ```

- [ ] **Step 1: Tambah tipe ke `lib/types.ts`**

```ts
export interface VocabularyItem { word: string; meaning: string; }
export interface ExampleSentence { target: string; meaning: string; }
export interface LessonContainer {
  title: string;
  content: string;
  vocabulary: VocabularyItem[];
  example_sentences: ExampleSentence[];
}
```

- [ ] **Step 2: Implementasi `lib/ai-content/lesson.ts`**

Prompt port dari `dioxus/src/services/gemini/lesson.rs:162-183` (verbatim, dengan placeholder diisi):

```ts
import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { LessonContainer } from "../types";

const MODIFIER_SUFFIX: Record<string, string> = {
  hard: "Instruksi Adaptif: Pengguna memiliki performa yang sangat baik dan konsisten. Tingkatkan sedikit kerumitan tata bahasa dan gunakan kosakata yang lebih menantang (di ambang atas level ini).",
  easy: "Instruksi Adaptif: Pengguna sedang kesulitan menjaga konsistensi. Sederhanakan bahasa, gunakan kalimat yang lebih pendek, dan fokus pada konsep dasar agar lebih mudah dipahami.",
  normal: "",
};

export function buildLessonPrompt(
  language: string,
  level: string,
  goal: string,
  part: number,
  modifier: string
): string {
  const partNote = part <= 1
    ? "Ini bagian pertama."
    : "Ini materi lanjutan. Hindari mengulang penjelasan inti yang sama persis dengan bagian sebelumnya. Tambahkan variasi pola, konteks, dan contoh berbeda.";
  const modifierPrompt = MODIFIER_SUFFIX[modifier] ?? "";
  return [
    `TARGET BAHASA MATERI: ${language} (Penjelasan 'content' dalam bahasa Indonesia, TAPI isi 'vocabulary' dan kalimat target pada 'example_sentences' WAJIB dalam bahasa ${language}).`,
    "",
    `Buat satu materi pelajaran KOMPREHENSIF untuk bahasa ${language} level CEFR ${level} dengan tujuan belajar: ${goal}.`,
    `Serial materi: Bagian ke-${part}. ${partNote}${modifierPrompt}`,
    "Pedoman level:",
    "- A1/A2: konkret, sederhana, fokus pola dasar.",
    "- B1/B2: lebih variatif, kontras penggunaan, situasi nyata.",
    "- C1/C2: nuansa makna, register formal/informal, konteks natural.",
    "Kualitas wajib:",
    "- content harus cukup detail untuk belajar mandiri 10-15 menit.",
    "- content tulis dalam Bahasa Indonesia.",
    "- field 'content' WAJIB diformat menggunakan HTML (Gunakan tag seperti <br>, <b>, <i>, atau list HTML <ul><li> jika perlu) agar tampil rapi di UI.",
    "- content WAJIB dipisah rapi dengan judul bagian: Konsep Inti / Pola / Kesalahan Umum / Tips Praktik.",
    "- vocabulary minimal 8 item. 'word' WAJIB bahasa target, 'meaning' WAJIB Bahasa Indonesia.",
    "- example_sentences minimal 8 kalimat. 'target' WAJIB bahasa target, 'meaning' WAJIB Bahasa Indonesia.",
    "- hindari penjelasan terlalu umum.",
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"title\": string, \"content\": string, \"vocabulary\": [{\"word\": string, \"meaning\": string}], \"example_sentences\": [{\"target\": string, \"meaning\": string}]}",
  ].join("\n");
}

export function isRichLesson(lesson: LessonContainer): boolean {
  return (
    lesson.content.length >= 700 &&
    lesson.vocabulary.length >= 6 &&
    lesson.example_sentences.length >= 6
  );
}

export async function generateLesson(params: {
  language: string;
  level: string;
  goal: string;
  part: number;
  modifier: string;
}): Promise<LessonContainer> {
  const { language, level, goal, part, modifier } = params;
  const prompt = buildLessonPrompt(language, level, goal, part, modifier);

  const first = await generateText({ model, prompt, maxOutputTokens: 4096 });
  let lesson = parseAiJson<LessonContainer>(first.text);
  if (!lesson) throw new Error("Gagal parsing respons lesson: respons bukan JSON valid.");

  if (!isRichLesson(lesson)) {
    const enrichmentPrompt = `${prompt}\n\nRespons sebelumnya kurang lengkap. Perbaiki JSON berikut agar memenuhi semua syarat kualitas (content >= 700 karakter, vocabulary >= 6, example_sentences >= 6):\n${JSON.stringify(lesson)}`;
    const second = await generateText({ model, prompt: enrichmentPrompt, maxOutputTokens: 4096 });
    const improved = parseAiJson<LessonContainer>(second.text);
    if (improved) lesson = improved;
  }

  if (!lesson.title || !lesson.content) {
    throw new Error("Respons lesson tidak valid: judul atau konten kosong.");
  }
  return lesson;
}
```

Catatan: baris terakhir prompt menambah instruksi "Kembalikan HANYA JSON valid..." — pengganti `responseSchema` Gemini (endpoint openai-compatible tidak mendukungnya).

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih.
Run: `npm test` — 48 pass.
AI smoke nyata (boleh — 1 panggilan): 
```powershell
npx tsx --env-file=.env -e "import { generateLesson } from './lib/ai-content/lesson'; generateLesson({ language: 'English', level: 'A1', goal: 'Greetings & Introductions', part: 1, modifier: 'normal' }).then(l => { console.log('LESSON OK:', l.title, '| content len:', l.content.length, '| vocab:', l.vocabulary.length, '| examples:', l.example_sentences.length); process.exit(0); }).catch(e => { console.error('LESSON FAIL:', e.message); process.exit(1); })"
```
Expected: `LESSON OK: <judul> | content len: >=700 | vocab: >=6 | examples: >=6`. Jika gagal (biaya/token), laporkan error mentah — jangan di-mask.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/ai-content/lesson.ts
git commit -m "feat: lesson generation via AI SDK (prompt port + enrichment)"
```

---

### Task 7: lib/ai-content/quiz.ts — normalize + validate + quality + retry (TDD)

**Files:**
- Create: `lib/ai-content/quiz.ts`, `lib/ai-content/quiz.test.ts`
- Modify: `lib/types.ts` (tambah `QuizQuestion`, `QuizContainer`)

**Interfaces:**
- Consumes: `model`, `generateText`, `parseAiJson` (Task 5)
- Produces:
  ```ts
  // lib/types.ts
  export interface QuizQuestion {
    question: string; question_type: string; listen_text: string;
    options: string[]; correct_answer: string; explanation: string;
  }
  export interface QuizContainer { questions: QuizQuestion[]; }

  // lib/ai-content/quiz.ts
  export function normalizeQuiz(container: QuizContainer): QuizContainer
  export function validateQuizShape(questions: QuizQuestion[], expectedCount: number): string[]
  export function qualityIssues(questions: QuizQuestion[], expectedCount: number, weaknessFocus?: string): string[]
  export function buildQuizPrompt(language: string, level: string, goal: string, weaknessContext: string): string
  export async function generateQuiz(params: { language: string; level: string; goal: string; weaknessContext: string }): Promise<QuizContainer>
  // 3 percobaan: buildQuizPrompt(+feedback) → generateText({temperature:0.6}) → normalize → validate →
  // quality (score 100-10/issue; early return jika 0 issue atau >=92); throw jika gagal semua
  export function shuffleOptions(container: QuizContainer): QuizContainer
  // shuffle options tiap soal (dan correct_answer ikut nilai string — tidak berubah)
  ```

- [ ] **Step 1: Tambah tipe**

```ts
export interface QuizQuestion {
  question: string;
  question_type: string;
  listen_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}
export interface QuizContainer { questions: QuizQuestion[]; }
```

- [ ] **Step 2: Tulis tes gagal**

Create `lib/ai-content/quiz.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { normalizeQuiz, qualityIssues, shuffleOptions, validateQuizShape } from "./quiz";
import type { QuizQuestion } from "../types";

function q(over: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    question: "What is the capital of France?",
    question_type: "text",
    listen_text: "",
    options: ["Paris", "London", "Rome", "Berlin"],
    correct_answer: "Paris",
    explanation: "Ibukota Prancis adalah Paris. Ini pengetahuan dasar.",
    ...over,
  };
}

describe("normalizeQuiz", () => {
  it("strip prefix opsi A) B. C: D)", () => {
    const c = normalizeQuiz({ questions: [q({ options: ["A) Paris", "B) London", "C) Rome", "D) Berlin"] })] });
    expect(c.questions[0].options[0]).toBe("Paris");
  });
  it("lowercase question_type", () => {
    const c = normalizeQuiz({ questions: [q({ question_type: "LISTENING", listen_text: "audio" })] });
    expect(c.questions[0].question_type).toBe("listening");
  });
  it("correct_answer yang sudah strip tetap cocok", () => {
    const c = normalizeQuiz({ questions: [q({ options: ["A) Paris", "London", "Rome", "Berlin"], correct_answer: "A) Paris" })] });
    expect(c.questions[0].correct_answer).toBe("Paris");
  });
  it("question text di-collapse whitespace", () => {
    const c = normalizeQuiz({ questions: [q({ question: "Halo   dunia\n  apa kabar?" })] });
    expect(c.questions[0].question).toBe("Halo dunia apa kabar?");
  });
});

describe("validateQuizShape", () => {
  it("valid → []", () => {
    expect(validateQuizShape([q(), q(), q(), q(), q()], 5)).toEqual([]);
  });
  it("jumlah salah → error", () => {
    const errs = validateQuizShape([q()], 5);
    expect(errs[0]).toContain("Format quiz tidak valid: wajib 5 pertanyaan.");
  });
  it("opsi tidak 4 → error", () => {
    const errs = validateQuizShape([q({ options: ["a", "b"] })], 1);
    expect(errs.some((e) => e.includes("4 opsi"))).toBe(true);
  });
  it("correct_answer tidak cocok → error", () => {
    const errs = validateQuizShape([q({ correct_answer: "Tidak Ada" })], 1);
    expect(errs.some((e) => e.includes("kunci jawaban"))).toBe(true);
  });
  it("listening tanpa listen_text cukup → error", () => {
    const errs = validateQuizShape([q({ question_type: "listening", listen_text: "abc" })], 1);
    expect(errs.some((e) => e.includes("listen_text"))).toBe(true);
  });
});

describe("qualityIssues", () => {
  it("soal duplikat → issue", () => {
    const issues = qualityIssues([q(), q(), q(), q(), q({ question: "What is the capital of France?" })], 5);
    expect(issues.some((i) => i.includes("terduplikasi"))).toBe(true);
  });
  it("soal terlalu pendek → issue", () => {
    const issues = qualityIssues([q({ question: "Hai?" })], 1);
    expect(issues.some((i) => i.includes("terlalu pendek"))).toBe(true);
  });
  it("kurang dari 2 listening → issue", () => {
    const issues = qualityIssues([q(), q(), q(), q(), q()], 5);
    expect(issues.some((i) => i.includes("listening"))).toBe(true);
  });
  it("pola ambigu → issue", () => {
    const issues = qualityIssues([q({ options: ["Paris", "London", "Rome", "Semua jawaban benar"] })], 1);
    expect(issues.some((i) => i.includes("ambigu"))).toBe(true);
  });
  it("listening cukup & variasi skill → bersih", () => {
    const list = q({ question_type: "listening", listen_text: "Dengarkan audio ini dan jawab", question: "Apa yang didengar?" });
    const vocab = q({ question: "Sinonim dari kata 'happy' adalah?" });
    const issues = qualityIssues([list, list, vocab, q(), q()], 5);
    expect(issues).toEqual([]);
  });
});

describe("shuffleOptions", () => {
  it("opsi tetap 4 dan berisi jawaban benar", () => {
    const c = shuffleOptions({ questions: [q()] });
    expect(c.questions[0].options).toHaveLength(4);
    expect(c.questions[0].options).toContain("Paris");
  });
  it("setiap elemen tetap ada (permutasi)", () => {
    const original = ["Paris", "London", "Rome", "Berlin"];
    const c = shuffleOptions({ questions: [q()] });
    expect([...c.questions[0].options].sort()).toEqual([...original].sort());
  });
});
```

- [ ] **Step 3: Run — harus gagal**

Run: `npx vitest run lib/ai-content/quiz.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementasi `lib/ai-content/quiz.ts`**

```ts
import { generateText } from "ai";
import { model } from "../ai";
import { parseAiJson } from "./parse";
import type { QuizContainer, QuizQuestion } from "../types";

const AMBIGUOUS_PATTERNS = ["all of the above", "semua jawaban benar", "both a and b"];
const SKILL_KEYWORDS: Record<string, string[]> = {
  listening: ["dengar", "listen", "audio", "pengucapan", "pendengaran", "suara"],
  vocabulary: ["kosakata", "arti kata", "sinonim", "terjemahan", "makna", "kata ini", "vocabulary"],
};

function stripChoicePrefix(s: string): string {
  return s.replace(/^\s*[A-H][.)]\s*/, "").trim();
}

export function normalizeQuiz(container: QuizContainer): QuizContainer {
  return {
    questions: container.questions.map((qq) => {
      const options = qq.options.map((o) => stripChoicePrefix(o));
      let correct = stripChoicePrefix(qq.correct_answer);
      if (!options.includes(correct)) {
        const match = options.find((o) => o.toLowerCase() === correct.toLowerCase());
        if (match) correct = match;
      }
      const questionType = (qq.question_type ?? "text").toLowerCase() === "listening" ? "listening" : "text";
      const listenText = (qq.listen_text ?? "").replace(/\s+/g, " ").trim();
      return {
        question: (qq.question ?? "").replace(/\s+/g, " ").trim(),
        question_type: questionType,
        listen_text: questionType === "text" && !listenText ? (qq.question ?? "").replace(/\s+/g, " ").trim() : listenText,
        options,
        correct_answer: correct,
        explanation: (qq.explanation ?? "").replace(/\s+/g, " ").trim(),
      };
    }),
  };
}

export function validateQuizShape(questions: QuizQuestion[], expectedCount: number): string[] {
  const errs: string[] = [];
  if (questions.length !== expectedCount) {
    errs.push(`Format quiz tidak valid: wajib ${expectedCount} pertanyaan.`);
    return errs;
  }
  questions.forEach((qq, i) => {
    const n = i + 1;
    if (!qq.question) errs.push(`Format quiz tidak valid: pertanyaan ke-${n} kosong.`);
    if (!qq.explanation) errs.push(`Format quiz tidak valid: explanation pertanyaan ke-${n} kosong.`);
    if (!qq.options || qq.options.length !== 4) errs.push(`Format quiz tidak valid: pertanyaan ke-${n} harus punya 4 opsi.`);
    else {
      if (qq.options.some((o) => !o.trim())) errs.push(`Format quiz tidak valid: ada opsi kosong di pertanyaan ke-${n}.`);
      if (new Set(qq.options).size !== 4) errs.push(`Format quiz tidak valid: ada opsi duplikat di pertanyaan ke-${n}.`);
    }
    if (!qq.correct_answer || !qq.options.includes(qq.correct_answer)) errs.push(`Format quiz tidak valid: kunci jawaban pertanyaan ke-${n} tidak cocok dengan opsi.`);
    if (qq.question_type !== "text" && qq.question_type !== "listening") errs.push(`Format quiz tidak valid: question_type pertanyaan ke-${n} harus 'text' atau 'listening'.`);
    if (qq.question_type === "listening" && (qq.listen_text ?? "").length < 6) errs.push(`Format quiz tidak valid: listen_text pertanyaan listening ke-${n} terlalu singkat/kosong.`);
  });
  return errs;
}

function classifyQuestionSkill(qq: QuizQuestion): "listening" | "vocabulary" | "grammar" {
  const text = `${qq.question} ${qq.listen_text ?? ""} ${qq.explanation}`.toLowerCase();
  if (qq.question_type === "listening") return "listening";
  if (SKILL_KEYWORDS.listening.some((k) => text.includes(k))) return "listening";
  if (SKILL_KEYWORDS.vocabulary.some((k) => text.includes(k))) return "vocabulary";
  return "grammar";
}

export function qualityIssues(questions: QuizQuestion[], expectedCount: number, weaknessFocus?: string): string[] {
  const issues: string[] = [];
  questions.forEach((qq, i) => {
    const n = i + 1;
    const seen = questions.findIndex((x, j) => j < i && x.question === qq.question);
    if (seen >= 0) issues.push(`Pertanyaan ke-${n} terduplikasi.`);
    if (qq.question.length < 15) issues.push(`Pertanyaan ke-${n} terlalu pendek.`);
    if (qq.explanation.length < 40) issues.push(`Explanation pertanyaan ke-${n} terlalu singkat.`);
    if (qq.options.some((o) => AMBIGUOUS_PATTERNS.some((p) => o.toLowerCase().includes(p))))
      issues.push(`Pertanyaan ke-${n} mengandung pola opsi ambigu.`);
  });
  const skills = new Set(questions.map(classifyQuestionSkill));
  if (skills.size < 2) issues.push("Komposisi skill kurang variatif (minimal 2 skill berbeda).");
  const listeningCount = questions.filter((x) => x.question_type === "listening").length;
  const minListening = expectedCount >= 5 ? 2 : 1;
  if (listeningCount < minListening) issues.push(`Jumlah soal listening kurang: minimal ${minListening} dari ${expectedCount} soal.`);
  const positions = questions.map((x) => x.options.indexOf(x.correct_answer)).filter((p) => p >= 0);
  if (positions.length > 0) {
    const counts = positions.reduce<Record<number, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {});
    if (Math.max(...Object.values(counts)) >= Math.max(2, questions.length - 1))
      issues.push("Posisi jawaban benar terlalu bias pada pilihan yang sama.");
  }
  if (weaknessFocus && expectedCount > 1) {
    const tokens = weaknessFocus.toLowerCase().split(/\s+/);
    const focused = questions.filter((x) => tokens.some((t) => x.question.toLowerCase().includes(t) || x.explanation.toLowerCase().includes(t))).length;
    if (focused < Math.max(1, expectedCount - 1)) issues.push("Soal belum cukup fokus pada topik weakness yang ditargetkan.");
  }
  return issues;
}

export function buildQuizPrompt(language: string, level: string, goal: string, weaknessContext: string): string {
  const context = weaknessContext || "(belum ada riwayat kelemahan)";
  return [
    `TARGET BAHASA SOAL: ${language} (WAJIB! Seluruh pertanyaan, teks, dan opsi jawaban harus dalam bahasa ini, BUKAN bahasa Indonesia).`,
    `Buat 5 soal kuis pilihan ganda bahasa ${language} untuk level CEFR ${level} dengan topik pembelajaran/goal: '${goal}'.`,
    "1) SEMUA SOAL WAJIB menguji kosakata, tata bahasa, atau pemahaman bahasa terkait erat dengan topik '${goal}'. HANYA fokus pada pembelajaran bahasa untuk topik ini! DILARANG KERAS membuat soal pengetahuan umum (trivia)!",
    "2) Setiap soal 4 opsi, hanya 1 benar.",
    "3) Jangan gunakan opsi 'semua benar', 'both A and B', atau trik ambigu.",
    "4) Explanation wajib dalam Bahasa Indonesia minimal 2 kalimat singkat dan spesifik.",
    "5) Variasikan tipe soal: grammar, vocabulary, contextual comprehension, dan listening.",
    "6) WAJIB sertakan minimal 2 soal bertipe listening dan minimal 1 soal khusus Vocabulary (terjemahan, sinonim, atau makna kata).",
    "7) Pertahankan kosakata sesuai level CEFR.",
    "8) Sertakan minimal 1 soal model cloze (isian) dengan placeholder '__'.",
    "9) question_type: 'listening' atau 'text'; listen_text: teks audio TTS untuk listening; question untuk listening = instruksi TANPA transcript, WAJIB format HTML (<br>, <b>, <i>, jangan tag root); text → listen_text boleh kosong, question WAJIB HTML (misal '<b>A:</b> Hello<br><b>B:</b> Hi!').",
    "10) question, options, correct_answer, listen_text WAJIB FULL bahasa target; explanation tetap Bahasa Indonesia.",
    `11) Konteks kelemahan user: ${context}. Gunakan untuk menyesuaikan soal remedial ringan.`,
    "",
    "Kembalikan HANYA JSON valid dengan bentuk: {\"questions\": [{\"question\": string, \"question_type\": \"text\"|\"listening\", \"listen_text\": string, \"options\": [string x4], \"correct_answer\": string, \"explanation\": string}]}",
  ].join("\n");
}

function qualityScore(issues: string[]): number {
  return Math.max(0, 100 - issues.length * 10);
}

export async function generateQuiz(params: {
  language: string;
  level: string;
  goal: string;
  weaknessContext: string;
}): Promise<QuizContainer> {
  const { language, level, goal, weaknessContext } = params;
  let prompt = buildQuizPrompt(language, level, goal, weaknessContext);
  let best: QuizContainer | null = null;
  let bestScore = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { text } = await generateText({ model, prompt, maxOutputTokens: 4096, temperature: 0.6 });
    const parsed = parseAiJson<QuizContainer>(text);
    if (!parsed) {
      prompt += `\n\nRespons tidak valid (bukan JSON). Kembalikan HANYA JSON.`;
      continue;
    }
    const normalized = normalizeQuiz(parsed);
    const shapeErrors = validateQuizShape(normalized.questions, 5);
    const issues = shapeErrors.length > 0 ? shapeErrors : qualityIssues(normalized.questions, 5);
    const score = qualityScore(issues);
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
    if (issues.length === 0 || score >= 92) {
      return normalized;
    }
    prompt += `\n\nRespons sebelumnya bermasalah: ${issues.join("; ")}. Perbaiki JSON sesuai syarat.`;
  }

  if (best) return best;
  throw new Error("Gagal menghasilkan quiz yang valid setelah beberapa percobaan.");
}

export function shuffleOptions(container: QuizContainer): QuizContainer {
  return {
    questions: container.questions.map((qq) => {
      const options = [...qq.options];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return { ...qq, options };
    }),
  };
}
```

- [ ] **Step 5: Run — harus lulus**

Run: `npx npm test` → 62 test pass (48 + 14 baru).

- [ ] **Step 6: AI smoke (boleh, 1 panggilan)**

```powershell
npx tsx --env-file=.env -e "import { generateQuiz } from './lib/ai-content/quiz'; generateQuiz({ language: 'English', level: 'A1', goal: 'Greetings & Introductions', weaknessContext: '' }).then(z => { console.log('QUIZ OK:', z.questions.length, 'questions'); process.exit(0); }).catch(e => { console.error('QUIZ FAIL:', e.message); process.exit(1); })"
```
Expected: `QUIZ OK: 5 questions`.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/ai-content/quiz.ts lib/ai-content/quiz.test.ts
git commit -m "feat: quiz generation pipeline (normalize, validate, quality, retry)"
```

---

### Task 8: Server actions — lesson, quiz, flashcard (+ cache)

**Files:**
- Create: `lib/actions/lesson.ts`, `lib/actions/quiz.ts`, `lib/actions/flashcard.ts`
- Modify: `lib/dashboard.ts` (export `getEngagementStats` sudah ada — tidak perlu)

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `getEngagementStats` (lib/dashboard.ts), `getCurriculum`, `getLanguages`, `getTopWeaknesses` (Task 4), `generateLesson` (Task 6), `generateQuiz` + `shuffleOptions` (Task 7), `addFlashcards`/`getDueFlashcards`/`reviewFlashcard` (Task 3), `logWeakness`/`logSkillProgress`/`classifyWeaknessTopic`/`classifySkill` (Task 4), `applyQuizResult`/`updateEngagementAfterQuiz`/`deductHeart` (Task 2), `incrementCorrectAnswers` (Task 2), `parseAiJson` (Task 5)
- Produces:
  ```ts
  // lib/actions/lesson.ts
  export async function getLessonAction(goal: string, part: number): Promise<
    { lesson: LessonContainer; language: string } | { error: string }
  >
  // modifier: streak>=3 & totalQuizCompleted>=5 → hard; totalQuizCompleted>0 & streak===0 → easy; else normal
  // cache: db.cachedLesson.findFirst({ where: { language, level, goal, part, modifier } })
  //   → parseAiJson(contentJson) → jika null/validasi gagal → generate + create baru

  // lib/actions/quiz.ts
  export interface RecordAnswerInput {
    language: string; question: string; selected: string; correct: string;
    explanation: string; questionType: string;
  }
  export async function getQuizAction(goal: string): Promise<{ quiz: QuizContainer; language: string } | { error: string }>
  // level dari profile; konteks kelemahan: getTopWeaknesses(email, language, 3) → "- {topic} ({cnt}x)" join "\n"
  // cache: count db.cachedQuiz (language, level, goal, 'normal') < 5 → generate + create; >= 5 → random pick
  //   random pick: findMany → pilih acak → parseAiJson → fallback generate jika parse gagal
  // shuffleOptions sebelum return
  export async function recordAnswerAction(input: RecordAnswerInput): Promise<{ hearts: number } | { error: string }>
  // session; addFlashcards (front=question, back=`Jawaban benar: {correct} | Penjelasan: {explanation}`)
  // jika input.correct === input.selected (client sudah cek, server tidak re-check — setia pada asli):
  //   sebenarnya server TIDAK perlu tahu benar/salah untuk log; kirim isCorrect dari client? TIDAK —
  //   port setia: client tidak kirim isCorrect; server compare string untuk side effects:
  //   const isCorrect = input.selected === input.correct;
  //   isCorrect → logSkillProgress(skill, true); else → deductHeart + logWeakness(classify...) + logSkillProgress(false)
  // return { hearts }
  export async function submitQuizResultAction(input: { goal: string; language: string; score: number; correctCount: number }): Promise<{ profile: UserProfile } | { error: string }>
  // session → incrementCorrectAnswers(email, correctCount) → applyQuizResult(email, language, goal, score) → updateEngagementAfterQuiz(email, score) → { profile }

  // lib/actions/flashcard.ts
  export async function getDueFlashcardsAction(limit: number): Promise<{ cards: FlashcardItem[] } | { error: string }>
  export async function reviewFlashcardAction(id: number, quality: number): Promise<ActionResult>
  export async function addFlashcardsAction(cards: NewFlashcard[]): Promise<ActionResult>
  ```

- [ ] **Step 1: Implementasi `lib/actions/lesson.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getEngagementStats } from "../dashboard";
import { generateLesson } from "../ai-content/lesson";
import { parseAiJson } from "../ai-content/parse";
import { db } from "../db";
import type { LessonContainer } from "../types";

function computeModifier(streak: number, quizzes: number): string {
  if (streak >= 3 && quizzes >= 5) return "hard";
  if (quizzes > 0 && streak === 0) return "easy";
  return "normal";
}

export async function getLessonAction(
  goal: string,
  part: number
): Promise<{ lesson: LessonContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";
  const safePart = Math.max(1, part);

  const stats = await getEngagementStats(session.email);
  const modifier = computeModifier(stats?.current_streak ?? 0, stats?.total_quiz_completed ?? 0);

  const cached = await db.cachedLesson.findFirst({
    where: { language, level, goal, part: safePart, modifier },
  });
  if (cached) {
    const parsed = parseAiJson<LessonContainer>(cached.contentJson);
    if (parsed && parsed.title && parsed.content) {
      return { lesson: parsed, language };
    }
  }

  const lesson = await generateLesson({ language, level, goal, part: safePart, modifier });
  await db.cachedLesson.create({
    data: { language, level, goal, part: safePart, modifier, contentJson: JSON.stringify(lesson) },
  });
  return { lesson, language };
}
```

- [ ] **Step 2: Implementasi `lib/actions/quiz.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getEngagementStats } from "../dashboard";
import { getTopWeaknesses, logSkillProgress, logWeakness, classifySkill, classifyWeaknessTopic } from "../weakness";
import { generateQuiz, shuffleOptions } from "../ai-content/quiz";
import { parseAiJson } from "../ai-content/parse";
import { addFlashcards } from "../flashcards";
import { applyQuizResult, deductHeart, updateEngagementAfterQuiz } from "../progress";
import { incrementCorrectAnswers } from "../mission";
import { db } from "../db";
import type { QuizContainer, UserProfile } from "../types";

export interface RecordAnswerInput {
  language: string;
  question: string;
  selected: string;
  correct: string;
  explanation: string;
  questionType: string;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function getQuizAction(goal: string): Promise<{ quiz: QuizContainer; language: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const level = (profile.current_level[language] ?? "A1.0").split(".")[0] || "A1";

  const topWeak = await getTopWeaknesses(session.email, language, 3);
  const weaknessContext = topWeak.length
    ? topWeak.map((w) => `- ${w.topic} (${w.count}x)`).join("\n")
    : "";

  const variantCount = await db.cachedQuiz.count({ where: { language, level, goal, modifier: "normal" } });
  const variants = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier: "normal" } });

  let quiz: QuizContainer | null = null;

  if (variantCount >= 5 && variants.length > 0) {
    const picked = randomPick(variants);
    quiz = parseAiJson<QuizContainer>(picked.contentJson);
  }

  if (!quiz) {
    quiz = await generateQuiz({ language, level, goal, weaknessContext });
    await db.cachedQuiz.create({
      data: { language, level, goal, modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  }

  return { quiz: shuffleOptions(quiz), language };
}

export async function recordAnswerAction(input: RecordAnswerInput): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const { language, question, selected, correct, explanation, questionType } = input;

  await addFlashcards(session.email, [
    { language, front_text: question, back_text: `Jawaban benar: ${correct} | Penjelasan: ${explanation}` },
  ]);

  const isCorrect = selected === correct;
  const skill = classifySkill(question, explanation, questionType);

  if (isCorrect) {
    await logSkillProgress(session.email, language, skill, true);
    return { hearts: (await getEngagementStats(session.email))?.hearts ?? 5 };
  }

  await logWeakness(
    session.email,
    language,
    classifyWeaknessTopic(explanation),
    `Q: ${question} | Selected: ${selected} | Correct: ${correct}`
  );
  await logSkillProgress(session.email, language, skill, false);
  const { hearts } = await deductHeart(session.email);
  return { hearts };
}

export async function submitQuizResultAction(input: {
  goal: string;
  language: string;
  score: number;
  correctCount: number;
}): Promise<{ profile: UserProfile } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  await incrementCorrectAnswers(session.email, input.correctCount);
  const profile = await applyQuizResult(session.email, input.language, input.goal, input.score);
  await updateEngagementAfterQuiz(session.email, input.score);
  return { profile };
}
```

- [ ] **Step 3: Implementasi `lib/actions/flashcard.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getDueFlashcards, reviewFlashcard } from "../flashcards";
import type { ActionResult } from "./types";
import type { FlashcardItem, NewFlashcard } from "../types";

export async function getDueFlashcardsAction(limit: number): Promise<{ cards: FlashcardItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const cards = await getDueFlashcards(session.email, profile.preferred_language, limit);
  return { cards };
}

export async function reviewFlashcardAction(id: number, quality: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    await reviewFlashcard(id, quality);
    return { message: "ok" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan review flashcard." };
  }
}

export async function addFlashcardsAction(cards: NewFlashcard[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await addFlashcards(session.email, cards);
  return { message: "ok" };
}
```

Catatan: `getDueFlashcardsAction` butuh `getUserProfile` — tambahkan import `getUserProfile` dari `../profile`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit` — bersih.
Run: `npm test` — 62 pass.
Run: `npm run lint` — 0 error.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/lesson.ts lib/actions/quiz.ts lib/actions/flashcard.ts
git commit -m "feat: lesson/quiz/flashcard server actions with caching and session guard"
```

---

### Task 9: Sanitize + SpeakButton + Roadmap page + navbar

**Files:**
- Create: `lib/sanitize.ts`, `components/SpeakButton.tsx`, `app/(app)/roadmap/page.tsx`, `components/RoadmapClient.tsx`
- Modify: `components/Navbar.tsx` (tambah link Kurikulum)
- Install: `npm install sanitize-html` + `npm install -D @types/sanitize-html`

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `getLanguages`, `getCurriculum` (lib/dashboard.ts), tipe `LanguageCourse`/`CurriculumLevel`/`UserProfile`
- Produces:
  ```ts
  // lib/sanitize.ts
  export function sanitizeHtml(dirty: string): string
  // sanitize-html whitelist: br, b, i, u, strong, em, p, ul, ol, li, a[href], blockquote, code, h3, h4

  // components/SpeakButton.tsx
  export default function SpeakButton({ text, lang, rate = 0.95 }: { text: string; lang: string; rate?: number })
  // client; speechSynthesis; toggle 🔊/⏹; cancel on unmount; disabled jika !("speechSynthesis" in window)
  ```

- [ ] **Step 1: Install + tulis `lib/sanitize.ts`**

```bash
npm install sanitize-html
npm install -D @types/sanitize-html
```

```ts
import sanitizeHtmlLib from "sanitize-html";

const ALLOWED_TAGS = ["br", "b", "i", "u", "strong", "em", "p", "ul", "ol", "li", "a", "blockquote", "code", "h3", "h4"];
const ALLOWED_ATTR = { a: ["href", "target", "rel"] };

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ["http", "https"],
  });
}
```

- [ ] **Step 2: Tulis `components/SpeakButton.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function SpeakButton({
  text,
  lang,
  rate = 0.95,
}: {
  text: string;
  lang: string;
  rate?: number;
}) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  function toggle() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Putar suara"
      className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
    >
      {speaking ? "⏹" : "🔊"}
    </button>
  );
}
```

- [ ] **Step 3: Halaman Roadmap (server component) + modal client**

Create `app/(app)/roadmap/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getLanguages } from "@/lib/dashboard";
import RoadmapClient from "@/components/RoadmapClient";

const LEVELS_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default async function RoadmapPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, curriculum] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getCurriculum(),
  ]);
  if (!profile) redirect("/login");

  const langId = languages.some((l) => l.id === profile.preferred_language)
    ? profile.preferred_language
    : "English";

  const current = (profile.current_level[langId] ?? "A1.0").split(".");
  const activeLevelIdx = Math.max(0, LEVELS_ORDER.indexOf(current[0] ?? "A1"));
  const activeTopicIdx = Number(current[1] ?? 0);

  const levels = LEVELS_ORDER.map((levelId, idx) => {
    const data = curriculum.find((c) => c.level === levelId);
    const unlocked = idx <= activeLevelIdx;
    const currentLevel = idx === activeLevelIdx;
    const topics = (data?.topics ?? []).map((title, topicIdx) => ({
      title,
      unlocked: unlocked && (idx < activeLevelIdx || topicIdx <= activeTopicIdx),
      current: currentLevel && topicIdx === activeTopicIdx,
    }));
    return {
      level: levelId,
      title: data?.title ?? levelId,
      description: data?.description ?? "",
      base_reward_points: data?.base_reward_points ?? 0,
      unlocked,
      currentLevel,
      topics,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">Peta Kurikulum {langId}</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Pilih topik pelajaran yang ingin Anda kuasai. Level Anda saat ini adalah {current[0] ?? "A1"}.
      </p>
      <div className="border-l-4 border-slate-200 dark:border-slate-700 pl-4 space-y-8">
        {levels.map((lv) => (
          <div key={lv.level} className={lv.unlocked ? "" : "opacity-60"}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-black">{lv.level}</span>
              <h2 className="font-extrabold">{lv.title}</h2>
              {lv.currentLevel && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
                  Posisi Anda
                </span>
              )}
              {!lv.unlocked && <span className="text-sm">🔒</span>}
            </div>
            <p className="text-xs text-slate-400 mb-3">{lv.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lv.topics.map((t) => (
                <RoadmapClient key={t.title} topic={t.title} unlocked={t.unlocked} current={t.current} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-8">
        Ujian kenaikan tingkat, chat, dan mode suara akan tersedia di fase berikutnya.
      </p>
    </div>
  );
}
```

Create `components/RoadmapClient.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function RoadmapClient({
  topic,
  unlocked,
  current,
}: {
  topic: string;
  unlocked: boolean;
  current: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!unlocked) {
    return (
      <button
        type="button"
        disabled
        className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm opacity-60 cursor-not-allowed"
      >
        🔒 {topic}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
          current
            ? "border-teal-500/60 bg-teal-500/10 text-teal-600 dark:text-teal-400"
            : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
        }`}
      >
        {current && "▶ "}
        {topic}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">Mulai Topik</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{topic}</p>
            <div className="space-y-2">
              <Link href={`/lesson/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold text-center">
                📚 Pelajari Materi
              </Link>
              <Link href={`/quiz/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-sm font-bold text-center">
                📝 Latihan Kuis
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Navbar — tambah link Kurikulum**

Edit `components/Navbar.tsx` — tambah di dalam grup navigasi (sebelum badge skor):
```tsx
<Link href="/roadmap" className={tabClass(pathname === "/roadmap")}>Kurikulum</Link>
```

- [ ] **Step 5: Verifikasi**

Run: `npm run lint` (0 error), `npx tsc --noEmit` (0 error), `npm test` (62 pass).

- [ ] **Step 6: Commit**

```bash
git add lib/sanitize.ts components/SpeakButton.tsx components/RoadmapClient.tsx app/\(app\)/roadmap/page.tsx components/Navbar.tsx package.json package-lock.json
git commit -m "feat: roadmap page with topic modal, speak button, html sanitizer"
```

---

### Task 10: Halaman Lesson

**Files:**
- Create: `app/(app)/lesson/[goal]/page.tsx`, `components/LessonView.tsx`

**Interfaces:**
- Consumes: `getSession`/`getUserProfile`, `getLanguages` (untuk ttsLangCode), `getLessonAction` (Task 8), `incrementMissionAction` (Task 2), `sanitizeHtml` (Task 9), `SpeakButton` (Task 9)
- Produces: halaman `/lesson/:goal` lengkap dengan state part

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/lesson/[goal]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import LessonView from "@/components/LessonView";

export default async function LessonPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";

  return <LessonView goal={decodeURIComponent(goal)} language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 2: `components/LessonView.tsx` (client)**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getLessonAction } from "@/lib/actions/lesson";
import { incrementMissionAction } from "@/lib/actions/mission";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { LessonContainer } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "retrying" }
  | { status: "error"; message: string }
  | { status: "ready"; lesson: LessonContainer };

export default function LessonView({
  goal,
  language,
  ttsLang,
}: {
  goal: string;
  language: string;
  ttsLang: string;
}) {
  const [part, setPart] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const res = await getLessonAction(goal, part);
    if ("error" in res) {
      setState({ status: "error", message: res.error });
      return;
    }
    setState({ status: "ready", lesson: res.lesson });
  }, [goal, part, loadKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function nextPart() {
    setPart((p) => p + 1);
    await incrementMissionAction("lesson").catch(() => {});
  }

  if (state.status === "loading" || state.status === "retrying") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyusun Materi Belajar...</p>
        <p className="text-sm text-slate-400">Merancang materi pelajaran khusus untuk Anda. Mohon tunggu beberapa saat.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Materi</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{state.message}</p>
        <button type="button" onClick={() => setLoadKey((k) => k + 1)} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const { lesson } = state;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex flex-wrap gap-2 justify-end">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">Materi {language}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">Goal: {goal}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">Bagian {part}</span>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6">{lesson.title}</h1>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm prose-sm">
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }} />
          </div>

          <h2 className="text-lg font-extrabold mt-8 mb-3">Contoh Penggunaan</h2>
          <div className="space-y-3">
            {lesson.example_sentences.map((ex, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <SpeakButton text={ex.target} lang={ttsLang} rate={0.95} />
                <div>
                  <p className="font-bold text-sm">{ex.target}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{ex.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <h2 className="text-lg font-extrabold mb-3">Kosa Kata Inti</h2>
          <div className="space-y-2">
            {lesson.vocabulary.map((v, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start gap-3">
                <SpeakButton text={v.word} lang={ttsLang} rate={0.9} />
                <div>
                  <p className="font-bold text-sm">{v.word}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{v.meaning}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-6">
            Jika sudah paham materinya, lanjutkan ke quiz untuk evaluasi.
          </p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={nextPart}
              className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
            >
              Lesson Selanjutnya
            </button>
            <Link
              href={`/quiz/${encodeURIComponent(goal)}`}
              className="block w-full px-4 py-3 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-sm font-bold text-center"
            >
              Mulai Quiz
            </Link>
            <Link href="/dashboard" className="block w-full px-4 py-3 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm text-center">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Catatan: efek `nextPart` — setPart lalu load otomatis lewat useEffect (dependensi part). `incrementMissionAction` fire-and-forget. Mobile bottom bar opsional (desktop layout sudah lengkap; tambahkan bila waktu memungkinkan — tidak wajib fase ini).

- [ ] **Step 3: Verifikasi**

Run: `npm run lint` (0 error — catatan: lint react/no-unescaped-entities bisa muncul untuk `'` di teks JSX; gunakan `{"'"}` atau `&apos;` bila lint mengeluh), `npx tsc --noEmit` (0 error), `npm test` (62 pass).

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/lesson/[goal]/page.tsx components/LessonView.tsx
git commit -m "feat: lesson page with parts, vocabulary, examples and TTS"
```

---

### Task 11: Halaman Quiz

**Files:**
- Create: `app/(app)/quiz/[goal]/page.tsx`, `components/QuizView.tsx`

**Interfaces:**
- Consumes: `getQuizAction`/`recordAnswerAction`/`submitQuizResultAction` (Task 8), `getEngagementStats` (lib/dashboard.ts), `getCurriculum`, `sanitizeHtml`, `SpeakButton`
- Produces: halaman `/quiz/:goal` lengkap (state machine penuh)

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/quiz/[goal]/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getEngagementStats, getLanguages } from "@/lib/dashboard";
import QuizView from "@/components/QuizView";

export default async function QuizPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, curriculum, stats] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getCurriculum(),
    getEngagementStats(session.email),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  const baseLevel = (profile.current_level[langId] ?? "A1.0").split(".")[0] || "A1";
  const ptsPerQuestion = curriculum.find((c) => c.level === baseLevel)?.base_reward_points ?? 10;

  return (
    <QuizView
      goal={decodeURIComponent(goal)}
      language={langId}
      ttsLang={ttsLang}
      initialHearts={stats?.hearts ?? 5}
      ptsPerQuestion={ptsPerQuestion}
    />
  );
}
```

- [ ] **Step 2: `components/QuizView.tsx` (client)**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getQuizAction, recordAnswerAction, submitQuizResultAction } from "@/lib/actions/quiz";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { QuizContainer } from "@/lib/types";

type Phase =
  | { name: "loading" }
  | { name: "hearts"; hearts: number }
  | { name: "answering" }
  | { name: "finished"; passed: boolean; score: number };

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function QuizView({
  goal,
  language,
  ttsLang,
  initialHearts,
  ptsPerQuestion,
}: {
  goal: string;
  language: string;
  ttsLang: string;
  initialHearts: number;
  ptsPerQuestion: number;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(initialHearts);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase({ name: "loading" });
    const res = await getQuizAction(goal);
    if ("error" in res) {
      setError(res.error);
      setPhase({ name: "hearts", hearts });
      return;
    }
    setQuiz(res.quiz);
    setPhase({ name: "answering" });
  }, [goal]);

  useEffect(() => {
    if (initialHearts <= 0) {
      setPhase({ name: "hearts", hearts: 0 });
    } else {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const question = quiz?.questions[idx];

  async function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    const pts = isCorrect ? ptsPerQuestion : 0;

    recordAnswerAction({
      language,
      question: question.question,
      selected,
      correct: question.correct_answer,
      explanation: question.explanation,
      questionType: question.question_type,
    })
      .then((res) => {
        if ("hearts" in res) setHearts(res.hearts);
      })
      .catch(() => {});

    if (isCorrect) {
      setScore((s) => s + pts);
      setCorrectCount((c) => c + 1);
    } else {
      setHearts((h) => Math.max(0, h - 1));
    }
    setShowExplanation(true);
  }

  async function finishQuiz() {
    if (submitting) return;
    setSubmitting(true);
    const res = await submitQuizResultAction({ goal, language, score, correctCount });
    if ("error" in res) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    const required = ptsPerQuestion * 5;
    setPhase({ name: "finished", passed: score >= required, score });
  }

  if (phase.name === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Merancang Kuis Kustom...</p>
        <p className="text-sm text-slate-400">Sedang menyusun soal yang disesuaikan dengan level bahasa Anda. Siap-siap belajar hal baru!</p>
      </div>
    );
  }

  if (phase.name === "hearts" && hearts <= 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">💔</p>
        <p className="text-2xl font-black">Nyawa Kamu Habis!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Kamu butuh minimal 1 Nyawa untuk mengikuti kuis ini. Silakan kembali ke Beranda untuk mengisi ulang nyawa kamu.
        </p>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  if (phase.name === "finished") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Kuis Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Skor Anda berhasil dikirim ke database Neon.</p>
        <p className="text-3xl font-black text-teal-600 dark:text-teal-400">+{phase.score} Poin</p>
        {phase.passed ? (
          <div className="max-w-md bg-teal-500/10 border border-teal-500/40 rounded-2xl p-4">
            <p className="font-bold text-teal-700 dark:text-teal-400">🌟 Luar Biasa! Nilai Sempurna!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Anda telah menguasai materi ini. Tahap selanjutnya telah terbuka!</p>
          </div>
        ) : (
          <div className="max-w-md bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
            <p className="font-bold text-amber-700 dark:text-amber-400">🔒 Topik Berikutnya Masih Terkunci</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sistem LingoMind mensyaratkan Anda untuk mendapatkan nilai sempurna (semua benar) untuk membuktikan penguasaan materi.
              Anda butuh {ptsPerQuestion * 5} Poin. Ayo coba lagi!
            </p>
          </div>
        )}
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Roadmap
        </Link>
      </div>
    );
  }

  if (!question) return null;

  const isLast = idx === (quiz?.questions.length ?? 0) - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
            Latihan {language}
          </span>
          {question.question_type === "listening" && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">
              Listening Test
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">
            ❤️ {hearts}
          </span>
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${((idx + 1) / (quiz?.questions.length ?? 5)) * 100}%` }}
        />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz?.questions.length}</p>

      {question.question_type === "listening" && (
        <div className="flex items-center gap-3 mb-4">
          <SpeakButton text={question.listen_text} lang={ttsLang} rate={0.95} />
          <span className="text-xs text-slate-400">Dengarkan audio, lalu pilih jawaban</span>
        </div>
      )}

      <div
        className="text-lg font-bold mb-6 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }}
      />

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrectOpt = showExplanation && opt === question.correct_answer;
          const isWrongOpt = showExplanation && isSelected && opt !== question.correct_answer;
          return (
            <button
              key={i}
              type="button"
              disabled={showExplanation}
              onClick={() => setSelected(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-colors ${
                isCorrectOpt
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : isWrongOpt
                    ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : isSelected
                      ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400"
                      : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">
                {OPTION_LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
              <SpeakButton text={opt} lang={ttsLang} rate={0.9} />
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`mt-4 p-4 rounded-2xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">
            {selected === question.correct_answer ? "✓ Jawaban Benar!" : "✗ Jawaban Salah!"}
          </p>
          {selected !== question.correct_answer && (
            <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>
          )}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button
            type="button"
            disabled={!selected}
            onClick={checkAnswer}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
          >
            Cek Jawaban
          </button>
        ) : isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={finishQuiz}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
          >
            {submitting ? "Menyimpan..." : "Selesai & Simpan Skor"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIdx((i) => i + 1);
              setSelected(null);
              setShowExplanation(false);
            }}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
          >
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 mt-3 text-center">{error}</p>}
    </div>
  );
}
```

Catatan: `initialHearts <= 0` langsung ke layar habis tanpa memanggil AI (hemat). Confetti script dari legacy dilewati (opsional; boleh tambah canvas-confetti bila mau — TIDAK wajib).

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (62 pass).

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/quiz/[goal]/page.tsx components/QuizView.tsx
git commit -m "feat: quiz page with hearts, explanations, and score submission"
```

---

### Task 12: Halaman Flashcard Review

**Files:**
- Create: `app/(app)/flashcard-review/page.tsx`, `components/FlashcardView.tsx`

**Interfaces:**
- Consumes: `getDueFlashcardsAction`/`reviewFlashcardAction` (Task 8), `getLanguages` (ttsLang), `SpeakButton`
- Produces: halaman `/flashcard-review` lengkap

- [ ] **Step 1: Wrapper halaman**

Create `app/(app)/flashcard-review/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import FlashcardView from "@/components/FlashcardView";

export default async function FlashcardReviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language)
    ? profile.preferred_language
    : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <FlashcardView language={langId} ttsLang={ttsLang} />;
}
```

- [ ] **Step 2: `components/FlashcardView.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDueFlashcardsAction, reviewFlashcardAction } from "@/lib/actions/flashcard";
import SpeakButton from "./SpeakButton";
import type { FlashcardItem } from "@/lib/types";

export default function FlashcardView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const [cards, setCards] = useState<FlashcardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getDueFlashcardsAction(20)
      .then((res) => {
        if ("error" in res) setError(res.error);
        else setCards(res.cards);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat flashcard."));
  }, []);

  function grade(quality: number) {
    const card = cards?.[idx];
    if (!card) return;
    reviewFlashcardAction(card.id, quality).catch(() => {});
    const next = idx + 1;
    if (next >= (cards?.length ?? 0)) setFinished(true);
    else {
      setIdx(next);
      setShowBack(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Flashcard</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (cards === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🏆</p>
        <p className="text-2xl font-black">Semua Kartu Bersih!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Tidak ada kartu yang harus diulas untuk bahasa {language} saat ini. Kembali lagi nanti, atau tambahkan kartu baru melalui menu kuis!
        </p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Sesi Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Hebat! Semua kartu di sesi ini telah selesai diulas secara optimal.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const card = cards[idx];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">Flashcard Review</h1>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">
          Kartu {idx + 1}/{cards.length}
        </span>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <SpeakButton text={card.front_text} lang={ttsLang} rate={0.9} />
        </div>
        <p className="text-lg font-bold">{card.front_text}</p>
        {showBack ? (
          <>
            <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{card.back_text}</p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowBack(true)}
            className="mt-2 px-4 py-2 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-xs font-bold"
          >
            Tampilkan Terjemahan 👀
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <button type="button" onClick={() => grade(2)} className="px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold">
          🔴 Ulangi
        </button>
        <button type="button" onClick={() => grade(4)} className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
          🟡 Bagus
        </button>
        <button type="button" onClick={() => grade(5)} className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold">
          🟢 Mudah
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (62 pass).

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/flashcard-review/page.tsx components/FlashcardView.tsx
git commit -m "feat: flashcard review page with sm-2 grading"
```

---

### Task 13: AGENTS.md update + verifikasi final

**Files:**
- Modify: `AGENTS.md` (root)

- [ ] **Step 1: Update `AGENTS.md`**

Tambah/perbarui bagian yang relevan di `AGENTS.md`:
- Arsitektur: tambah `lib/progress.ts`, `lib/mission.ts`, `lib/flashcards.ts`, `lib/weakness.ts`, `lib/ai-content/` (parse/lesson/quiz), `lib/sanitize.ts`; `lib/actions/lesson.ts|quiz.ts|flashcard.ts|mission.ts`
- Routes baru: `/roadmap`, `/lesson/:goal`, `/quiz/:goal`, `/flashcard-review`
- Catatan: HTML AI wajib `sanitizeHtml` sebelum render; fungsi murni diuji vitest; TTS = Web Speech API (SpeakButton)
- Status migrasi: Fase 2a selesai (roadmap+lesson+quiz+flashcard); tersisa practice/exam/placement (2b), AI interaktif (3), gamifikasi (4), admin (5), ops (6)

- [ ] **Step 2: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```

Expected: lint 0 error (warning `<img>` pre-existing boleh), tsc bersih, semua test lulus (62), build sukses, migrate status "up to date".

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for phase 2a (learning loop)"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Streak + quiz outcome math | 28 test (11 baru) |
| 2. Pipeline skor + mission + hearts | tsc bersih; smoke read-only |
| 3. SM-2 flashcard | 34 test (6 baru) |
| 4. Classifier weakness/skill | 42 test (8 baru) |
| 5. Parser JSON AI | 48 test (6 baru) |
| 6. Generate lesson | tsc + smoke AI nyata |
| 7. Pipeline quiz AI | 62 test (14 baru) + smoke AI |
| 8. Server actions + cache | lint/tsc/test |
| 9. Roadmap + sanitize + SpeakButton | lint/tsc/test |
| 10. Halaman lesson | lint/tsc/test |
| 11. Halaman quiz | lint/tsc/test |
| 12. Halaman flashcard | lint/tsc/test |
| 13. AGENTS.md + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **Prompt AI port**: model baru (deepseek-v4-flash via opencode.ai) mungkin butuh penyesuaian kecil pada prompt (misal JSON kadang kabur). Pipeline sudah punya normalize/validate/quality/retry + fallback cache — jangan menyerah di percobaan pertama; kalau pola kegagalan konsisten (misal selalu `correct_answer` tak cocok), sesuaikan instruksi JSON di prompt.
- **Nama where komposit Prisma**: `user_language_progress` → `email_languageId` (cek schema); `user_daily_missions` → `email_date`. Sesuaikan bila error.
- **`initialHearts`**: dibaca sekali saat render server; regenerasi heart berjalan saat `getEngagementStats` dipanggil — QuizView pakai nilai awal; deduction sinkron via `recordAnswerAction`.
- **Smoke AI berbiaya**: Task 6/7 menjalankan 1-2 panggilan AI nyata — normal (token kecil).
