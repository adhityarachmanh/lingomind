# LingoMind Fase 4b — Sosial & Kompetisi — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport fitur sosial & kompetisi LingoMind ke Next.js: leaderboard & liga mingguan (lazy auto-assign), quiz battle (challenge → quiz → skor), social feed (aktivitas teman + like + hook streak/level), analisis kelemahan (2 tab SVG), dan virtual pets (kartu + koleksi + makan).

**Architecture:** Logika murni (division promotion, battle outcome, pet stage/emoji, feed date, streak milestone, bar width) diuji vitest. Liga memakai interactive `$transaction` dengan `$queryRaw` `FOR UPDATE` (satu-satunya raw SQL — capacity check group). Hooks sosial diaktifkan di `lib/progress.ts` (streak_milestone di updateEngagementAfterQuiz, level_up di submitExamResult, league score di applyQuizResult). Battle terintegrasi ke flow quiz via `battle_id` searchParams opsional.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), vitest, Tailwind v4.

**Referensi kode lama (sumber kebenaran):**
- Leaderboard/liga: `dioxus/src/services/leaderboard.rs`, `dioxus/src/views/leaderboard.rs`
- Battle: `dioxus/src/services/battle.rs`, `dioxus/src/views/quiz.rs:771-804` (battle submit)
- Social: `dioxus/src/services/social.rs`, `dioxus/src/services/engagement.rs` (streak_milestone), `dioxus/src/services/auth.rs` (level_up)
- Analytics: `dioxus/src/services/weakness.rs`, `dioxus/src/views/weakness_analytics.rs`
- Pets: `dioxus/src/services/pet.rs`, `dioxus/src/views/dashboard.rs` (pet card/modal)

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis legacy (dikutip tiap task).
- **Prisma** (verifikasi nama di schema.prisma saat implementasi): `db.leagueGroup` (division, weekStartDate, memberCount), `db.userLeagueMember` (email, groupId, leagueScore), `db.quizBattle` (challengerEmail, challengedEmail, language, goal, challengerScore, challengedScore, status, createdAt), `db.follower` (followerEmail, followedEmail), `db.socialFeed` (email, activityType, content, likesCount), `db.socialFeedLike` (feedId, likerEmail), `db.userPet` (email, petType, stage, exp, isActive), `db.user` (fullName, score, role), `db.userEngagementStat`.
- **Raw SQL**: HANYA `$queryRaw` untuk FOR UPDATE (league group capacity) dan query ROW_NUMBER (previous week rank). Nama tabel asli (league_groups/user_league_members). Parameter lewat template literal Prisma.
- **Setiap server action yang butuh user memanggil `getSession()`**; error session = `Sesi berakhir. Silakan login kembali.`
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`**; fire-and-forget dari client selalu `.catch(() => {})`.
- **Tanpa perubahan skema/migration**; `npx prisma migrate status` tetap up to date.
- Modul yang di-import client components TIDAK BOLEH import db (pelajaran fase 3) — komponen UI hanya import actions + types.
- Hook di `applyQuizResult`/`updateEngagementAfterQuiz`/`submitExamResult` bersifat fire-and-forget `.catch(() => {})` — jangan pernah menggagalkan flow utama.

---

### Task 1: lib/leaderboard.ts — pure helpers (TDD) + getWeeklyLeague (lazy tx) + global/following

**Files:**
- Create: `lib/leaderboard.ts`, `lib/leaderboard.test.ts`
- Modify: `lib/types.ts` (tambah LeagueMemberRow, LeaderboardRow), `lib/progress.ts` (league score hook)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface LeagueMemberRow {
    email: string; full_name: string; league_score: number;
    active_frame: string | null; active_title: string | null; active_name_color: string | null;
    rank: number; zone: "promosi" | "degradasi" | "aman";
  }
  export interface LeaderboardRow {
    email: string; full_name: string; score: number; current_streak: number;
    total_quiz_completed: number; active_frame: string | null;
    active_title: string | null; active_name_color: string | null; rank: number;
  }

  // lib/leaderboard.ts
  export function weekStartOf(now: Date): Date          // Senin 00:00 UTC
  export function daysLeftInWeek(now: Date): number      // 7 - isoDow (Senin=6, Minggu=0)
  export function decideNextDivision(prevIdx: number | null, prevRank: number | null): number
  // null → 0; rank<=5 → min(3, idx+1); rank>=26 → max(0, idx-1); else idx
  export async function getWeeklyLeague(email: string, now?: Date): Promise<{ division: string; daysLeft: number; members: LeagueMemberRow[] }>
  // lazy assign dalam tx (FOR UPDATE); members join users + stats; zone per rank
  export async function getGlobalLeaderboard(limit: number): Promise<LeaderboardRow[]>
  export async function getFollowingLeaderboard(email: string): Promise<LeaderboardRow[]>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/leaderboard.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { daysLeftInWeek, decideNextDivision, weekStartOf } from "./leaderboard";

describe("weekStartOf", () => {
  it("Senin → hari itu sendiri", () => {
    const d = new Date("2026-08-03T15:00:00Z"); // Senin
    expect(weekStartOf(d).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
  it("Minggu → Senin sebelumnya", () => {
    const d = new Date("2026-08-09T10:00:00Z"); // Minggu
    expect(weekStartOf(d).toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });
});

describe("daysLeftInWeek", () => {
  it("Senin → 6", () => {
    expect(daysLeftInWeek(new Date("2026-08-03T00:00:00Z"))).toBe(6);
  });
  it("Minggu → 0", () => {
    expect(daysLeftInWeek(new Date("2026-08-09T00:00:00Z"))).toBe(0);
  });
  it("Rabu → 4", () => {
    expect(daysLeftInWeek(new Date("2026-08-05T00:00:00Z"))).toBe(4);
  });
});

describe("decideNextDivision", () => {
  it("tanpa riwayat → Bronze (0)", () => {
    expect(decideNextDivision(null, null)).toBe(0);
  });
  it("rank <= 5 → naik 1", () => {
    expect(decideNextDivision(1, 3)).toBe(2);
  });
  it("rank >= 26 → turun 1", () => {
    expect(decideNextDivision(2, 30)).toBe(1);
  });
  it("rank tengah → tetap", () => {
    expect(decideNextDivision(2, 15)).toBe(2);
  });
  it("cap: Diamond (3) rank 1 → tetap 3", () => {
    expect(decideNextDivision(3, 1)).toBe(3);
  });
  it("floor: Bronze (0) rank 30 → tetap 0", () => {
    expect(decideNextDivision(0, 30)).toBe(0);
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/leaderboard.test.ts` — FAIL.

- [ ] **Step 3: Implementasi pure helpers + tipe**

Tambah 2 tipe ke `lib/types.ts` (per Interfaces).

Create `lib/leaderboard.ts`:
```ts
import { db } from "./db";
import type { LeaderboardRow, LeagueMemberRow } from "./types";

const DIVISIONS = ["Bronze", "Silver", "Gold", "Diamond"];

export function weekStartOf(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // 1=Senin..7=Minggu
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d;
}

export function daysLeftInWeek(now: Date): number {
  const isoDow = ((now.getUTCDay() + 6) % 7) + 1;
  return 7 - isoDow;
}

export function decideNextDivision(prevIdx: number | null, prevRank: number | null): number {
  if (prevIdx === null || prevRank === null) return 0;
  if (prevRank <= 5) return Math.min(3, prevIdx + 1);
  if (prevRank >= 26) return Math.max(0, prevIdx - 1);
  return prevIdx;
}
```

- [ ] **Step 4: Implementasi getWeeklyLeague + leaderboards**

Append ke `lib/leaderboard.ts`:

