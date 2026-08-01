# LingoMind Fase 4a — Ekonomi & Status (Shop + Badges + Misi + Profile + Guide) — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport sistem ekonomi & status LingoMind ke Next.js: toko (18 item + refill nyawa), badge otomatis, klaim misi harian 3 peti, halaman profil + galeri kosmetik, halaman panduan, dan integrasi navbar/dashboard.

**Architecture:** Logika murni (badge matching, mystery roll, streak repair, tier requirement) dipisah ke fungsi murni di `lib/badges.ts`/`lib/shop.ts`/`lib/mission.ts` dan diuji vitest (TDD). DB flow (buy transaction, badge award hook, claim) di modul lib + server actions dengan `getSession()`. Seed badges (3) + shop_items (18) ditambah ke `prisma/seed.ts` (upsert idempotent, tanpa migration — tabel sudah ada). Hook badge di `updateEngagementAfterQuiz` (fire-and-forget, tidak menggagalkan flow utama).

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), vitest, Tailwind v4.

**Referensi kode lama (sumber kebenaran):**
- Shop: `dioxus/src/services/shop.rs` (buy flow 10-290), `dioxus/src/views/shop.rs`
- Badges: `dioxus/src/services/badge.rs`, `dioxus/src/services/engagement.rs:69` (hook)
- Misi: `dioxus/src/services/mission.rs:194-304`
- Profile: `dioxus/src/services/profile.rs`, `dioxus/src/views/profile.rs`, helpers `dioxus/src/views/leaderboard.rs` (get_name_color_class, render_title_badge, get_frame_class)
- Guide: `dioxus/src/views/guide.rs`
- Hearts: `dioxus/src/services/engagement.rs` (refill_hearts_with_coins)

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis legacy (dikutip tiap task). Dua format koin berbeda: shop `Koin tidak cukup (butuh {cost}).` vs hearts `Koin tidak cukup! Butuh {n} Koin.` vs pet `Koin tidak cukup! Butuh 50 Koin.`
- **Prisma**: `db.shopItem` (effectType, iconName, cost), `db.userInventory` (itemType, itemValue), `db.badge` (name, description, iconName, requirementType, requirementValue), `db.userBadge` (email, badgeId, earnedAt; upsert where `email_badgeId`), `db.userPet` (email, petType, stage, exp, isActive), `db.userEngagementStat` (coins, streakFreezes, doubleXpUntil, hasWeekendAmulet, activeFrame, activeTitle, activeNameColor, hearts, lastHeartRefill, currentStreak, previousStreak, lastActiveDate, totalQuizCompleted), `db.userDailyMission` (quizzesCompleted, correctAnswersToday, pvpWinsToday, tier1Claimed/tier2Claimed/tier3Claimed), `db.socialFeed` (email, activityType, content, likesCount)
- **Setiap server action yang butuh user memanggil `getSession()`**; error session = `Sesi berakhir. Silakan login kembali.`
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`**; fire-and-forget dari client selalu `.catch(() => {})`.
- **Tanpa perubahan skema/migration** (seed data saja via `prisma db seed`); `npx prisma migrate status` tetap up to date.
- Modul yang di-import client component TIDAK BOLEH import db (pelajaran fase 3) — pure helpers di `lib/*` terpisah dari DB helpers (DB di lib yang sama BOLEH selama hanya di-import server actions/server components; hati-hati: ShopView client hanya import actions).

---

### Task 1: Seed badges + shop_items

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `db` (prisma/seed.ts sudah pakai)
- Produces: DB berisi 3 badges + 18 shop_items (idempotent upsert)

- [ ] **Step 1: Baca seed.ts lalu tambah data**

Baca `prisma/seed.ts` (struktur upsert yang ada). Tambah di akhir `main()`:

```ts
  // ---- Badges ----
  const badges = [
    { name: "First Step", description: "Menyelesaikan kuis pertama.", icon_name: "🎯", requirement_type: "quiz_completed", requirement_value: 1 },
    { name: "Week Warrior", description: "Mencapai 7 hari streak belajar.", icon_name: "🔥", requirement_type: "streak", requirement_value: 7 },
    { name: "Rich Scholar", description: "Mengumpulkan 100 koin.", icon_name: "💰", requirement_type: "coins", requirement_value: 100 },
  ];
  let badgesUpserted = 0;
  for (const b of badges) {
    await db.badge.upsert({
      where: { name: b.name },
      create: b,
      update: {},
    });
    badgesUpserted++;
  }
  console.log(`badges seeded/verified: ${badgesUpserted}`);

  // ---- Shop items ----
  const shopItems = [
    { name: "Streak Freeze", description: "Menjaga streak tetap utuh jika kamu absen satu hari.", cost: 50, effect_type: "streak_freeze", icon_name: "❄️" },
    { name: "Double XP Potion", description: "Menggandakan perolehan XP selama 1 jam berikutnya.", cost: 100, effect_type: "double_xp", icon_name: "🧪" },
    { name: "Weekend Amulet", description: "Melindungi streak di akhir pekan.", cost: 80, effect_type: "weekend_amulet", icon_name: "🛡️" },
    { name: "Gold Profile Frame", description: "Bingkai profil emas eksklusif.", cost: 250, effect_type: "profile_frame_gold", icon_name: "🖼️" },
    { name: "Mystery Box", description: "Kotak misteri dengan hadiah acak!", cost: 50, effect_type: "mystery_box", icon_name: "🎁" },
    { name: "Diamond Profile Frame", description: "Bingkai profil berlian premium.", cost: 500, effect_type: "profile_frame_diamond", icon_name: "💎" },
    { name: "Mythic Profile Frame", description: "Bingkai profil mythic langka.", cost: 1000, effect_type: "profile_frame_mythic", icon_name: "🌌" },
    { name: "Gelar: Polyglot", description: "Gelar prestise Polyglot.", cost: 500, effect_type: "title_polyglot", icon_name: "🎓" },
    { name: "Gelar: Sultan", description: "Gelar prestise Sultan.", cost: 1000, effect_type: "title_sultan", icon_name: "👑" },
    { name: "Gelar: Legend", description: "Gelar prestise Legend.", cost: 2000, effect_type: "title_legend", icon_name: "🌟" },
    { name: "Warna Nama: Gold", description: "Warna nama emas.", cost: 800, effect_type: "name_color_gold", icon_name: "✨" },
    { name: "Warna Nama: Crimson", description: "Warna nama crimson.", cost: 800, effect_type: "name_color_crimson", icon_name: "🔥" },
    { name: "Warna Nama: Neon Blue", description: "Warna nama neon biru.", cost: 800, effect_type: "name_color_neon_blue", icon_name: "⚡" },
    { name: "Streak Repair", description: "Pulihkan streak yang hangus.", cost: 2000, effect_type: "streak_repair", icon_name: "🩹" },
    { name: "Tiket Ujian Ulang", description: "Buka gembok cooldown Exam agar bisa langsung mengambil ujian ulang.", cost: 1000, effect_type: "exam_retake", icon_name: "🎫" },
    { name: "Telur Naga Api", description: "Telur misterius naga api.", cost: 250, effect_type: "egg_dragon", icon_name: "🥚" },
    { name: "Telur Burung Malam", description: "Telur misterius burung malam.", cost: 250, effect_type: "egg_owl", icon_name: "🥚" },
    { name: "Telur Serigala Es", description: "Telur misterius serigala es.", cost: 250, effect_type: "egg_fenrir", icon_name: "🥚" },
  ];
  let shopUpserted = 0;
  for (const s of shopItems) {
    await db.shopItem.upsert({
      where: { name: s.name },
      create: s,
      update: {},
    });
    shopUpserted++;
  }
  console.log(`shop items seeded/verified: ${shopUpserted}`);
```

Catatan: `db.badge.upsert` where `{ name }` — badge.name unik (schema UNIQUE). `db.shopItem.upsert` where `{ name }` — shop_items TIDAK punya unique constraint di name di legacy! Prisma upsert butuh unique field — cek `prisma/schema.prisma` model ShopItem: apakah ada `@unique` di name? Kalau tidak ada, gunakan `createMany({ skipDuplicates: false })`? — lebih baik: cek schema; bila tak ada unique, gunakan pola: `findFirst({ where: { name } })` → tidak ada → `create`. Implementer: baca schema dulu dan pilih pola yang valid (upsert bila unique, findFirst+create bila tidak). JANGAN ubah schema.

- [ ] **Step 2: Jalankan seed + verifikasi**

```powershell
npx prisma db seed
npx tsx --env-file=.env -e "import { db } from './lib/db'; Promise.all([db.badge.count(), db.shopItem.count()]).then(([b, s]) => { console.log('badges:', b, '| shop items:', s); process.exit(b === 3 && s === 18 ? 0 : 1); })"
```
Expected: `badges: 3 | shop items: 18`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed badges and shop items"
```

---

### Task 2: lib/badges.ts (TDD) + hook di updateEngagementAfterQuiz

**Files:**
- Create: `lib/badges.ts`, `lib/badges.test.ts`
- Modify: `lib/progress.ts` (hook), `lib/types.ts` (tambah BadgeItem)

**Interfaces:**
- Consumes: `db`, `db.userEngagementStat`, `db.userBadge`, `db.socialFeed`
- Produces:
  ```ts
  // lib/types.ts
  export interface BadgeItem {
    id: number; name: string; description: string; icon_name: string;
    requirement_type: string; requirement_value: number;
  }

  // lib/badges.ts
  export interface BadgeStats { current_streak: number; total_quiz_completed: number; coins: number; }
  export function evaluateBadgeMatches(stats: BadgeStats, badges: { id: number; requirement_type: string; requirement_value: number; name: string }[]): { id: number; name: string }[]
  export async function evaluateAndAwardBadges(email: string): Promise<void>
  // stats → unowned badges → match → createMany skipDuplicates → jika ada baru: log socialFeed "badge_earned" per badge ("Mendapatkan lencana baru: {name}!")
  export async function getUserBadges(email: string): Promise<BadgeItem[]>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/badges.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { evaluateBadgeMatches } from "./badges";

const badges = [
  { id: 1, requirement_type: "quiz_completed", requirement_value: 1, name: "First Step" },
  { id: 2, requirement_type: "streak", requirement_value: 7, name: "Week Warrior" },
  { id: 3, requirement_type: "coins", requirement_value: 100, name: "Rich Scholar" },
  { id: 4, requirement_type: "unknown", requirement_value: 999, name: "Ignore" },
];

describe("evaluateBadgeMatches", () => {
  it("semua terpenuhi", () => {
    const earned = evaluateBadgeMatches({ current_streak: 10, total_quiz_completed: 5, coins: 150 }, badges);
    expect(earned.map((b) => b.id).sort()).toEqual([1, 2, 3]);
  });
  it("tidak ada yang terpenuhi", () => {
    expect(evaluateBadgeMatches({ current_streak: 0, total_quiz_completed: 0, coins: 0 }, badges)).toEqual([]);
  });
  it("threshold tepat di nilai (>=)", () => {
    const earned = evaluateBadgeMatches({ current_streak: 7, total_quiz_completed: 1, coins: 100 }, badges);
    expect(earned.map((b) => b.id).sort()).toEqual([1, 2, 3]);
  });
  it("requirement_type tidak dikenal diabaikan", () => {
    const earned = evaluateBadgeMatches({ current_streak: 1000, total_quiz_completed: 1000, coins: 1000 }, [badges[3]]);
    expect(earned).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/badges.test.ts` — FAIL (module tidak ada).

- [ ] **Step 3: Implementasi**

Tambah tipe ke `lib/types.ts` (per Interfaces).

Create `lib/badges.ts`:
```ts
import { db } from "./db";
import type { BadgeItem } from "./types";

export interface BadgeStats {
  current_streak: number;
  total_quiz_completed: number;
  coins: number;
}

interface BadgeCandidate {
  id: number;
  requirement_type: string;
  requirement_value: number;
  name: string;
}

export function evaluateBadgeMatches(stats: BadgeStats, badges: BadgeCandidate[]): { id: number; name: string }[] {
  const earned: { id: number; name: string }[] = [];
  for (const b of badges) {
    let met = false;
    if (b.requirement_type === "quiz_completed") met = stats.total_quiz_completed >= b.requirement_value;
    else if (b.requirement_type === "streak") met = stats.current_streak >= b.requirement_value;
    else if (b.requirement_type === "coins") met = stats.coins >= b.requirement_value;
    if (met) earned.push({ id: b.id, name: b.name });
  }
  return earned;
}

export async function evaluateAndAwardBadges(email: string): Promise<void> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) return;

  const allBadges = await db.badge.findMany();
  const owned = await db.userBadge.findMany({ where: { email } });
  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const candidates = allBadges.filter((b) => !ownedIds.has(b.id)).map((b) => ({
    id: b.id,
    requirement_type: b.requirementType,
    requirement_value: b.requirementValue,
    name: b.name,
  }));

  const earned = evaluateBadgeMatches(
    { current_streak: stats.currentStreak, total_quiz_completed: stats.totalQuizCompleted, coins: stats.coins },
    candidates
  );

  if (earned.length === 0) return;

  for (const b of earned) {
    const created = await db.userBadge.create({ data: { email, badgeId: b.id } }).catch(() => null);
    if (created) {
      await db.socialFeed.create({
        data: { email, activityType: "badge_earned", content: `Mendapatkan lencana baru: ${b.name}!` },
      }).catch(() => {});
    }
  }
}

export async function getUserBadges(email: string): Promise<BadgeItem[]> {
  const rows = await db.userBadge.findMany({
    where: { email },
    orderBy: { earnedAt: "desc" },
    include: { badge: true },
  });
  return rows.map((r) => ({
    id: r.badge.id,
    name: r.badge.name,
    description: r.badge.description,
    icon_name: r.badge.iconName,
    requirement_type: r.badge.requirementType,
    requirement_value: r.badge.requirementValue,
  }));
}
```

Catatan: relasi `userBadge.badge` — cek schema (UserBadge punya relasi ke Badge? — model UserBadge: email, badgeId, earnedAt; pastikan relasi `badge` ada; kalau tidak ada relasi di Prisma schema, gunakan `db.badge.findMany({ where: { id: { in: rows.map(r => r.badgeId) } } })` + map manual — sesuaikan).

- [ ] **Step 4: Hook di `lib/progress.ts`**

Edit `lib/progress.ts` — di akhir `updateEngagementAfterQuiz`, setelah update stats, tambah:

```ts
import { evaluateAndAwardBadges } from "./badges";
// ...
  // akhir fungsi, sebelum closing brace:
  await evaluateAndAwardBadges(email).catch(() => {});
```

Hanya di path update (bukan create)? Legacy memanggil badge evaluate setelah upsert (kedua path). Panggil di akhir fungsi (setelah if/else) — berlaku kedua path. Fire-and-forget dengan catch (jangan gagalkan flow).

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — semua pass (111 + 4 = 115).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/badges.ts lib/badges.test.ts lib/progress.ts
git commit -m "feat: badge system with engagement hook (TDD)"
```

---

### Task 3: lib/shop.ts — pure helpers (TDD) + buy flow + refill

**Files:**
- Create: `lib/shop.ts`, `lib/shop.test.ts`
- Modify: `lib/types.ts` (tambah ShopItem)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface ShopItem {
    id: number; name: string; description: string | null;
    cost: number; effect_type: string; icon_name: string | null;
  }

  // lib/shop.ts
  export type ShopMysteryOutcome =
    | { kind: "zonk"; coins: number; message: string }
    | { kind: "double_xp"; message: string }
    | { kind: "streak_freeze"; message: string }
    | { kind: "jackpot"; coins: number; message: string };
  export function decideShopMysteryRoll(roll: number): ShopMysteryOutcome
  // <=40 zonk +10; <=75 double xp 1 jam; <=95 freeze; else jackpot +100
  export type StreakRepairOutcome =
    | { action: "none"; message: string }
    | { action: "restore"; currentStreak: number; lastActiveDate: Date; message: string };
  export function decideStreakRepair(input: { lastActiveDate: Date | null; currentStreak: number; previousStreak: number; now: Date }): StreakRepairOutcome
  export async function getShopItems(email: string): Promise<(ShopItem & { is_owned: boolean })[]>
  export async function buyItem(email: string, itemId: number): Promise<string>
  // port lengkap; throw Error dengan pesan legacy; transaction
  export async function refillHearts(email: string): Promise<{ hearts: number }>
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/shop.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { decideShopMysteryRoll, decideStreakRepair } from "./shop";

describe("decideShopMysteryRoll", () => {
  it("zonk <= 40", () => {
    const r = decideShopMysteryRoll(40);
    expect(r.kind).toBe("zonk");
    expect(r.coins).toBe(10);
  });
  it("double xp 41-75", () => {
    expect(decideShopMysteryRoll(75).kind).toBe("double_xp");
  });
  it("streak freeze 76-95", () => {
    expect(decideShopMysteryRoll(95).kind).toBe("streak_freeze");
  });
  it("jackpot > 95", () => {
    const r = decideShopMysteryRoll(100);
    expect(r.kind).toBe("jackpot");
    expect(r.coins).toBe(100);
  });
});

describe("decideStreakRepair", () => {
  const now = new Date("2026-08-02T10:00:00Z");
  it("tanpa riwayat → belum hangus", () => {
    const r = decideStreakRepair({ lastActiveDate: null, currentStreak: 0, previousStreak: 0, now });
    expect(r.action).toBe("none");
    expect(r.message).toContain("belum memiliki riwayat");
  });
  it("aktif hari ini → masih aktif", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-08-02T00:00:00Z"), currentStreak: 3, previousStreak: 0, now });
    expect(r.action).toBe("none");
    expect(r.message).toContain("masih aktif");
  });
  it("kemarin → masih aktif (diff 1)", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-08-01T00:00:00Z"), currentStreak: 3, previousStreak: 0, now });
    expect(r.action).toBe("none");
  });
  it("gap >= 2 hari → restore", () => {
    const r = decideStreakRepair({ lastActiveDate: new Date("2026-07-25T00:00:00Z"), currentStreak: 3, previousStreak: 5, now });
    expect(r.action).toBe("restore");
    expect(r.currentStreak).toBe(6); // previous + 1
    expect(r.message).toContain("berhasil dipulihkan");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/shop.test.ts` — FAIL.

- [ ] **Step 3: Implementasi pure helpers + tipe**

Tambah `ShopItem` ke `lib/types.ts` (per Interfaces).

Create `lib/shop.ts`:
```ts
import { db } from "./db";
import type { ShopItem } from "./types";

export type ShopMysteryOutcome =
  | { kind: "zonk"; coins: number; message: string }
  | { kind: "double_xp"; message: string }
  | { kind: "streak_freeze"; message: string }
  | { kind: "jackpot"; coins: number; message: string };

export function decideShopMysteryRoll(roll: number): ShopMysteryOutcome {
  if (roll <= 40) return { kind: "zonk", coins: 10, message: "Mystery Box: Zonk! Kamu dapat kembalian 10 koin." };
  if (roll <= 75) return { kind: "double_xp", message: "Mystery Box: Hoki! Kamu dapat efek Double XP 1 Jam!" };
  if (roll <= 95) return { kind: "streak_freeze", message: "Mystery Box: Mantap! Kamu dapat 1 Streak Freeze!" };
  return { kind: "jackpot", coins: 100, message: "Mystery Box: JACKPOT! 🎉 Kamu dapat 100 koin!" };
}

export type StreakRepairOutcome =
  | { action: "none"; message: string }
  | { action: "restore"; currentStreak: number; lastActiveDate: Date; message: string };

export function decideStreakRepair(input: {
  lastActiveDate: Date | null;
  currentStreak: number;
  previousStreak: number;
  now: Date;
}): StreakRepairOutcome {
  const { lastActiveDate, currentStreak, previousStreak, now } = input;
  if (!lastActiveDate) return { action: "none", message: "Anda belum memiliki riwayat belajar." };

  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(now) - day(lastActiveDate)) / 86400000);

  if (diff <= 1) return { action: "none", message: "Streak Anda masih aktif hari ini. Lakukan 1 kuis untuk mempertahankannya!" };
  if (diff >= 2) {
    const restored = previousStreak + 1;
    const lastActive = new Date(day(now) - 86400000);
    return { action: "restore", currentStreak: restored, lastActiveDate: lastActive, message: "Streak Anda berhasil dipulihkan!" };
  }
  return { action: "none", message: "Streak Anda belum hangus." };
}
```

- [ ] **Step 4: Implementasi DB flow**

Lanjut di `lib/shop.ts` (append):

```ts
export async function getShopItems(email: string): Promise<(ShopItem & { is_owned: boolean })[]> {
  const items = await db.shopItem.findMany({ orderBy: { cost: "asc" } });
  const owned = await db.userInventory.findMany({ where: { email } });
  const ownedTypes = new Set(owned.map((o) => o.itemType));
  return items.map((i) => ({
    id: i.id, name: i.name, description: i.description, cost: i.cost,
    effect_type: i.effectType, icon_name: i.iconName,
    is_owned: ownedTypes.has(i.effectType),
  }));
}

export async function buyItem(email: string, itemId: number): Promise<string> {
  const item = await db.shopItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item tidak ditemukan.");

  let stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) {
    stats = await db.userEngagementStat.create({ data: { email, coins: 0, currentStreak: 0, streakFreezes: 0 } });
  }
  if (stats.coins < item.cost) throw new Error(`Koin tidak cukup (butuh ${item.cost}).`);

  const defaultMessage = `Berhasil membeli ${item.name}!`;
  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.userEngagementStat.update({ where: { email }, data: { coins: { decrement: item.cost } } });

    switch (item.effectType) {
      case "streak_freeze": {
        await tx.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
        return defaultMessage;
      }
      case "streak_repair": {
        const s = await tx.userEngagementStat.findUnique({ where: { email } });
        if (!s) return defaultMessage;
        const repair = decideStreakRepair({
          lastActiveDate: s.lastActiveDate, currentStreak: s.currentStreak, previousStreak: s.previousStreak, now,
        });
        if (repair.action === "restore") {
          await tx.userEngagementStat.update({
            where: { email },
            data: { currentStreak: repair.currentStreak, lastActiveDate: repair.lastActiveDate },
          });
        }
        return repair.message;
      }
      case "double_xp": {
        await tx.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(now.getTime() + 24 * 3600000) } });
        return defaultMessage;
      }
      case "exam_retake": {
        await tx.userEngagementStat.update({ where: { email }, data: { examRetakeTickets: { increment: 1 } } });
        return defaultMessage;
      }
      case "weekend_amulet": {
        await tx.userEngagementStat.update({ where: { email }, data: { hasWeekendAmulet: true } });
        return defaultMessage;
      }
      case "mystery_box": {
        const roll = Math.floor(Math.random() * 100) + 1;
        const outcome = decideShopMysteryRoll(roll);
        if (outcome.kind === "zonk") await tx.userEngagementStat.update({ where: { email }, data: { coins: { increment: outcome.coins } } });
        else if (outcome.kind === "double_xp") await tx.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(now.getTime() + 3600000) } });
        else if (outcome.kind === "streak_freeze") await tx.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
        else await tx.userEngagementStat.update({ where: { email }, data: { coins: { increment: outcome.coins } } });
        return outcome.message;
      }
      default: {
        if (item.effectType.startsWith("profile_frame_")) {
          const frameValue = item.effectType.replace("profile_frame_", ""); // gold/diamond/mythic
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: frameValue } });
          if (dup) throw new Error("Anda sudah memiliki bingkai ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: frameValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeFrame: frameValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("title_")) {
          const titleValue = item.effectType.replace("title_", "");
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: titleValue } });
          if (dup) throw new Error("Anda sudah memiliki gelar ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: titleValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeTitle: titleValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("name_color_")) {
          const colorValue = item.effectType.replace("name_color_", "");
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: colorValue } });
          if (dup) throw new Error("Anda sudah memiliki warna ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: colorValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeNameColor: colorValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("egg_")) {
          const petType = item.effectType.replace("egg_", "");
          const dup = await tx.userPet.findFirst({ where: { email, petType } });
          if (dup) throw new Error("Anda sudah memiliki jenis peliharaan ini!");
          const activeCount = await tx.userPet.count({ where: { email, isActive: true } });
          await tx.userPet.create({ data: { email, petType, stage: 1, exp: 0, isActive: activeCount === 0 } });
          await tx.socialFeed.create({ data: { email, activityType: "pet_hatched", content: `Baru saja menetaskan ${item.name}!` } }).catch(() => {});
          return defaultMessage;
        }
        return defaultMessage;
      }
    }
  });
}

export async function refillHearts(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("Data user tidak ditemukan.");
  if (stats.hearts >= 5) throw new Error("Nyawa sudah penuh!");
  const missing = 5 - stats.hearts;
  const cost = missing * 60;
  if (stats.coins < cost) throw new Error(`Koin tidak cukup! Butuh ${cost} Koin.`);
  await db.userEngagementStat.update({
    where: { email },
    data: { coins: { decrement: cost }, hearts: 5, lastHeartRefill: null },
  });
  return { hearts: 5 };
}
```

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — 123 pass (115 + 8).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/shop.ts lib/shop.test.ts
git commit -m "feat: shop buy flow, mystery box, streak repair, hearts refill (TDD)"
```

---

### Task 4: lib/mission.ts — claim tier (TDD) + action

**Files:**
- Modify: `lib/mission.ts`, `lib/actions/mission.ts`
- Create: `lib/mission.test.ts`

**Interfaces:**
- Consumes: `db`, `decideMysteryRoll` (mission variant — define di mission.ts)
- Produces:
  ```ts
  // lib/mission.ts
  export interface TierDecision { ok: boolean; rewardCoins?: number; error?: string; message?: string; bonus?: "streak_freeze" | "double_xp"; }
  export function decideTierRequirement(row: {
    quizzesCompleted: number; correctAnswersToday: number; pvpWinsToday: number;
    tier1Claimed: boolean; tier2Claimed: boolean; tier3Claimed: boolean;
  }, tier: number): TierDecision
  export function decideMissionMysteryRoll(roll: number): "streak_freeze" | "double_xp"
  // <=50 freeze; else double_xp
  export async function claimMissionReward(email: string, tier: number): Promise<string>
  // row tak ada → throw "Misi belum dimulai"; decideTierRequirement; set tierX_claimed; coins += reward; tier 3 → roll bonus
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/mission.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { decideMissionMysteryRoll, decideTierRequirement } from "./mission";

const base = { quizzesCompleted: 0, correctAnswersToday: 0, pvpWinsToday: 0, tier1Claimed: false, tier2Claimed: false, tier3Claimed: false };

describe("decideTierRequirement", () => {
  it("tier 1 belum kuis → error", () => {
    const r = decideTierRequirement(base, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Selesaikan 1 Kuis terlebih dahulu!");
  });
  it("tier 1 siap → 20 koin", () => {
    const r = decideTierRequirement({ ...base, quizzesCompleted: 1 }, 1);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(20);
  });
  it("tier 1 sudah diklaim → error", () => {
    const r = decideTierRequirement({ ...base, quizzesCompleted: 5, tier1Claimed: true }, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Peti Kayu sudah diklaim!");
  });
  it("tier 2 butuh 50 benar", () => {
    expect(decideTierRequirement({ ...base, correctAnswersToday: 49 }, 2).ok).toBe(false);
    const r = decideTierRequirement({ ...base, correctAnswersToday: 50 }, 2);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(50);
  });
  it("tier 3 butuh 3 pvp", () => {
    expect(decideTierRequirement({ ...base, pvpWinsToday: 2 }, 3).ok).toBe(false);
    const r = decideTierRequirement({ ...base, pvpWinsToday: 3 }, 3);
    expect(r.ok).toBe(true);
    expect(r.rewardCoins).toBe(100);
  });
  it("tier tidak valid", () => {
    const r = decideTierRequirement(base, 9);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Tier tidak valid");
  });
});

describe("decideMissionMysteryRoll", () => {
  it("<=50 freeze", () => {
    expect(decideMissionMysteryRoll(50)).toBe("streak_freeze");
  });
  it(">50 double xp", () => {
    expect(decideMissionMysteryRoll(51)).toBe("double_xp");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/mission.test.ts` — FAIL.

- [ ] **Step 3: Implementasi**

Append ke `lib/mission.ts`:
```ts
export interface TierDecision {
  ok: boolean;
  rewardCoins?: number;
  error?: string;
  message?: string;
  bonus?: "streak_freeze" | "double_xp";
}

export function decideTierRequirement(
  row: {
    quizzesCompleted: number;
    correctAnswersToday: number;
    pvpWinsToday: number;
    tier1Claimed: boolean;
    tier2Claimed: boolean;
    tier3Claimed: boolean;
  },
  tier: number
): TierDecision {
  if (tier === 1) {
    if (row.quizzesCompleted < 1) return { ok: false, error: "Selesaikan 1 Kuis terlebih dahulu!" };
    if (row.tier1Claimed) return { ok: false, error: "Peti Kayu sudah diklaim!" };
    return { ok: true, rewardCoins: 20, message: "Berhasil membuka Peti Kayu! Dapat 20 koin." };
  }
  if (tier === 2) {
    if (row.correctAnswersToday < 50) return { ok: false, error: "Jawab 50 pertanyaan dengan benar terlebih dahulu!" };
    if (row.tier2Claimed) return { ok: false, error: "Peti Perak sudah diklaim!" };
    return { ok: true, rewardCoins: 50, message: "Berhasil membuka Peti Perak! Dapat 50 koin." };
  }
  if (tier === 3) {
    if (row.pvpWinsToday < 3) return { ok: false, error: "Menangkan 3 PvP Battle terlebih dahulu!" };
    if (row.tier3Claimed) return { ok: false, error: "Peti Emas sudah diklaim!" };
    return { ok: true, rewardCoins: 100, message: "Berhasil membuka Peti Emas! Dapat 100 koin + Hadiah Misteri!", bonus: "double_xp" };
  }
  return { ok: false, error: "Tier tidak valid" };
}

export function decideMissionMysteryRoll(roll: number): "streak_freeze" | "double_xp" {
  return roll <= 50 ? "streak_freeze" : "double_xp";
}

export async function claimMissionReward(email: string, tier: number): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const row = await db.userDailyMission.findUnique({ where: { email_date: { email, date: today } } });
  if (!row) throw new Error("Misi belum dimulai");

  const decision = decideTierRequirement(
    {
      quizzesCompleted: row.quizzesCompleted ?? 0,
      correctAnswersToday: row.correctAnswersToday ?? 0,
      pvpWinsToday: row.pvpWinsToday ?? 0,
      tier1Claimed: row.tier1Claimed ?? false,
      tier2Claimed: row.tier2Claimed ?? false,
      tier3Claimed: row.tier3Claimed ?? false,
    },
    tier
  );
  if (!decision.ok) throw new Error(decision.error ?? "Tier tidak valid");

  const claimedField = tier === 1 ? "tier1Claimed" : tier === 2 ? "tier2Claimed" : "tier3Claimed";
  await db.userDailyMission.update({
    where: { email_date: { email, date: today } },
    data: { [claimedField]: true },
  });
  await db.userEngagementStat.update({ where: { email }, data: { coins: { increment: decision.rewardCoins ?? 0 } } });

  let message = decision.message ?? "Berhasil!";
  if (decision.bonus && tier === 3) {
    const roll = Math.floor(Math.random() * 100) + 1;
    const bonus = decideMissionMysteryRoll(roll);
    if (bonus === "streak_freeze") {
      await db.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
      message = `${message} Bonus: 1 Streak Freeze!`;
    } else {
      await db.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(Date.now() + 3600000) } });
      message = `${message} Bonus: Double XP 1 Jam!`;
    }
  }
  return message;
}
```

- [ ] **Step 4: Action `claimMissionRewardAction`**

Edit `lib/actions/mission.ts` — tambah:
```ts
import { claimMissionReward } from "../mission";

export async function claimMissionRewardAction(tier: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    const message = await claimMissionReward(session.email, tier);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal klaim misi." };
  }
}
```

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — 131 pass (123 + 8).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/mission.ts lib/mission.test.ts lib/actions/mission.ts
git commit -m "feat: mission tier claim with mystery bonus (TDD)"
```

---

### Task 5: lib/actions/shop.ts + lib/actions/profile.ts

**Files:**
- Create: `lib/actions/shop.ts`, `lib/actions/profile.ts`
- Modify: `lib/types.ts` (tambah PublicProfile — atau inline)

**Interfaces:**
- Consumes: `getSession`, `getUserProfile`, `getShopItems`/`buyItem`/`refillHearts` (Task 3), `getUserBadges` (Task 2), `db`
- Produces:
  ```ts
  // lib/actions/shop.ts
  export async function getShopAction(): Promise<{ items: (ShopItem & { is_owned: boolean })[]; coins: number } | { error: string }>
  export async function buyItemAction(itemId: number): Promise<ActionResult>  // { message } sukses
  export async function refillHeartsAction(): Promise<{ hearts: number } | { error: string }>

  // lib/actions/profile.ts
  export async function getPublicProfileAction(email: string): Promise<PublicProfile | { error: string }>
  export async function equipFrameAction(value: string): Promise<ActionResult>
  export async function equipTitleAction(value: string): Promise<ActionResult>
  export async function equipColorAction(value: string): Promise<ActionResult>
  // PublicProfile: { email, full_name, score, current_streak, longest_streak, active_frame, active_title, active_name_color, joined_date: "Member", badges: BadgeItem[] }
  ```

- [ ] **Step 1: Implementasi `lib/actions/shop.ts`**

```ts
"use server";

import { getSession } from "../auth";
import { buyItem, getShopItems, refillHearts } from "../shop";
import { getEngagementStats } from "../dashboard";
import type { ActionResult } from "./types";
import type { ShopItem } from "../types";

export async function getShopAction(): Promise<{ items: (ShopItem & { is_owned: boolean })[]; coins: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const [items, stats] = await Promise.all([getShopItems(session.email), getEngagementStats(session.email)]);
  return { items, coins: stats?.coins ?? 0 };
}

export async function buyItemAction(itemId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    const message = await buyItem(session.email, itemId);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal membeli item." };
  }
}

export async function refillHeartsAction(): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    return await refillHearts(session.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal isi ulang nyawa." };
  }
}
```

- [ ] **Step 2: Implementasi `lib/actions/profile.ts`**

Tambah tipe ke `lib/types.ts`:
```ts
export interface PublicProfile {
  email: string;
  full_name: string;
  score: number;
  current_streak: number;
  longest_streak: number;
  active_frame: string | null;
  active_title: string | null;
  active_name_color: string | null;
  joined_date: string;
  badges: BadgeItem[];
}
```

```ts
"use server";

import { getSession } from "../auth";
import { getUserBadges } from "../badges";
import { db } from "../db";
import type { ActionResult } from "./types";
import type { PublicProfile } from "../types";

export async function getPublicProfileAction(email: string): Promise<PublicProfile | { error: string }> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "Pengguna tidak ditemukan" };

  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  const badges = await getUserBadges(email);

  return {
    email: user.email,
    full_name: user.fullName ?? "",
    score: user.score ?? 0,
    current_streak: stats?.currentStreak ?? 0,
    longest_streak: stats?.longestStreak ?? 0,
    active_frame: stats?.activeFrame ?? null,
    active_title: stats?.activeTitle ?? null,
    active_name_color: stats?.activeNameColor ?? null,
    joined_date: "Member",
    badges,
  };
}

async function equip(
  field: "activeFrame" | "activeTitle" | "activeNameColor",
  value: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await db.userEngagementStat.update({
    where: { email: session.email },
    data: { [field]: value === "" ? null : value },
  });
  return { message: "ok" };
}

export async function equipFrameAction(value: string): Promise<ActionResult> {
  return equip("activeFrame", value);
}
export async function equipTitleAction(value: string): Promise<ActionResult> {
  return equip("activeTitle", value);
}
export async function equipColorAction(value: string): Promise<ActionResult> {
  return equip("activeNameColor", value);
}
```

Catatan: `getPublicProfileAction` dipakai untuk profil orang lain JUGA (route /profile/:email) — profil publik, session tidak wajib untuk membaca (tapi navbar hanya tampil saat login; biarkan tanpa session guard untuk read, sesuaikan: tidak perlu getSession di getPublicProfileAction).

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 131 pass; `npm run lint` — 0 error.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/actions/shop.ts lib/actions/profile.ts
git commit -m "feat: shop and profile server actions"
```

---

### Task 6: Halaman Shop

**Files:**
- Create: `app/(app)/shop/page.tsx`, `components/ShopView.tsx`

**Interfaces:**
- Consumes: `getShopAction`/`buyItemAction` (Task 5)
- Produces: halaman `/shop`

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ShopView from "@/components/ShopView";

export default async function ShopPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ShopView />;
}
```

- [ ] **Step 2: `components/ShopView.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { buyItemAction, getShopAction } from "@/lib/actions/shop";
import type { ShopItem } from "@/lib/types";

type ItemWithOwned = ShopItem & { is_owned: boolean };

const COSMETIC_PREFIXES = ["profile_frame_", "title_", "name_color_"];

export default function ShopView() {
  const [items, setItems] = useState<ItemWithOwned[] | null>(null);
  const [coins, setCoins] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getShopAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setItems(res.items);
        setCoins(res.coins);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat toko.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function buy(item: ItemWithOwned) {
    if (item.is_owned || buyingId !== null) return;
    setBuyingId(item.id);
    setStatus(null);
    const res = await buyItemAction(item.id).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal membeli item." }));
    setBuyingId(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setStatus(`✨ ${res.message}`);
    setReloadKey((k) => k + 1);
  }

  if (error && !items) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Toko</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const isCosmetic = (eff: string) => COSMETIC_PREFIXES.some((p) => eff.startsWith(p));
  const utilities = items.filter((i) => !isCosmetic(i.effect_type));
  const cosmetics = items.filter((i) => isCosmetic(i.effect_type));

  const renderCard = (item: ItemWithOwned) => {
    const canAfford = coins >= item.cost;
    const busy = buyingId === item.id;
    return (
      <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">{item.icon_name}</div>
          <div>
            <p className="font-bold text-sm">{item.name}</p>
            <p className="text-xs text-slate-400">🪙 {item.cost}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 flex-1">{item.description}</p>
        {item.is_owned ? (
          <button type="button" disabled className="w-full px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold cursor-not-allowed">
            Dimiliki
          </button>
        ) : canAfford ? (
          <button type="button" onClick={() => buy(item)} disabled={busy} className="w-full px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold disabled:opacity-60">
            {busy ? "Memproses..." : "Beli"}
          </button>
        ) : (
          <button type="button" disabled className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
            Koin Kurang
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-6 text-white mb-6 shadow-md">
        <h1 className="text-2xl font-extrabold">Toko LingoMind 🏪</h1>
        <p className="text-sm mt-1 font-bold">Saldo Koin: 🪙 {coins}</p>
      </div>

      {status && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm font-semibold">
          {error}
        </div>
      )}

      <h2 className="text-lg font-extrabold mb-3">🚑 Utilitas & Penyelamat Nyawa</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {utilities.map(renderCard)}
      </div>

      <h2 className="text-lg font-extrabold mb-3">🏆 Status & Gengsi (Kosmetik)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cosmetics.map(renderCard)}
      </div>
    </div>
  );
}
```

Catatan: `line-clamp-2` — Tailwind v4 mendukung line-clamp bawaan (plugin di-core). Bila tidak, hapus class. `error` banner tidak auto-clear saat buy sukses — setError(null) di awal buy().

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (131 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/shop/page.tsx" components/ShopView.tsx
git commit -m "feat: shop page with buy flow and coin balance"
```

---

### Task 7: Halaman Profile

**Files:**
- Create: `app/(app)/profile/[email]/page.tsx`, `components/ProfileView.tsx`

**Interfaces:**
- Consumes: `getPublicProfileAction`/`equipFrameAction`/`equipTitleAction`/`equipColorAction` (Task 5), `getSession`
- Produces: halaman `/profile/:email` (publik + galeri kosmetik sendiri)

- [ ] **Step 1: Wrapper halaman**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  return <ProfileView email={decodeURIComponent(email)} />;
}
```

- [ ] **Step 2: `components/ProfileView.tsx` (client)**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { equipColorAction, equipFrameAction, equipTitleAction, getPublicProfileAction } from "@/lib/actions/profile";
import type { PublicProfile } from "@/lib/types";

const FRAME_CLASS: Record<string, string> = {
  mythic: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white border-4 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.7)] animate-pulse",
  diamond: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-cyan-100 text-cyan-800 border-4 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]",
  gold: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-yellow-500 text-slate-900 border-4 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]",
};

const FRAME_BADGE: Record<string, string> = {
  mythic: "MYTHIC",
  diamond: "DIAMOND",
  gold: "VIP",
};

const NAME_COLOR_CLASS: Record<string, string> = {
  gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] font-black",
  crimson: "text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] font-black",
  neon_blue: "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] font-black",
};

const TITLE_BADGE: Record<string, { label: string; className: string }> = {
  polyglot: { label: "🎓 Polyglot", className: "px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold" },
  sultan: { label: "👑 Sultan", className: "px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[11px] font-bold" },
  legend: { label: "🌟 Legend", className: "px-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-bold" },
};

export default function ProfileView({ email }: { email: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionRes = await fetch("/api/session-check").catch(() => null);
      // NOTE: tanpa API session-check, pakai pendekatan berbeda — lihat Catatan di bawah
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // CATATAN: halaman ini butuh penanda "profil sendiri". Pendekatan bersih: server component
  // meneruskan prop isOwn (session.email === params.email) — implementasi di bawah mengganti
  // useEffect ini; lakukan: wrapper mengirim isOwn ke ProfileView.
}
```

CATATAN PENTING (controller): pendekatan di atas jelek. GANTI: wrapper server component menghitung `isOwn = session.email === decodedEmail` dan meneruskannya sebagai prop:

```tsx
// app/(app)/profile/[email]/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const target = decodeURIComponent(email);
  return <ProfileView email={target} isOwn={session.email.toLowerCase() === target.toLowerCase()} />;
}
```

```tsx
// components/ProfileView.tsx (versi final)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { equipColorAction, equipFrameAction, equipTitleAction, getPublicProfileAction } from "@/lib/actions/profile";
import type { PublicProfile } from "@/lib/types";

// ... FRAME_CLASS/FRAME_BADGE/NAME_COLOR_CLASS/TITLE_BADGE (sama seperti di atas) ...

export default function ProfileView({ email, isOwn }: { email: string; isOwn: boolean }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProfileAction(email)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setProfile(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat profil.");
      });
    return () => {
      cancelled = true;
    };
  }, [email, reloadKey]);

  async function equip(action: (v: string) => Promise<{ error?: string; message?: string }>, value: string) {
    setStatus(null);
    const res = await action(value).catch(() => ({ error: "Gagal menyimpan." }));
    if (res.error) {
      setError(res.error);
      return;
    }
    setStatus("Kosmetik diperbarui!");
    setReloadKey((k) => k + 1);
  }

  if (error && !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Profil Tidak Ditemukan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const frameClass = FRAME_CLASS[profile.active_frame ?? ""] ?? "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-indigo-600 text-white";
  const nameColor = NAME_COLOR_CLASS[profile.active_name_color ?? ""] ?? "text-slate-700 dark:text-slate-300";
  const title = profile.active_title ? TITLE_BADGE[profile.active_title] : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {status && <div className="mb-4 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">{status}</div>}
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="flex flex-col items-center">
          <div className={frameClass}>
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          {FRAME_BADGE[profile.active_frame ?? ""] && (
            <span className="mt-2 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black tracking-wider">
              {FRAME_BADGE[profile.active_frame ?? ""]}
            </span>
          )}
          <h1 className={`text-2xl font-extrabold mt-3 ${nameColor}`}>{profile.full_name}</h1>
          {title && <span className={`mt-1 ${title.className}`}>{title.label}</span>}
          <p className="text-xs text-slate-400 mt-1">{profile.email}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl bg-indigo-500/10 p-3">
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{profile.score}</p>
            <p className="text-[11px] font-bold text-slate-400">Total Skor</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 p-3">
            <p className="text-xl font-black text-orange-500">🔥 {profile.current_streak}</p>
            <p className="text-[11px] font-bold text-slate-400">Streak</p>
          </div>
          <div className="rounded-xl bg-yellow-500/10 p-3">
            <p className="text-xl font-black text-yellow-500">👑 {profile.longest_streak}</p>
            <p className="text-[11px] font-bold text-slate-400">Max Streak</p>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold mb-3">🏅 Lencana yang Diraih</h2>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-slate-400">Pengguna ini belum mengumpulkan lencana apapun.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.badges.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <span className="text-2xl">{b.icon_name}</span>
                <div>
                  <p className="font-bold text-sm">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwn && (
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
        >
          🎨 Ganti Kosmetik
        </button>
      )}

      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setGalleryOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">Galeri Kosmetik</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🖼️ Bingkai</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => equip(equipFrameAction, "")} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold">
                {profile.active_frame === null ? "Dipakai" : "Pakai"} — Bawaan (Default)
              </button>
              {["gold", "diamond", "mythic"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => equip(equipFrameAction, f)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_frame === f ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400" : "border-slate-300"}`}
                >
                  {profile.active_frame === f ? "Dipakai" : "Pakai"} — {f === "gold" ? "VIP Gold" : f === "diamond" ? "Diamond 💎" : "Mythic 🌌"}
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🏅 Gelar</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button type="button" onClick={() => equip(equipTitleAction, "")} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold">
                {profile.active_title === null ? "Dipakai" : "Pakai"} — Tanpa Gelar
              </button>
              {Object.entries(TITLE_BADGE).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => equip(equipTitleAction, key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_title === key ? "border-teal-500 bg-teal-500/10" : "border-slate-300"}`}
                >
                  {profile.active_title === key ? "Dipakai" : "Pakai"} — {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">✨ Warna Nama</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => equip(equipColorAction, "")} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold">
                {profile.active_name_color === null ? "Dipakai" : "Pakai"} — Bawaan
              </button>
              {Object.entries(NAME_COLOR_CLASS).map(([key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => equip(equipColorAction, key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_name_color === key ? "border-teal-500 bg-teal-500/10" : "border-slate-300"}`}
                >
                  {profile.active_name_color === key ? "Dipakai" : "Pakai"} — {key === "gold" ? "✨ Gold" : key === "crimson" ? "🔥 Crimson" : "⚡ Neon Blue"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setGalleryOpen(false)} className="mt-6 w-full text-xs text-slate-400 hover:text-slate-600">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (131 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profile/[email]/page.tsx" components/ProfileView.tsx
git commit -m "feat: profile page with cosmetics gallery"
```

---

### Task 8: Halaman Guide + Navbar (Toko, Panduan, avatar profil)

**Files:**
- Create: `app/(app)/guide/page.tsx`
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: `app/(app)/guide/page.tsx` (server, statis)**

```tsx
const CARDS = [
  { icon: "🗺️", title: "Pembelajaran Adaptif", desc: "Materi dan soal disesuaikan dengan level CEFR Anda secara otomatis." },
  { icon: "🎙️", title: "Voice Chat & Speech Scoring", desc: "Praktik berbicara langsung dengan AI dan latih akurasi pronunciation." },
  { icon: "📈", title: "Analisis Kelemahan Cerdas", desc: "AI memetakan topik yang sering Anda salah untuk latihan fokus." },
  { icon: "🃏", title: "Flashcard & Algoritma SM-2", desc: "Ulangi kartu dengan jadwal cerdas untuk hafalan jangka panjang." },
  { icon: "🏅", title: "Gamifikasi: Koin & Badges", desc: "Dapatkan koin setiap kali menyelesaikan kuis! Tukarkan koin di Toko untuk membeli Streak Freeze ❄️. Buka juga berbagai pencapaian (Badge) unik seiring berkembangnya kemampuan Anda." },
  { icon: "⚔️", title: "Mode Sosial & Beranda Feed", desc: "Tantang teman dan ikuti aktivitas belajar mereka." },
  { icon: "❤️", title: "Sistem Nyawa (Hearts)", desc: "Setiap jawaban salah mengurangi nyawa. Nyawa pulih otomatis tiap 4 jam." },
  { icon: "🐾", title: "Peliharaan Virtual (Pets)", desc: "Beli telur di Toko, rawat, dan saksikan peliharaan Anda tumbuh." },
  { icon: "📱", title: "PWA & Mode Offline", desc: "Akses aplikasi dari perangkat apa pun kapan saja." },
];

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-center">Panduan Lengkap LingoMind 🚀</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <div key={c.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <p className="text-2xl">{c.icon}</p>
            <p className="font-extrabold mt-2">{c.title}</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400 mt-8">
        Teruslah berlatih, pertahankan Streak Anda, dan jadilah Master Bahasa! 🔥
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Navbar — Toko, Panduan, avatar profil**

Edit `components/Navbar.tsx`:
1. Tambah di grup navigasi (sebelum badge skor): `<Link href="/shop" className={tabClass(pathname === "/shop")}>Toko</Link>` dan `<Link href="/guide" className={tabClass(pathname === "/guide")}>Panduan</Link>`
2. Tambah avatar profil setelah ThemeToggle:
```tsx
<Link
  href={`/profile/${encodeURIComponent(email)}`}
  className="w-8 h-8 rounded-full bg-teal-500 text-white text-xs font-black flex items-center justify-center hover:opacity-90 transition-opacity"
  title={full_name}
>
  {full_name.charAt(0).toUpperCase()}
</Link>
```
Props Navbar sudah punya `full_name` dan `email` (sebelumnya unused — sekarang dipakai). Pastikan destructure diubah: `export default function Navbar({ full_name, score, email }: NavbarProps)`.

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (131 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/guide/page.tsx" components/Navbar.tsx
git commit -m "feat: guide page and navbar shop/guide/profile links"
```

---

### Task 9: Dashboard — badges + misi peti + modal refill nyawa

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`, `components/HeartsRefillModal.tsx` (baru)
- Modify: `lib/dashboard.ts` (bila perlu — getDailyMission sudah return tier fields)

**Interfaces:**
- Consumes: `getUserBadges` (Task 2 — dipanggil server component), `getDailyMission` (sudah ada, return tier1_claimed dll), `getEngagementStats` (sudah ada), `claimMissionRewardAction` (Task 4), `refillHeartsAction` (Task 5)
- Produces: dashboard dengan 3 section baru

- [ ] **Step 1: `components/HeartsRefillModal.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { refillHeartsAction } from "@/lib/actions/shop";

export default function HeartsRefillModal({ hearts, coins }: { hearts: number; coins: number }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missing = Math.max(0, 5 - hearts);
  const cost = missing * 60;

  async function refill() {
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await refillHeartsAction().catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal isi ulang nyawa." }));
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setMessage(`Nyawa terisi penuh! ❤️ x${res.hearts}`);
    window.setTimeout(() => window.location.reload(), 800);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full px-3 py-2 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-xs font-bold hover:bg-teal-500/10 transition-colors"
      >
        Isi Ulang Nyawa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">Isi Ulang Nyawa</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Nyawa saat ini: ❤️ {hearts}/5
            </p>
            {missing === 0 ? (
              <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mb-4">Nyawa sudah penuh!</p>
            ) : (
              <p className="text-sm mb-4">
                Isi {missing} nyawa seharga <span className="font-bold">🪙 {cost} Koin</span> (60/nyawa).
                <span className="block text-xs text-slate-400 mt-1">Saldo: 🪙 {coins}</span>
              </p>
            )}
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            {message && <p className="text-xs text-teal-600 dark:text-teal-400 mb-3">{message}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || missing === 0}
                onClick={refill}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
              >
                {pending ? "Memproses..." : "Isi Ulang Sekarang"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Dashboard — data + render**

Edit `app/(app)/dashboard/page.tsx`:
1. Import tambahan: `getUserBadges` dari `@/lib/badges`, `HeartsRefillModal` dari `@/components/HeartsRefillModal`
2. Data: di Promise.all kedua tambah `getUserBadges(session.email)` → `const badges = ...`
3. Kartu hearts (di grid statistik): tambahkan `<HeartsRefillModal hearts={stats?.hearts ?? 5} coins={stats?.coins ?? 0} />` di bawah teks "1 per 4 jam" (ganti `<p>` teks jadi wrapper div + modal)
4. Setelah grid "Misi Harian" (atau sebelum), tambah section misi peti:

```tsx
<section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
  <h2 className="text-lg font-extrabold mb-3">📜 Quest Harian Bertingkat</h2>
  <div className="grid sm:grid-cols-3 gap-3">
    <ChestCard
      icon="🪵" title="Peti Kayu" desc="Selesaikan 1 Kuis Apapun."
      progress={`${mission.quizzes_completed}/1 Selesai`}
      locked={mission.quizzes_completed < 1}
      claimed={mission.tier1_claimed}
      buttonLabel="Klaim 20 Koin!"
      tier={1}
    />
    <ChestCard
      icon="🥈" title="Peti Perak" desc="Jawab 50 pertanyaan dengan benar hari ini."
      progress={`${mission.correct_answers_today}/50 Benar`}
      locked={mission.correct_answers_today < 50}
      claimed={mission.tier2_claimed}
      buttonLabel="Klaim 50 Koin!"
      tier={2}
    />
    <ChestCard
      icon="🥇" title="Peti Emas" desc="Menangkan 3 PvP Battle hari ini."
      progress={`${mission.pvp_wins_today}/3 Menang`}
      locked={mission.pvp_wins_today < 3}
      claimed={mission.tier3_claimed}
      buttonLabel="Klaim 100 Koin + Bonus!"
      tier={3}
      highlight
    />
  </div>
</section>
```

5. Buat komponen client `components/ChestCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { claimMissionRewardAction } from "@/lib/actions/mission";

export default function ChestCard({
  icon, title, desc, progress, locked, claimed, buttonLabel, tier, highlight,
}: {
  icon: string; title: string; desc: string; progress: string; locked: boolean;
  claimed: boolean; buttonLabel: string; tier: number; highlight?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await claimMissionRewardAction(tier).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal klaim." }));
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setMessage(res.message ?? "Berhasil!");
    window.setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-yellow-500/50 bg-yellow-500/5" : "border-slate-200 dark:border-slate-700"}`}>
      <p className="text-2xl">{icon}</p>
      <p className="font-extrabold mt-1">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      <p className="text-[11px] font-bold text-slate-400 mt-2">{progress}</p>
      {message && <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 mt-2">{message}</p>}
      {error && <p className="text-[11px] font-bold text-rose-500 mt-2">{error}</p>}
      {claimed ? (
        <button type="button" disabled className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
          Diklaim
        </button>
      ) : locked ? (
        <button type="button" disabled className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
          Terkunci
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={claim}
          className={`mt-3 w-full px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 ${highlight ? "bg-gradient-to-r from-yellow-500 to-amber-500 animate-pulse" : "bg-amber-500 hover:bg-amber-600"}`}
        >
          {pending ? "Memproses..." : buttonLabel}
        </button>
      )}
    </div>
  );
}
```

6. Section badges (setelah section peti atau di kolom kedua grid misi):

```tsx
{badges.length > 0 && (
  <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
    <h2 className="text-lg font-extrabold mb-3">🏅 Badges / Lencana</h2>
    <div className="space-y-2">
      {badges.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <span className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center">{b.icon_name}</span>
          <div>
            <p className="font-bold text-sm">{b.name}</p>
            <p className="text-xs text-slate-400">{b.description}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (131 pass).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/dashboard/page.tsx" components/HeartsRefillModal.tsx components/ChestCard.tsx
git commit -m "feat: dashboard gamification (badges, mission chests, hearts refill)"
```

---

### Task 10: AGENTS.md + verifikasi final

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

- Routes: `/shop`, `/profile/:email`, `/guide`
- lib: `shop.ts`, `badges.ts` (+ mission claim), `actions/shop.ts|profile.ts`
- Konvensi: badge hook di `updateEngagementAfterQuiz`; seed badges+shop_items via `prisma db seed`; dua format error koin berbeda (shop vs hearts)
- Status: Fase 4a selesai (ekonomi & status); tersisa 4b (leaderboard/battle/social/analisis/pets), 5 (admin), 6 (cron + deploy + cutover)

- [ ] **Step 2: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
npx tsx --env-file=.env -e "import { db } from './lib/db'; Promise.all([db.badge.count(), db.shopItem.count()]).then(([b, s]) => { console.log('badges:', b, '| shop:', s); process.exit(0); })"
```
Expected: lint 0 error; tsc bersih; 131 test pass; build sukses; migrate "up to date"; `badges: 3 | shop: 18`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for phase 4a (economy and status)"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Seed badges + shop | db:check badges 3, shop 18 |
| 2. Badge system + hook | 115 test (4 baru) |
| 3. Shop lib (pure + DB) | 123 test (8 baru) |
| 4. Misi claim | 131 test (8 baru) |
| 5. Actions shop/profile | tsc/lint/test |
| 6. Halaman shop | lint/tsc/test |
| 7. Halaman profile | lint/tsc/test |
| 8. Guide + navbar | lint/tsc/test |
| 9. Dashboard gamifikasi | lint/tsc/test |
| 10. AGENTS + final | lint/tsc/test/build/migrate/db:check |

## Catatan risiko

- **Prisma upsert where**: `db.shopItem.upsert` butuh field unik — cek schema ShopItem (mungkin TIDAK ada @unique di name); fallback findFirst+create. Badge.name unik ✓.
- **Relasi UserBadge.badge**: cek schema — bila tidak ada relasi, map manual via badgeId.
- **ProfileView isOwn**: wrapper server component menghitung (session.email vs params.email) — JANGAN pakai fetch API client.
- **Hook badge**: `.catch(() => {})` — jangan pernah menggagalkan updateEngagementAfterQuiz.
- **line-clamp-2** di ShopView: hapus bila Tailwind v4 tidak punya.
- **Claim peti reload**: `window.location.reload()` setelah klaim (setia legacy) — transisi kasar tapi konsisten.