```ts
export async function getWeeklyLeague(
  email: string,
  now: Date = new Date()
): Promise<{ division: string; daysLeft: number; members: LeagueMemberRow[] }> {
  const weekStart = weekStartOf(now);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
  const daysLeft = daysLeftInWeek(now);

  const existing = await db.userLeagueMember.findFirst({
    where: { email },
    include: { group: true },
  });
  let groupId: number;
  let division: string;

  if (existing && existing.group.weekStartDate.getTime() === weekStart.getTime()) {
    groupId = existing.groupId;
    division = existing.group.division;
  } else {
    const assigned = await db.$transaction(async (tx) => {
      let nextDivisionIdx = 0;
      const prev = await tx.$queryRaw<{ division: string; rnk: number }[]>`
        WITH RankedMembers AS (
          SELECT m.email, m.group_id, g.division,
                 ROW_NUMBER() OVER(PARTITION BY m.group_id ORDER BY m.league_score DESC) as rnk
          FROM user_league_members m
          JOIN league_groups g ON m.group_id = g.id
          WHERE m.email = ${email} AND g.week_start_date = ${prevWeekStart}
        )
        SELECT division, rnk FROM RankedMembers LIMIT 1`;
      if (prev.length > 0) {
        const prevIdx = DIVISIONS.indexOf(prev[0].division);
        nextDivisionIdx = decideNextDivision(prevIdx >= 0 ? prevIdx : null, prev[0].rnk);
      }
      const divisionName = DIVISIONS[nextDivisionIdx];

      const groups = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM league_groups
        WHERE division = ${divisionName} AND week_start_date = ${weekStart} AND member_count < 30
        LIMIT 1 FOR UPDATE`;

      let gid: number;
      if (groups.length > 0) {
        gid = groups[0].id;
        await tx.leagueGroup.update({ where: { id: gid }, data: { memberCount: { increment: 1 } } });
      } else {
        const created = await tx.leagueGroup.create({
          data: { division: divisionName, weekStartDate: weekStart, memberCount: 1 },
        });
        gid = created.id;
      }
      await tx.userLeagueMember.create({ data: { email, groupId: gid, leagueScore: 0 } });
      return { gid, divisionName };
    });
    groupId = assigned.gid;
    division = assigned.divisionName;
  }

  const rows = await db.userLeagueMember.findMany({
    where: { groupId },
    orderBy: { leagueScore: "desc" },
    include: { user: { select: { fullName: true } } },
  });
  const emails = rows.map((r) => r.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));

  const members: LeagueMemberRow[] = rows.map((r, i) => {
    const rank = i + 1;
    const stats = statsMap.get(r.email);
    return {
      email: r.email,
      full_name: r.user.fullName ?? "",
      league_score: r.leagueScore,
      active_frame: stats?.activeFrame ?? null,
      active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null,
      rank,
      zone: rank <= 5 ? "promosi" : rank >= 26 ? "degradasi" : "aman",
    };
  });

  return { division, daysLeft, members };
}

export async function getGlobalLeaderboard(limit: number): Promise<LeaderboardRow[]> {
  const safeLimit = Math.min(Math.max(limit, 10), 100);
  const users = await db.user.findMany({
    where: { role: { not: "admin" } },
    orderBy: { score: "desc" },
    take: safeLimit,
  });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
    };
  });
}

export async function getFollowingLeaderboard(email: string): Promise<LeaderboardRow[]> {
  const following = await db.follower.findMany({ where: { followerEmail: email } });
  const emails = [email, ...following.map((f) => f.followedEmail)];
  const users = await db.user.findMany({
    where: { email: { in: emails }, role: { not: "admin" } },
    orderBy: { score: "desc" },
  });
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
    };
  });
}
```

Catatan: relasi `userLeagueMember.group` dan `user` — cek schema; bila tidak ada relasi, query manual (findMany group by groupId + users). PK `user_league_members` = (email, group_id) — cek nama generated (kemungkinan `email_groupId`).

- [ ] **Step 5: League score hook di `lib/progress.ts`**

Edit `applyQuizResult` — SETELAH `db.$transaction`, tambah (fire-and-forget):

```ts
import { weekStartOf } from "./leaderboard";
// ... setelah db.$transaction([...]):
  const weekStart = weekStartOf(new Date());
  const groups = await db.leagueGroup.findMany({ where: { weekStartDate: weekStart }, select: { id: true } });
  if (groups.length > 0) {
    await db.userLeagueMember.updateMany({
      where: { email, groupId: { in: groups.map((g) => g.id) } },
      data: { leagueScore: { increment: actualDelta } },
    }).catch(() => {});
  }
```

- [ ] **Step 6: Run — harus lulus**

Run: `npm test` — semua pass (131 + 11 = 142).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/leaderboard.ts lib/leaderboard.test.ts lib/progress.ts
git commit -m "feat: weekly league with lazy assignment and leaderboards (TDD)"
```

---

### Task 2: lib/social.ts — pure helpers (TDD) + feed/follow + hooks

**Files:**
- Create: `lib/social.ts`, `lib/social.test.ts`
- Modify: `lib/progress.ts` (streak_milestone hook), `lib/progress.ts` (level_up hook di submitExamResult)
- Modify: `lib/types.ts` (tambah FeedItem, SearchUserRow)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface FeedItem {
    id: number; email: string; full_name: string; emoji: string;
    activity_type: string; content: string; likes_count: number;
    created_at: string; has_liked: boolean;
  }
  export interface SearchUserRow {
    email: string; full_name: string; score: number; current_streak: number;
    total_quiz_completed: number; active_frame: string | null; active_title: string | null;
    active_name_color: string | null; rank: number; is_following: boolean;
  }

  // lib/social.ts
  export function formatFeedDate(date: Date): string       // "02 Aug 2026, 14:30" (bulan Inggris pendek — setia legacy %b)
  export function decideStreakMilestone(streak: number): boolean  // streak > 0 && streak % 7 === 0
  export async function getSocialFeed(email: string): Promise<FeedItem[]>
  export async function likeActivity(feedId: number, email: string): Promise<void>
  export async function searchUsers(query: string, currentEmail: string): Promise<SearchUserRow[]>
  export async function toggleFollow(followerEmail: string, followedEmail: string, follow: boolean): Promise<void>
  export async function logActivity(email: string, activityType: string, content: string): Promise<void>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/social.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { decideStreakMilestone, formatFeedDate } from "./social";

describe("formatFeedDate", () => {
  it("format legacy %d %b %Y, %H:%M", () => {
    const d = new Date("2026-08-02T14:30:00Z");
    expect(formatFeedDate(d)).toBe("02 Aug 2026, 14:30");
  });
  it("jam dua digit", () => {
    const d = new Date("2026-01-05T09:05:00Z");
    expect(formatFeedDate(d)).toBe("05 Jan 2026, 09:05");
  });
});

describe("decideStreakMilestone", () => {
  it("7 → true", () => {
    expect(decideStreakMilestone(7)).toBe(true);
  });
  it("14 → true", () => {
    expect(decideStreakMilestone(14)).toBe(true);
  });
  it("6 → false", () => {
    expect(decideStreakMilestone(6)).toBe(false);
  });
  it("0 → false", () => {
    expect(decideStreakMilestone(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/social.test.ts` — FAIL.

- [ ] **Step 3: Implementasi pure helpers + tipe**

Tambah 2 tipe ke `lib/types.ts` (per Interfaces).

Create `lib/social.ts`:
```ts
import { db } from "./db";
import type { FeedItem, SearchUserRow } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatFeedDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[date.getUTCMonth()];
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${mon} ${date.getUTCFullYear()}, ${hh}:${mm}`;
}

export function decideStreakMilestone(streak: number): boolean {
  return streak > 0 && streak % 7 === 0;
}

export async function logActivity(email: string, activityType: string, content: string): Promise<void> {
  await db.socialFeed.create({ data: { email, activityType, content } });
}

export async function getSocialFeed(email: string): Promise<FeedItem[]> {
  const following = await db.follower.findMany({ where: { followerEmail: email } });
  const followedEmails = following.map((f) => f.followedEmail);
  const feed = await db.socialFeed.findMany({
    where: { OR: [{ email }, { email: { in: followedEmails } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const feedEmails = [...new Set(feed.map((f) => f.email))];
  const users = await db.user.findMany({ where: { email: { in: feedEmails } } });
  const userMap = new Map(users.map((u) => [u.email, u]));
  const pets = await db.userPet.findMany({ where: { email: { in: feedEmails }, isActive: true } });
  const petMap = new Map(pets.map((p) => [p.email, p]));
  const likes = await db.socialFeedLike.findMany({ where: { likerEmail: email } });
  const likedIds = new Set(likes.map((l) => l.feedId));

  return feed.map((f) => ({
    id: f.id,
    email: f.email,
    full_name: userMap.get(f.email)?.fullName ?? "",
    emoji: petMap.get(f.email) ? "🐾" : "👤",
    activity_type: f.activityType,
    content: f.content,
    likes_count: f.likesCount,
    created_at: f.createdAt ? formatFeedDate(f.createdAt) : "",
    has_liked: likedIds.has(f.id),
  }));
}

export async function likeActivity(feedId: number, email: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const created = await tx.socialFeedLike.create({
      data: { feedId, likerEmail: email },
    }).catch(() => null);
    if (created) {
      await tx.socialFeed.update({ where: { id: feedId }, data: { likesCount: { increment: 1 } } });
    }
  });
}

export async function searchUsers(query: string, currentEmail: string): Promise<SearchUserRow[]> {
  const q = query.toLowerCase();
  const users = await db.user.findMany({
    where: {
      email: { not: currentEmail },
      OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { score: "desc" },
    take: 20,
  });
  const emails = users.map((u) => u.email);
  const [statsRows, follows] = await Promise.all([
    db.userEngagementStat.findMany({ where: { email: { in: emails } } }),
    db.follower.findMany({ where: { followerEmail: currentEmail, followedEmail: { in: emails } } }),
  ]);
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  const followingSet = new Set(follows.map((f) => f.followedEmail));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
      is_following: followingSet.has(u.email),
    };
  });
}

export async function toggleFollow(followerEmail: string, followedEmail: string, follow: boolean): Promise<void> {
  if (follow) {
    await db.follower.create({ data: { followerEmail, followedEmail } }).catch(() => {});
  } else {
    await db.follower.deleteMany({ where: { followerEmail, followedEmail } });
  }
}
```

Catatan: `db.follower.create` bisa throw unique (PK) — catch. `mode: "insensitive"` — didukung Postgres.

- [ ] **Step 4: Hooks di `lib/progress.ts`**

Edit `updateEngagementAfterQuiz` — di akhir (setelah badge hook), tambah:

```ts
import { decideStreakMilestone, logActivity } from "./social";
// ... setelah evaluateAndAwardBadges(email).catch(() => {}):
  if (decideStreakMilestone(streak.currentStreak)) {
    await logActivity(email, "streak_milestone", `Luar biasa! Berhasil mencapai ${streak.currentStreak} hari beruntun belajar!`).catch(() => {});
  }
```
(`streak` adalah hasil computeStreakAfterActivity di update path; untuk create path streak=1 → tidak milestone. Tempatkan setelah if/else agar hanya mengecek nilai akhir.)

Edit `submitExamResult` (lib/progress.ts) — saat level-up (blok `if (passed && oldTopicIdx >= topicsInLevel)`), tambah setelah newBase dihitung:

```ts
if (passed && oldTopicIdx >= topicsInLevel) {
  newTopicIdx = 0;
  const nextBase = nextLevelAfterExam(CEFR_ORDER, oldBase);
  if (nextBase !== oldBase) {
    await logActivity(email, "level_up", `Berhasil naik ke Level ${nextBase} di bahasa ${language}!`).catch(() => {});
  }
  newBase = nextBase;
}
```

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — 147 pass (142 + 5).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/social.ts lib/social.test.ts lib/progress.ts
git commit -m "feat: social feed, follow, likes, and streak/level hooks (TDD)"
```

---

### Task 3: lib/battle.ts — pure (TDD) + DB flow

**Files:**
- Create: `lib/battle.ts`, `lib/battle.test.ts`
- Modify: `lib/types.ts` (tambah BattleItem)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface BattleItem {
    id: number; challenger_email: string; challenged_email: string; language: string; goal: string;
    status: string; my_score: number | null; opponent_score: number | null;
    opponent_name: string; created_at: Date | null;
  }

  // lib/battle.ts
  export function decideBattleWinner(myScore: number, opponentScore: number): "challenger" | "challenged" | "tie"
  export function decideBattleMessage(input: {
    amChallenger: boolean; bothPlayed: boolean; winner: "challenger" | "challenged" | "tie"; amWinner: boolean;
  }): string
  export async function createBattle(challengerEmail: string, challengedEmail: string, language: string, goal: string): Promise<void>
  export async function getActiveBattles(email: string): Promise<BattleItem[]>
  export async function submitBattleScore(battleId: number, email: string, score: number): Promise<string>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/battle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { decideBattleMessage, decideBattleWinner } from "./battle";

describe("decideBattleWinner", () => {
  it("challenger menang", () => {
    expect(decideBattleWinner(80, 60)).toBe("challenger");
  });
  it("challenged menang", () => {
    expect(decideBattleWinner(40, 90)).toBe("challenged");
  });
  it("seri", () => {
    expect(decideBattleWinner(50, 50)).toBe("tie");
  });
});

describe("decideBattleMessage", () => {
  it("pemenang yang submit → menang", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "challenger", amWinner: true });
    expect(m).toContain("Selamat! Anda menang");
    expect(m).toContain("50 Koin");
  });
  it("pecundang yang submit → kalah", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "challenged", amWinner: false });
    expect(m).toContain("Anda kalah");
  });
  it("seri", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: true, winner: "tie", amWinner: false });
    expect(m).toContain("SERI");
  });
  it("challenger pertama submit → menunggu", () => {
    const m = decideBattleMessage({ amChallenger: true, bothPlayed: false, winner: "tie", amWinner: false });
    expect(m).toContain("Menunggu lawan");
  });
  it("challenged submit pertama → skor disimpan", () => {
    const m = decideBattleMessage({ amChallenger: false, bothPlayed: false, winner: "tie", amWinner: false });
    expect(m).toBe("Skor berhasil disimpan!");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/battle.test.ts` — FAIL.

- [ ] **Step 3: Implementasi pure + tipe**

Tambah `BattleItem` ke `lib/types.ts` (per Interfaces).

Create `lib/battle.ts`:
```ts
import { db } from "./db";
import type { BattleItem } from "./types";

export function decideBattleWinner(myScore: number, opponentScore: number): "challenger" | "challenged" | "tie" {
  if (myScore > opponentScore) return "challenger";
  if (myScore < opponentScore) return "challenged";
  return "tie";
}

export function decideBattleMessage(input: {
  amChallenger: boolean;
  bothPlayed: boolean;
  winner: "challenger" | "challenged" | "tie";
  amWinner: boolean;
}): string {
  const { amChallenger, bothPlayed, winner, amWinner } = input;
  if (!bothPlayed) {
    return amChallenger
      ? "Skor berhasil disimpan! Menunggu lawan menyelesaikan kuis."
      : "Skor berhasil disimpan!";
  }
  if (winner === "tie") return "Hasilnya SERI! Kalian berdua sama-sama hebat.";
  if (amWinner) return "Selamat! Anda menang dalam tantangan ini dan mendapat 50 Koin!";
  return "Anda kalah dalam tantangan ini. Coba lagi lain kali!";
}

export async function createBattle(
  challengerEmail: string,
  challengedEmail: string,
  language: string,
  goal: string
): Promise<void> {
  await db.quizBattle.create({
    data: { challengerEmail, challengedEmail, language, goal },
  });
}

export async function getActiveBattles(email: string): Promise<BattleItem[]> {
  const battles = await db.quizBattle.findMany({
    where: { OR: [{ challengerEmail: email }, { challengedEmail: email }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const oppEmails = battles.map((b) => (b.challengerEmail === email ? b.challengedEmail : b.challengerEmail));
  const users = await db.user.findMany({ where: { email: { in: oppEmails } } });
  const userMap = new Map(users.map((u) => [u.email, u]));
  return battles.map((b) => {
    const amChallenger = b.challengerEmail === email;
    return {
      id: b.id,
      challenger_email: b.challengerEmail,
      challenged_email: b.challengedEmail,
      language: b.language,
      goal: b.goal,
      status: b.status,
      my_score: amChallenger ? b.challengerScore : b.challengedScore,
      opponent_score: amChallenger ? b.challengedScore : b.challengerScore,
      opponent_name: userMap.get(amChallenger ? b.challengedEmail : b.challengerEmail)?.fullName ?? "",
      created_at: b.createdAt,
    };
  });
}

export async function submitBattleScore(battleId: number, email: string, score: number): Promise<string> {
  const battle = await db.quizBattle.findUnique({ where: { id: battleId } });
  if (!battle) throw new Error("Tantangan tidak ditemukan.");
  if (battle.status !== "pending") throw new Error("Tantangan sudah selesai atau dibatalkan.");
  const amChallenger = battle.challengerEmail === email;
  const isParticipant = amChallenger || battle.challengedEmail === email;
  if (!isParticipant) throw new Error("Anda tidak berpartisipasi dalam tantangan ini.");

  const myScore = amChallenger ? score : battle.challengerScore;
  const oppScore = amChallenger ? battle.challengedScore : score;

  const bothPlayed = (amChallenger ? battle.challengedScore : battle.challengerScore) !== null;

  await db.quizBattle.update({
    where: { id: battleId },
    data: amChallenger ? { challengerScore: score } : { challengedScore: score },
  });

  let message: string;
  if (bothPlayed) {
    const winner = decideBattleWinner(
      amChallenger ? score : battle.challengerScore ?? 0,
      amChallenger ? battle.challengedScore ?? 0 : score
    );
    message = decideBattleMessage({ amChallenger, bothPlayed: true, winner, amWinner: amChallenger ? winner === "challenger" : winner === "challenged" });
    await db.quizBattle.update({ where: { id: battleId }, data: { status: "completed" } });
    if (winner !== "tie") {
      const winnerEmail = winner === "challenger" ? battle.challengerEmail : battle.challengedEmail;
      await db.userEngagementStat.update({ where: { email: winnerEmail }, data: { coins: { increment: 50 } } }).catch(() => {});
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await db.userDailyMission.upsert({
        where: { email_date: { email: winnerEmail, date: today } },
        create: { email: winnerEmail, date: today },
        update: {},
      }).catch(() => {});
      await db.userDailyMission.update({
        where: { email_date: { email: winnerEmail, date: today } },
        data: { pvpWinsToday: { increment: 1 } },
      }).catch(() => {});
    }
  } else {
    message = decideBattleMessage({ amChallenger, bothPlayed: false, winner: "tie", amWinner: false });
  }
  return message;
}
```

Catatan: `myScore`/`oppScore` di atas tidak dipakai di path bothPlayed (winner dihitung ulang dari battle + score baru) — rapikan: gunakan variabel yang dihitung sebelum update untuk konsistensi. Implementer bebas menyederhanakan asal logika sama: winner dihitung dari (challengerScore final, challengedScore final).

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 152 pass (147 + 5).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/battle.ts lib/battle.test.ts
git commit -m "feat: quiz battle flow with winner resolution (TDD)"
```

---

### Task 4: lib/pets.ts — pure (TDD) + DB flow

**Files:**
- Create: `lib/pets.ts`, `lib/pets.test.ts`
- Modify: `lib/types.ts` (tambah PetItem)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface PetItem {
    id: number; pet_type: string; stage: number; exp: number; emoji: string; label: string; is_active: boolean;
  }

  // lib/pets.ts
  export function computePetStage(exp: number): 1 | 2 | 3 | 4
  // <100→1; <300→2; <1000→3; else 4
  export function feedPetProgress(stage: number, exp: number, gain?: number): { stage: number; exp: number }
  // exp+gain; naik stage saat melewati threshold (100/300/1000), exp reset per kenaikan; cap stage 4 (exp terus naik)
  export function petEmojiLabel(petType: string, stage: number): { emoji: string; label: string }
  export async function getActivePet(email: string): Promise<PetItem | null>
  export async function getAllPets(email: string): Promise<PetItem[]>
  export async function setActivePet(email: string, petId: number): Promise<void>
  export async function feedPet(email: string, petId: number): Promise<{ message: string; pet: PetItem }>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/pets.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computePetStage, feedPetProgress, petEmojiLabel } from "./pets";

describe("computePetStage", () => {
  it("0-99 → 1", () => {
    expect(computePetStage(0)).toBe(1);
    expect(computePetStage(99)).toBe(1);
  });
  it("100-299 → 2", () => {
    expect(computePetStage(100)).toBe(2);
    expect(computePetStage(299)).toBe(2);
  });
  it("300-999 → 3", () => {
    expect(computePetStage(300)).toBe(3);
    expect(computePetStage(999)).toBe(3);
  });
  it(">=1000 → 4", () => {
    expect(computePetStage(1000)).toBe(4);
  });
});

describe("feedPetProgress", () => {
  it("exp naik, stage tetap", () => {
    expect(feedPetProgress(1, 40)).toEqual({ stage: 1, exp: 90 });
  });
  it("melewati 100 → stage 2, exp reset", () => {
    expect(feedPetProgress(1, 80)).toEqual({ stage: 2, exp: 30 });
  });
  it("melewati 300 → stage 3", () => {
    expect(feedPetProgress(2, 280)).toEqual({ stage: 3, exp: 30 });
  });
  it("stage 4 → exp terus naik (Max)", () => {
    expect(feedPetProgress(4, 1200)).toEqual({ stage: 4, exp: 1250 });
  });
});

describe("petEmojiLabel", () => {
  it("dragon 4 stage", () => {
    expect(petEmojiLabel("dragon", 1).emoji).toBe("🥚");
    expect(petEmojiLabel("dragon", 4).emoji).toBe("🐉");
    expect(petEmojiLabel("dragon", 4).label).toBe("Naga Raksasa");
  });
  it("owl", () => {
    expect(petEmojiLabel("owl", 2).label).toBe("Anak Burung");
  });
  it("fenrir", () => {
    expect(petEmojiLabel("fenrir", 3).label).toBe("Serigala Muda");
  });
  it("fallback", () => {
    expect(petEmojiLabel("unknown", 1).label).toBe("Telur Misterius");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/pets.test.ts` — FAIL.

- [ ] **Step 3: Implementasi pure + tipe**

Tambah `PetItem` ke `lib/types.ts`.

Create `lib/pets.ts`:
```ts
import { db } from "./db";
import type { PetItem } from "./types";

export function computePetStage(exp: number): 1 | 2 | 3 | 4 {
  if (exp < 100) return 1;
  if (exp < 300) return 2;
  if (exp < 1000) return 3;
  return 4;
}

export function feedPetProgress(stage: number, exp: number, gain = 50): { stage: number; exp: number } {
  let newExp = exp + gain;
  let newStage = stage;
  while (newStage < 4) {
    const threshold = newStage === 1 ? 100 : newStage === 2 ? 300 : 1000;
    if (newExp < threshold) break;
    newExp -= threshold;
    newStage += 1;
  }
  return { stage: newStage, exp: newExp };
}

const PET_TABLE: Record<string, { emojis: string[]; labels: string[] }> = {
  dragon: {
    emojis: ["🥚", "🦎", "🦖", "🐉"],
    labels: ["Telur Naga", "Bayi Naga Api", "Naga Remaja", "Naga Raksasa"],
  },
  owl: {
    emojis: ["🥚", "🐣", "🐥", "🦉"],
    labels: ["Telur Burung", "Anak Burung", "Burung Kecil", "Burung Malam"],
  },
  fenrir: {
    emojis: ["🥚", "🐾", "🐕", "🐺"],
    labels: ["Telur Serigala", "Anak Serigala", "Serigala Muda", "Serigala Es"],
  },
};

export function petEmojiLabel(petType: string, stage: number): { emoji: string; label: string } {
  const table = PET_TABLE[petType];
  const idx = Math.min(Math.max(stage, 1), 4) - 1;
  if (!table) return { emoji: "🥚", label: "Telur Misterius" };
  return { emoji: table.emojis[idx], label: table.labels[idx] };
}

function toPetItem(p: { id: number; petType: string; stage: number; exp: number; isActive: boolean }): PetItem {
  const { emoji, label } = petEmojiLabel(p.petType, p.stage);
  return {
    id: p.id, pet_type: p.petType, stage: p.stage, exp: p.exp,
    emoji, label, is_active: p.isActive,
  };
}

export async function getActivePet(email: string): Promise<PetItem | null> {
  const pet = await db.userPet.findFirst({ where: { email, isActive: true } });
  return pet ? toPetItem(pet) : null;
}

export async function getAllPets(email: string): Promise<PetItem[]> {
  const pets = await db.userPet.findMany({ where: { email }, orderBy: { id: "asc" } });
  return pets.map(toPetItem);
}

export async function setActivePet(email: string, petId: number): Promise<void> {
  await db.$transaction([
    db.userPet.updateMany({ where: { email }, data: { isActive: false } }),
    db.userPet.updateMany({ where: { id: petId, email }, data: { isActive: true } }),
  ]);
}

export async function feedPet(email: string, petId: number): Promise<{ message: string; pet: PetItem }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("User stats tidak ditemukan.");
  if (stats.coins < 50) throw new Error("Koin tidak cukup! Butuh 50 Koin.");

  const pet = await db.userPet.findFirst({ where: { id: petId, email } });
  if (!pet) throw new Error("Peliharaan tidak ditemukan!");

  const next = feedPetProgress(pet.stage, pet.exp);
  const updated = await db.$transaction([
    db.userEngagementStat.update({ where: { email }, data: { coins: { decrement: 50 } } }),
    db.userPet.update({ where: { id: petId }, data: { stage: next.stage, exp: next.exp } }),
  ]);
  const fresh = updated[1];
  return { message: "Nyam nyam! Peliharaanmu senang.", pet: toPetItem(fresh) };
}
```

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 162 pass (152 + 10).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/pets.ts lib/pets.test.ts
git commit -m "feat: virtual pets with feeding and stages (TDD)"
```

---

### Task 5: lib/weakness.ts tambahan + lib/actions/analytics.ts

**Files:**
- Modify: `lib/weakness.ts` (tambah getWeaknessAnalytics, getSkillProgress7d)
- Create: `lib/actions/analytics.ts`
- Modify: `lib/types.ts` (tambah WeaknessAnalyticsItem, SkillProgressPoint)

**Interfaces:**
- Consumes: `db`, `getSession`, `getUserProfile`
- Produces:
  ```ts
  // lib/types.ts
  export interface WeaknessAnalyticsItem { topic: string; count_7d: number; count_30d: number; }
  export interface SkillProgressPoint { day: string; grammar: number; vocabulary: number; listening: number; }

  // lib/weakness.ts
  export async function getWeaknessAnalytics(email: string, language: string, limit: number): Promise<WeaknessAnalyticsItem[]>
  export async function getSkillProgress7d(email: string, language: string): Promise<SkillProgressPoint[]>

  // lib/actions/analytics.ts
  export async function getAnalyticsAction(): Promise<{ weakness: WeaknessAnalyticsItem[]; skills: SkillProgressPoint[] } | { error: string }>
  ```

- [ ] **Step 1: Implementasi lib/weakness.ts tambahan**

Append ke `lib/weakness.ts`:
```ts
import type { SkillProgressPoint, WeaknessAnalyticsItem } from "./types";

export async function getWeaknessAnalytics(email: string, language: string, limit: number): Promise<WeaknessAnalyticsItem[]> {
  const safeLimit = limit <= 0 ? 8 : Math.min(limit, 20);
  const rows = await db.weaknessLog.groupBy({
    by: ["topic"],
    where: { email, language },
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  // Prisma groupBy tidak mendukung COUNT FILTER per rentang — ambil semua lalu hitung di JS
  const since7 = new Date(Date.now() - 7 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);
  const logs = await db.weaknessLog.findMany({
    where: { email, language },
    select: { topic: true, createdAt: true },
  });
  const map = new Map<string, WeaknessAnalyticsItem>();
  for (const l of logs) {
    const item = map.get(l.topic) ?? { topic: l.topic, count_7d: 0, count_30d: 0 };
    if (l.createdAt && l.createdAt >= since7) item.count_7d += 1;
    if (l.createdAt && l.createdAt >= since30) item.count_30d += 1;
    map.set(l.topic, item);
  }
  return [...map.values()]
    .sort((a, b) => b.count_30d - a.count_30d || b.count_7d - a.count_7d)
    .slice(0, safeLimit);
}

export async function getSkillProgress7d(email: string, language: string): Promise<SkillProgressPoint[]> {
  const since = new Date(Date.now() - 7 * 86400000);
  const logs = await db.skillProgressLog.findMany({
    where: { email, language, createdAt: { gte: since } },
    select: { skill: true, isCorrect: true, createdAt: true },
  });
  const map = new Map<string, SkillProgressPoint>();
  for (const l of logs) {
    if (!l.isCorrect || !l.createdAt) continue;
    const day = l.createdAt.toISOString().slice(0, 10);
    const item = map.get(day) ?? { day, grammar: 0, vocabulary: 0, listening: 0 };
    if (l.skill === "grammar") item.grammar += 1;
    else if (l.skill === "vocabulary") item.vocabulary += 1;
    else if (l.skill === "listening") item.listening += 1;
    map.set(day, item);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}
```

- [ ] **Step 2: Implementasi `lib/actions/analytics.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { getSkillProgress7d, getWeaknessAnalytics } from "../weakness";
import type { SkillProgressPoint, WeaknessAnalyticsItem } from "../types";

export async function getAnalyticsAction(): Promise<{ weakness: WeaknessAnalyticsItem[]; skills: SkillProgressPoint[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };

  const language = profile.preferred_language;
  const [weakness, skills] = await Promise.all([
    getWeaknessAnalytics(session.email, language, 8),
    getSkillProgress7d(session.email, language),
  ]);
  return { weakness, skills };
}
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 162 pass; `npm run lint` — 0 error.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/analytics/page.tsx" components/AnalyticsView.tsx
git commit -m "feat: weakness analytics page with svg charts"
```

---

### Task 6: Server actions — leaderboard, social, pets, battle + integrasi quiz battle_id

**Files:**
- Create: `lib/actions/leaderboard.ts`, `lib/actions/social.ts`, `lib/actions/pets.ts`, `lib/actions/battle.ts`
- Modify: `app/(app)/quiz/[goal]/page.tsx` (battle_id searchParams), `components/QuizView.tsx` (prop battleId + submit battle score)

**Interfaces:**
- Consumes: Task 1-4 lib fns, `getSession`, `getUserProfile`
- Produces:
  ```ts
  // lib/actions/leaderboard.ts
  export async function getLeaderboardSummaryAction(): Promise<{
    weekly: { division: string; daysLeft: number; members: LeagueMemberRow[] } | null;
    global: LeaderboardRow[]; following: LeaderboardRow[];
  } | { error: string }>
  // weekly: getWeeklyLeague (bisa throw → null, setia legacy summary .ok())
  export async function searchUsersAction(query: string): Promise<{ users: SearchUserRow[] } | { error: string }>
  // query.trim().length < 3 → { error: "Ketik minimal 3 huruf..." }
  export async function toggleFollowAction(followedEmail: string, follow: boolean): Promise<ActionResult>
  export async function createBattleAction(challengedEmail: string, goal: string): Promise<ActionResult>
  // goal kosong → { error: "Topik kuis tidak boleh kosong!" }; language dari profil

  // lib/actions/social.ts
  export async function getSocialFeedAction(): Promise<{ feed: FeedItem[] } | { error: string }>
  export async function likeActivityAction(feedId: number): Promise<ActionResult>

  // lib/actions/pets.ts
  export async function getPetsAction(): Promise<{ active: PetItem | null; all: PetItem[] } | { error: string }>
  export async function setActivePetAction(petId: number): Promise<ActionResult>
  export async function feedPetAction(petId: number): Promise<{ message: string; pet: PetItem } | { error: string }>

  // lib/actions/battle.ts
  export async function getActiveBattlesAction(): Promise<{ battles: BattleItem[] } | { error: string }>
  export async function submitBattleScoreAction(battleId: number, score: number): Promise<ActionResult>
  ```

- [ ] **Step 1: Implementasi 4 action files**

`lib/actions/leaderboard.ts`:
```ts
"use server";

import { getSession } from "../auth";
import { getUserProfile } from "../profile";
import { createBattle, getFollowingLeaderboard, getGlobalLeaderboard, getWeeklyLeague } from "../leaderboard";
import { searchUsers, toggleFollow } from "../social";
import type { ActionResult } from "./types";
import type { LeaderboardRow, LeagueMemberRow, SearchUserRow } from "../types";

export async function getLeaderboardSummaryAction(): Promise<{
  weekly: { division: string; daysLeft: number; members: LeagueMemberRow[] } | null;
  global: LeaderboardRow[]; following: LeaderboardRow[];
} | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const weekly = await getWeeklyLeague(session.email).catch(() => null);
  const [global, following] = await Promise.all([
    getGlobalLeaderboard(10),
    getFollowingLeaderboard(session.email),
  ]);
  return { weekly, global, following };
}

export async function searchUsersAction(query: string): Promise<{ users: SearchUserRow[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const q = query.trim();
  if (q.length < 3) return { error: "Ketik minimal 3 huruf..." };
  const users = await searchUsers(q, session.email);
  return { users };
}

export async function toggleFollowAction(followedEmail: string, follow: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await toggleFollow(session.email, followedEmail, follow);
  return { message: "ok" };
}

export async function createBattleAction(challengedEmail: string, goal: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const profile = await getUserProfile(session.email);
  if (!profile) return { error: "Sesi berakhir. Silakan login kembali." };
  const g = goal.trim();
  if (!g) return { error: "Topik kuis tidak boleh kosong!" };
  await createBattle(session.email, challengedEmail, profile.preferred_language, g);
  return { message: "Tantangan berhasil dikirim! Tutup jendela ini." };
}
```

`lib/actions/social.ts`:
```ts
"use server";

import { getSession } from "../auth";
import { getSocialFeed, likeActivity } from "../social";
import type { ActionResult } from "./types";
import type { FeedItem } from "../types";

export async function getSocialFeedAction(): Promise<{ feed: FeedItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  return { feed: await getSocialFeed(session.email) };
}

export async function likeActivityAction(feedId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await likeActivity(feedId, session.email);
  return { message: "ok" };
}
```

`lib/actions/pets.ts`:
```ts
"use server";

import { getSession } from "../auth";
import { feedPet, getAllPets, getActivePet, setActivePet } from "../pets";
import type { ActionResult } from "./types";
import type { PetItem } from "../types";

export async function getPetsAction(): Promise<{ active: PetItem | null; all: PetItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const [active, all] = await Promise.all([getActivePet(session.email), getAllPets(session.email)]);
  return { active, all };
}

export async function setActivePetAction(petId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await setActivePet(session.email, petId);
  return { message: "ok" };
}

export async function feedPetAction(petId: number): Promise<{ message: string; pet: PetItem } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    return await feedPet(session.email, petId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memberi makan." };
  }
}
```

`lib/actions/battle.ts`:
```ts
"use server";

import { getSession } from "../auth";
import { getActiveBattles, submitBattleScore } from "../battle";
import type { ActionResult } from "./types";
import type { BattleItem } from "../types";

export async function getActiveBattlesAction(): Promise<{ battles: BattleItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  return { battles: await getActiveBattles(session.email) };
}

export async function submitBattleScoreAction(battleId: number, score: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    const message = await submitBattleScore(battleId, session.email, score);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim skor tantangan." };
  }
}
```

- [ ] **Step 2: Integrasi battle_id ke quiz**

Edit `app/(app)/quiz/[goal]/page.tsx` — tambah searchParams:
```tsx
export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ goal: string }>;
  searchParams: Promise<{ battle_id?: string }>;
}) {
  const { goal } = await params;
  const { battle_id } = await searchParams;
  const battleId = battle_id ? parseInt(battle_id, 10) || undefined : undefined;
  // ... render <QuizView ... battleId={battleId} />
}
```

Edit `components/QuizView.tsx`:
1. Props tambah `battleId?: number`
2. `finishQuiz` — setelah `submitQuizResultAction` sukses:
```tsx
if (battleId) {
  await submitBattleScoreAction(battleId, score).catch(() => {});
}
```
(import `submitBattleScoreAction` dari `@/lib/actions/battle`; await TAPI catch — tidak menggagalkan result screen)

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 162 pass; `npm run lint` — 0 error.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/leaderboard.ts lib/actions/social.ts lib/actions/pets.ts lib/actions/battle.ts "app/(app)/quiz/[goal]/page.tsx" components/QuizView.tsx
git commit -m "feat: leaderboard/social/pets/battle actions with quiz battle integration"
```

---

### Task 7: Halaman Leaderboard

**Files:**
- Create: `app/(app)/leaderboard/page.tsx`, `components/LeaderboardView.tsx`

**Interfaces:**
- Consumes: `getLeaderboardSummaryAction`, `searchUsersAction`, `toggleFollowAction`, `createBattleAction` (Task 6)
- Produces: halaman `/leaderboard` (4 tab + modal challenge)

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LeaderboardView from "@/components/LeaderboardView";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <LeaderboardView />;
}
```

- [ ] **Step 2: `components/LeaderboardView.tsx` (client)**

Struktur (4 tab + modal):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBattleAction, getLeaderboardSummaryAction, searchUsersAction, toggleFollowAction } from "@/lib/actions/leaderboard";
import type { LeaderboardRow, LeagueMemberRow, SearchUserRow } from "@/lib/types";

const DIVISION_HEADER: Record<string, string> = {
  Bronze: "🥉 Liga Perunggu",
  Silver: "🥈 Liga Perak",
  Gold: "🥇 Liga Emas",
  Diamond: "💎 Liga Berlian",
};

const NAME_COLOR_CLASS: Record<string, string> = {
  gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 font-black",
  crimson: "text-rose-600 font-black",
  neon_blue: "text-cyan-400 font-black",
};

const TITLE_BADGE: Record<string, string> = {
  polyglot: "🎓 Polyglot",
  sultan: "👑 Sultan",
  legend: "🌟 Legend",
};

type Tab = "liga" | "global" | "teman" | "cari";

export default function LeaderboardView() {
  const [tab, setTab] = useState<Tab>("liga");
  const [weekly, setWeekly] = useState<{ division: string; daysLeft: number; members: LeagueMemberRow[] } | null>(null);
  const [global, setGlobal] = useState<LeaderboardRow[]>([]);
  const [following, setFollowing] = useState<LeaderboardRow[]>([]);
  const [myEmail, setMyEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserRow[] | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [challengeGoal, setChallengeGoal] = useState("");
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [challengePending, setChallengePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLeaderboardSummaryAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setWeekly(res.weekly);
        setGlobal(res.global);
        setFollowing(res.following);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat leaderboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function doSearch() {
    setSearchMsg(null);
    if (searchQuery.trim().length < 3) {
      setSearchResults(null);
      setSearchMsg("Ketik minimal 3 huruf...");
      return;
    }
    const res = await searchUsersAction(searchQuery).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal mencari." }));
    if ("error" in res) {
      setSearchResults(null);
      setSearchMsg(res.error);
      return;
    }
    setSearchResults(res.users);
    if (res.users.length === 0) setSearchMsg("Tidak ditemukan.");
  }

  async function toggleFollow(email: string, follow: boolean) {
    await toggleFollowAction(email, follow).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  async function sendChallenge() {
    if (!challengeTarget) return;
    const goal = challengeGoal.trim();
    if (!goal) {
      setChallengeStatus("Topik kuis tidak boleh kosong!");
      return;
    }
    setChallengePending(true);
    setChallengeStatus("Mengirim tantangan...");
    const res = await createBattleAction(challengeTarget, goal).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal mengirim." }));
    setChallengePending(false);
    if ("error" in res) {
      setChallengeStatus(`Gagal: ${res.error}`);
      return;
    }
    setChallengeStatus(res.message ?? "Tantangan berhasil dikirim! Tutup jendela ini.");
  }

  if (error && !weekly && global.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Peringkat</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Coba Lagi</button>
      </div>
    );
  }

  if (!weekly && global.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const nameClass = (row: { active_name_color: string | null }) => NAME_COLOR_CLASS[row.active_name_color ?? ""] ?? "text-slate-700 dark:text-slate-300";
  const titleBadge = (row: { active_title: string | null }) => (row.active_title ? TITLE_BADGE[row.active_title] ?? "" : "");

  const renderGlobalRow = (row: LeaderboardRow, isFriend: boolean) => (
    <div key={row.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
      <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{row.rank}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${nameClass(row)}`}>{row.full_name}</p>
        <p className="text-[11px] text-slate-400">🔥 {row.current_streak} · {row.score} pts</p>
      </div>
      {titleBadge(row) && <span className="text-[11px] font-bold text-slate-500">{titleBadge(row)}</span>}
      {isFriend && row.email !== myEmail && (
        <button
          type="button"
          onClick={() => setChallengeTarget(row.email)}
          className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-colors"
        >
          ⚔️ Tantang
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-6 text-white mb-6 shadow-md">
        <h1 className="text-2xl font-extrabold">🏆 Papan Peringkat</h1>
        <p className="text-sm mt-1">Pantau progresmu dan tantang temanmu!</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["liga", "global", "teman", "cari"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              tab === t ? "bg-teal-500 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
            }`}
          >
            {t === "liga" ? "🛡️ Liga Mingguan" : t === "global" ? "🌍 Global" : t === "teman" ? "👥 Teman" : "🔍 Cari"}
          </button>
        ))}
      </div>

      {tab === "liga" && (
        <div>
          <p className="text-lg font-extrabold mb-1">{DIVISION_HEADER[weekly?.division ?? ""] ?? "Liga"}</p>
          <p className="text-xs text-slate-400 mb-4">Sisa {weekly?.daysLeft ?? 0} hari lagi minggu ini!</p>
          <div className="space-y-2">
            {(weekly?.members ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Data liga belum tersedia.</p>
            ) : (
              weekly?.members.map((m) => (
                <div key={m.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                    m.zone === "promosi" ? "text-emerald-600 bg-emerald-100" : m.zone === "degradasi" ? "text-rose-600 bg-rose-100" : "text-slate-500 bg-slate-100"
                  }`}>{m.rank}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${m.email === myEmail ? "text-amber-700" : nameClass(m)}`}>
                      {m.full_name} {m.email === myEmail && <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">Anda</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{m.active_title ? `${TITLE_BADGE[m.active_title] ?? ""} ` : ""}{m.league_score} pts</p>
                  </div>
                  {m.zone === "promosi" && <span className="text-[11px] font-bold text-emerald-600">⬆ Promosi</span>}
                  {m.zone === "degradasi" && <span className="text-[11px] font-bold text-rose-600">⬇ Degradasi</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "global" && <div className="space-y-2">{global.map((r) => renderGlobalRow(r, false))}</div>}

      {tab === "teman" && (
        <div className="space-y-2">
          {following.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Anda belum mengikuti siapa pun.</p>
              <button type="button" onClick={() => setTab("cari")} className="mt-3 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
                Cari Teman
              </button>
            </div>
          ) : (
            following.map((r) => renderGlobalRow(r, true))
          )}
        </div>
      )}

      {tab === "cari" && (
        <div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            placeholder="Cari nama atau email teman..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <button type="button" onClick={doSearch} className="mt-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">Cari</button>
          {searchMsg && <p className="text-xs text-slate-400 mt-2">{searchMsg}</p>}
          <div className="space-y-2 mt-4">
            {searchResults?.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{u.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{u.full_name}</p>
                  <p className="text-[11px] text-slate-400">🔥 {u.current_streak} · {u.score} pts</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFollow(u.email, !u.is_following)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    u.is_following ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : "bg-teal-500 hover:bg-teal-600 text-white"
                  }`}
                >
                  {u.is_following ? "Unfollow" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {challengeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setChallengeTarget(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">⚔️ Tantang Teman</h3>
            <p className="text-xs text-slate-400 mb-4">Pilih topik kuis yang ingin Anda ujikan. Siapa yang paling tinggi skornya, dia yang dapat Koin!</p>
            <input
              value={challengeGoal}
              onChange={(e) => setChallengeGoal(e.target.value)}
              placeholder="Contoh: Past Tense, Passive Voice..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {challengeStatus && <p className="text-xs mt-3 text-teal-600 dark:text-teal-400 font-semibold">{challengeStatus}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" disabled={challengePending} onClick={sendChallenge} className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
                {challengePending ? "Mengirim..." : "Kirim Tantangan"}
              </button>
              <button type="button" onClick={() => { setChallengeTarget(null); setChallengeStatus(null); setChallengeGoal(""); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Catatan: `myEmail` state belum diisi — wrapper server component bisa meneruskan session email sebagai prop: tambah prop `myEmail: string` dan wrapper `<LeaderboardView myEmail={session.email} />`; hapus useState myEmail. Implementer: sesuaikan (prop dari server, bukan state kosong).

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (162 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/leaderboard/page.tsx" components/LeaderboardView.tsx
git commit -m "feat: leaderboard page with weekly league, global, friends, search"
```

---

### Task 8: Halaman Analisis

**Files:**
- Create: `app/(app)/analytics/page.tsx`, `components/AnalyticsView.tsx`

**Interfaces:**
- Consumes: `getAnalyticsAction` (Task 5)
- Produces: halaman `/analytics` (2 tab SVG)

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnalyticsView from "@/components/AnalyticsView";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AnalyticsView />;
}
```

- [ ] **Step 2: `components/AnalyticsView.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalyticsAction } from "@/lib/actions/analytics";
import type { SkillProgressPoint, WeaknessAnalyticsItem } from "@/lib/types";

type Tab = "topik" | "tren";

const SERIES = [
  { key: "grammar", label: "Tata Bahasa (Grammar)", color: "#6366f1" },
  { key: "vocabulary", label: "Kosakata (Vocabulary)", color: "#ec4899" },
  { key: "listening", label: "Pendengaran (Listening)", color: "#f59e0b" },
] as const;

function maxOf(points: SkillProgressPoint[], key: "grammar" | "vocabulary" | "listening"): number {
  return Math.max(1, ...points.map((p) => p[key]));
}

export default function AnalyticsView() {
  const [tab, setTab] = useState<Tab>("topik");
  const [weakness, setWeakness] = useState<WeaknessAnalyticsItem[] | null>(null);
  const [skills, setSkills] = useState<SkillProgressPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setWeakness(res.weakness);
        setSkills(res.skills);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat analisis.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error && !weakness && !skills) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Analisis</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Coba Lagi</button>
      </div>
    );
  }

  if (!weakness || !skills) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const max30d = Math.max(1, ...weakness.map((w) => w.count_30d));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold">Analisis Kelemahan</h1>
      <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>

      <div className="flex gap-2 my-6">
        {(["topik", "tren"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t ? "bg-teal-500 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
            }`}
          >
            {t === "topik" ? "📋 Peta Topik Kelemahan" : "📊 Tren 7 Hari Terakhir"}
          </button>
        ))}
      </div>

      {tab === "topik" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {weakness.length === 0 ? (
            <div className="sm:col-span-2 text-center py-8">
              <p className="text-sm text-slate-400">Belum ada data kelemahan untuk bahasa ini.</p>
              <p className="text-xs text-slate-400 mt-1">Lakukan kuis atau latihan agar AI dapat memetakan fokus kelemahan Anda.</p>
            </div>
          ) : (
            weakness.map((w) => (
              <div key={w.topic} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                <p className="font-bold text-sm">{w.topic}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Akurasi kesalahan terdistribusi secara berkala.</p>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>7 Hari Terakhir</span>
                    <span>{w.count_7d}x salah</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (w.count_7d / max30d) * 100)}%` }} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>30 Hari Terakhir</span>
                    <span>{w.count_30d}x salah</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (w.count_30d / max30d) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "tren" && (
        <div>
          {skills.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Belum ada data tren keterampilan.</p>
              <p className="text-xs text-slate-400 mt-1">Selesaikan materi pelajaran & kuis harian untuk melihat grafik tren keterampilan Anda.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <svg viewBox="0 0 560 220" className="w-full h-auto">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <line key={f} x1={50} x2={530} y1={20 + f * 160} y2={20 + f * 160} stroke="#e2e8f0" strokeWidth="1" />
                ))}
                {SERIES.map((s) => {
                  const max = maxOf(skills, s.key);
                  const xs = skills.map((_, i) => 50 + (i / Math.max(1, skills.length - 1)) * 480);
                  const ys = skills.map((p) => 180 - (p[s.key] / max) * 160);
                  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
                  const area = `${line} L${xs[xs.length - 1]?.toFixed(1)},180 L${xs[0]?.toFixed(1)},180 Z`;
                  return (
                    <g key={s.key}>
                      <path d={area} fill={s.color} opacity="0.12" />
                      <path d={line} fill="none" stroke={s.color} strokeWidth="2" />
                      {xs.map((x, i) => (
                        <circle key={i} cx={x} cy={ys[i]} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />
                      ))}
                    </g>
                  );
                })}
                {skills.map((p, i) => {
                  const x = 50 + (i / Math.max(1, skills.length - 1)) * 480;
                  return (
                    <text key={i} x={x} y={205} textAnchor="middle" fontSize="10" fill="#94a3b8">
                      {p.day.slice(5)}
                    </text>
                  );
                })}
              </svg>
              <div className="flex flex-wrap gap-4 mt-3">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (162 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/analytics/page.tsx" components/AnalyticsView.tsx
git commit -m "feat: weakness analytics page with svg charts"
```
### Task 9: Dashboard — feed, arena battle, pet card + navbar

**Files:**
- Create: `components/SocialFeedSection.tsx`, `components/BattleArenaSection.tsx`, `components/PetCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (render 3 section), `components/Navbar.tsx` (Leaderboard + Analisis links)

**Interfaces:**
- Consumes: `getSocialFeedAction`/`likeActivityAction` (Task 6), `getActiveBattlesAction` (Task 6), `getPetsAction`/`setActivePetAction`/`feedPetAction` (Task 6)
- Produces: dashboard lengkap + navbar links

- [ ] **Step 1: `components/SocialFeedSection.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getSocialFeedAction, likeActivityAction } from "@/lib/actions/social";
import type { FeedItem } from "@/lib/types";

export default function SocialFeedSection() {
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSocialFeedAction()
      .then((res) => {
        if (cancelled) return;
        if (!("error" in res)) setFeed(res.feed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function like(feedId: number) {
    await likeActivityAction(feedId).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  if (feed === null) return null;
  if (feed.length === 0) {
    return (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold mb-3">📰 Beranda Aktivitas Teman</h2>
        <p className="text-sm text-slate-400">Belum ada aktivitas baru dari teman yang Anda ikuti.</p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-3">📰 Beranda Aktivitas Teman</h2>
      <div className="space-y-3">
        {feed.map((f) => (
          <div key={f.id} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <span className="w-9 h-9 rounded-full bg-teal-500/10 flex items-center justify-center text-lg shrink-0">{f.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-bold">{f.full_name}</span> <span className="text-slate-500">{f.content}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{f.created_at}</p>
            </div>
            <button
              type="button"
              disabled={f.has_liked}
              onClick={() => like(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                f.has_liked ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 cursor-default" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              {f.has_liked ? `🎉 ${f.likes_count}` : `Kasih Selamat 🎉${f.likes_count > 0 ? ` ${f.likes_count}` : ""}`}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `components/BattleArenaSection.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveBattlesAction } from "@/lib/actions/battle";
import type { BattleItem } from "@/lib/types";

export default function BattleArenaSection() {
  const [battles, setBattles] = useState<BattleItem[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getActiveBattlesAction()
      .then((res) => {
        if (cancelled) return;
        if (!("error" in res)) setBattles(res.battles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (battles === null) return null;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-3">⚔️ Arena Pertarungan</h2>
      {battles.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada pertarungan aktif.</p>
      ) : (
        <div className="space-y-2">
          {battles.map((b) => {
            const pendingAndOpen = b.status === "pending" && b.my_score === null;
            const pendingWaiting = b.status === "pending" && b.my_score !== null;
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div>
                  <p className="text-sm font-bold">Vs {b.opponent_name}</p>
                  <p className="text-[11px] text-slate-400">Topik: {b.goal} ({b.language})</p>
                  {b.status === "completed" && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Skor: Kamu {b.my_score} - {b.opponent_score} {b.opponent_name}</p>
                  )}
                </div>
                {pendingAndOpen && (
                  <Link
                    href={`/quiz/${encodeURIComponent(b.goal)}?battle_id=${b.id}`}
                    className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shrink-0"
                  >
                    Terima Tantangan!
                  </Link>
                )}
                {pendingWaiting && <span className="text-[11px] font-bold text-slate-400 shrink-0">Menunggu Lawan</span>}
                {b.status !== "pending" && <span className="text-[11px] font-bold text-slate-400 shrink-0">Selesai</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: `components/PetCard.tsx` (client) + modal koleksi**

```tsx
"use client";

import { useEffect, useState } from "react";
import { feedPetAction, getPetsAction, setActivePetAction } from "@/lib/actions/pets";
import type { PetItem } from "@/lib/types";

export default function PetCard() {
  const [active, setActive] = useState<PetItem | null>(null);
  const [all, setAll] = useState<PetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPetsAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setActive(res.active);
        setAll(res.all);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!loaded) return null;
  if (!active && all.length === 0) return null;

  const maxExp = active?.stage === 1 ? 100 : active?.stage === 2 ? 300 : active?.stage === 3 ? 1000 : 1;
  const expPercent = active && active.stage < 4 ? Math.min(100, (active.exp / maxExp) * 100) : 100;

  async function feed() {
    if (!active) return;
    setStatus(null);
    setError(null);
    const res = await feedPetAction(active.id).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal memberi makan." }));
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setStatus(res.message);
    setActive(res.pet);
    setAll((prev) => prev.map((p) => (p.id === res.pet.id ? res.pet : p)));
  }

  async function setActivePet(petId: number) {
    await setActivePetAction(petId).catch(() => {});
    setModalOpen(false);
    setReloadKey((k) => k + 1);
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-3">🐾 Peliharaan</h2>
      {active && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-32 h-32 rounded-full bg-teal-500/10 flex items-center justify-center text-6xl">
            {active.emoji}
          </div>
          <p className="font-bold">{active.label} (Lv. {active.stage})</p>
          <div className="w-full max-w-xs h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500" style={{ width: `${expPercent}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">{active.stage >= 4 ? "Max" : `${active.exp}/${maxExp} EXP`}</p>
          {status && <p className="text-xs font-bold text-teal-600 dark:text-teal-400 animate-pulse">{status}</p>}
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          <button type="button" onClick={feed} className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
            🍎 Beri Makan (50 Koin)
          </button>
          <button type="button" onClick={() => setModalOpen(true)} className="text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors">
            🔄 Ganti Peliharaan
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">🐾 Koleksi Peliharaan</h3>
            {all.length === 0 ? (
              <p className="text-sm text-slate-400">Anda belum memiliki peliharaan. Beli telur di Toko!</p>
            ) : (
              <div className="space-y-2">
                {all.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.is_active ? "border-amber-500/60 bg-amber-500/5" : "border-slate-200 dark:border-slate-700"}`}>
                    <span className="text-3xl">{p.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{p.label}</p>
                      <p className="text-[11px] text-slate-400">Lv. {p.stage} | {p.exp} EXP</p>
                    </div>
                    {p.is_active ? (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Sedang Dipakai</span>
                    ) : (
                      <button type="button" onClick={() => setActivePet(p.id)} className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
                        Jadikan Utama
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setModalOpen(false)} className="mt-5 w-full text-xs text-slate-400 hover:text-slate-600">Tutup</button>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Dashboard render + Navbar links**

Edit `app/(app)/dashboard/page.tsx` — di akhir JSX (setelah section badges / sebelum penutup), tambah:
```tsx
<SocialFeedSection />
<BattleArenaSection />
<PetCard />
```
+ imports (3 komponen).

Edit `components/Navbar.tsx` — tambah setelah link Kurikulum:
```tsx
<Link href="/leaderboard" className={tabClass(pathname === "/leaderboard")}>Leaderboard</Link>
<Link href="/analytics" className={tabClass(pathname === "/analytics")}>Analisis</Link>
```

- [ ] **Step 5: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (162 pass).

- [ ] **Step 6: Commit**

```bash
git add components/SocialFeedSection.tsx components/BattleArenaSection.tsx components/PetCard.tsx "app/(app)/dashboard/page.tsx" components/Navbar.tsx
git commit -m "feat: dashboard social feed, battle arena, pet card, navbar links"
```

---

### Task 10: AGENTS.md + verifikasi final

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

- Routes: `/leaderboard`, `/analytics`
- lib: `leaderboard.ts`, `social.ts`, `battle.ts`, `pets.ts` (+ weakness analytics); actions: `leaderboard.ts|social.ts|pets.ts|battle.ts|analytics.ts`
- Konvensi: liga lazy assign (FOR UPDATE raw SQL); hook streak_milestone/level_up/league score di lib/progress.ts; battle via `/quiz/:goal?battle_id=N`
- Status: Fase 4b selesai; tersisa 5 (admin), 6 (cron + deploy Vercel + cutover)

- [ ] **Step 2: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```
Expected: lint 0 error; tsc bersih; 162 test pass; build sukses; migrate "up to date".

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for phase 4b (social and competition)"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Liga + leaderboards | 142 test (11 baru) |
| 2. Social + hooks | 147 test (5 baru) |
| 3. Battle | 152 test (5 baru) |
| 4. Pets | 162 test (10 baru) |
| 5. Analytics queries + action | tsc/lint/test |
| 6. Actions + quiz battle_id | tsc/lint/test |
| 7. Leaderboard page | lint/tsc/test |
| 8. Analytics page | lint/tsc/test |
| 9. Dashboard sections + navbar | lint/tsc/test |
| 10. AGENTS + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **FOR UPDATE + $queryRaw**: pastikan template literal param (bukan string concatenation) — Prisma $queryRaw aman terhadap injection. Tabel: league_groups/user_league_members (nama asli).
- **Relasi Prisma**: userLeagueMember.group/user — cek schema; bila tidak ada relasi, query manual. PK komposit: email_groupId (user_league_members), follower_email_followed_email (followers), feedId_likerEmail (social_feed_likes) — cek nama generated.
- **LeaderboardView myEmail**: gunakan prop dari server component (bukan state kosong).
- **getWeeklyLeague MENULIS** (lazy assign) — dipanggil saat buka leaderboard; aman, tapi jangan dipanggil di test unit.
- **Analytics groupBy**: Prisma groupBy tidak support COUNT FILTER — implementasi memakai findMany + hitung JS (benar, data kecil).
- **Battle score race**: kedua user submit hampir bersamaan — update terakhir menang; legacy sama; acceptable.
- **Hooks**: streak_milestone hanya di update path (streak hasil computeStreakAfterActivity); level_up saat newBase !== oldBase.


---

