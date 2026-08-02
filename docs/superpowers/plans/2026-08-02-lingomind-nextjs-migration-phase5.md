# LingoMind Fase 5 — Admin Panels — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memport panel admin LingoMind ke Next.js: route group `app/(admin)` dengan sidebar sendiri, admin login, dan 5 panel (Konfigurasi, Toko, Bahasa, Kurikulum, Pengguna) dengan guard role berbasis session di semua server action.

**Architecture:** Guard terpusat `requireAdmin()` (getSession + role check, string `"Akses ditolak."`) dipakai layout + semua action admin. Backend `lib/admin.ts` berisi 17 fungsi query/transaksi (port persis `dioxus/src/services/admin.rs`); `lib/actions/admin.ts` = server actions tipis. UI: `AdminShell` (sidebar w-64 + topbar) + panel per tab (CRUD modal, tanpa delete — parity legacy). Semua tabel sudah ada — TANPA migration.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (Neon), vitest, Tailwind v4.

**Referensi kode lama (sumber kebenaran):**
- `dioxus/src/services/admin.rs` (21 fns), `dioxus/src/views/admin/{login,dashboard,config_panel,shop_panel,language_panel,curriculum_panel,user_panel}.rs`
- `dioxus/src/models/admin.rs`

## Global Constraints

- **UI & pesan error bahasa Indonesia**, string persis legacy (dikutip tiap task): guard `"Akses ditolak."`, login `"Akses ditolak. Anda bukan admin."`, dll.
- **Prisma**: `db.user` (fullName, isVerified, role, score), `db.userEngagementStat` (coins, currentStreak, longestStreak), `db.shopItem` (effectType, iconName), `db.language` (nativeName, themeClass, buttonClass, ttsLangCode, edgeTtsVoice), `db.level` (baseRewardPoints, orderIndex), `db.topic` (levelId, title, orderIndex), `db.appConfig` (key, value, description), `db.missionConfig` (lessonTarget, quizTarget, weaknessTarget, flashcardTargetMin, flashcardTargetMax).
- **Setiap server action admin memanggil `requireAdmin()`** — tidak pernah menerima email dari client.
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`**; fire-and-forget dari client selalu `.catch(() => {})`.
- **Tanpa perubahan skema/migration**; `npx prisma migrate status` tetap up to date.
- Komponen client hanya import actions + types (bukan db).
- `reset_user_progress_admin`: transaksi deleteMany 13 tabel + update users (chat_messages TIDAK dihapus — parity legacy).
- Route `/admin/login` dan `/admin/[tab]` — middleware melindungi `/admin/:path*` (selain login) dengan session+role.

---

### Task 1: requireAdmin + isAdminRole (TDD) + middleware /admin

**Files:**
- Create: `lib/admin-guard.ts`, `lib/admin-guard.test.ts` (atau tambah ke lib/auth.ts + test — pilih: buat `lib/auth.ts` tambah `isAdminRole` murni + `requireAdmin` DB; test isAdminRole di lib/auth.test.ts yang sudah ada)
- Modify: `middleware.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/auth.ts (tambah)
  export function isAdminRole(role: string | null | undefined): boolean  // role === "admin"
  export async function requireAdmin(): Promise<{ email: string } | null>
  // getSession() → null → null; cek user di DB (role) → bukan admin → null; else { email }
  ```

- [ ] **Step 1: Tulis tes gagal**

Tambah ke `lib/auth.test.ts`:
```ts
import { isAdminRole } from "./auth";

describe("isAdminRole", () => {
  it("admin → true", () => {
    expect(isAdminRole("admin")).toBe(true);
  });
  it("user → false", () => {
    expect(isAdminRole("user")).toBe(false);
  });
  it("null/undefined → false", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
  it("string lain → false", () => {
    expect(isAdminRole("moderator")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/auth.test.ts` — FAIL (isAdminRole belum ada).

- [ ] **Step 3: Implementasi**

Edit `lib/auth.ts` — tambah:
```ts
import { db } from "./db";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export async function requireAdmin(): Promise<{ email: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { email: session.email } });
  if (!user || !isAdminRole(user.role)) return null;
  return { email: session.email };
}
```

- [ ] **Step 4: Edit `middleware.ts`**

Tambah guard `/admin` (selain `/admin/login`):
```ts
// di dalam middleware():
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
```
Dan matcher: `"/admin/:path*"` ditambahkan ke config matcher.

Catatan: middleware hanya cek ada session (JWT valid) — cek role dilakukan di layout admin (requireAdmin) karena middleware tidak bisa query DB (edge runtime).

- [ ] **Step 5: Run — harus lulus**

Run: `npm test` — semua pass (168 + 4 = 172).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts middleware.ts
git commit -m "feat: admin role guard and middleware protection"
```

---

### Task 2: lib/admin.ts — user fns

**Files:**
- Create: `lib/admin.ts`
- Modify: `lib/types.ts` (tambah AdminUserRow)

**Interfaces:**
- Consumes: `db`
- Produces:
  ```ts
  // lib/types.ts
  export interface AdminUserRow {
    email: string; full_name: string; role: string | null; is_verified: boolean | null;
    score: number; coins: number; streak_days: number;
  }

  // lib/admin.ts
  export async function getUsersAdmin(): Promise<AdminUserRow[]>
  // ORDER BY email; LEFT JOIN stats (coins/current_streak COALESCE 0)
  export async function updateUserStatsAdmin(email: string, coins: number, streak: number): Promise<void>
  // upsert stats: coins, current_streak, longest_streak = GREATEST(longest, new streak)
  export async function resetUserProgressAdmin(email: string): Promise<void>
  // $transaction: deleteMany 13 tabel + update users score 0 preferred_language English
  export async function updateUserRoleAdmin(email: string, newRole: string): Promise<void>
  ```

- [ ] **Step 1: Implementasi**

Tambah `AdminUserRow` ke `lib/types.ts`.

Create `lib/admin.ts`:
```ts
import { db } from "./db";
import type { AdminUserRow } from "./types";

export async function getUsersAdmin(): Promise<AdminUserRow[]> {
  const users = await db.user.findMany({ orderBy: { email: "asc" } });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email,
      full_name: u.fullName ?? "",
      role: u.role,
      is_verified: u.isVerified,
      score: u.score ?? 0,
      coins: stats?.coins ?? 0,
      streak_days: stats?.currentStreak ?? 0,
    };
  });
}

export async function updateUserStatsAdmin(email: string, coins: number, streak: number): Promise<void> {
  const existing = await db.userEngagementStat.findUnique({ where: { email } });
  if (existing) {
    await db.userEngagementStat.update({
      where: { email },
      data: {
        coins,
        currentStreak: streak,
        longestStreak: Math.max(existing.longestStreak, streak),
      },
    });
  } else {
    await db.userEngagementStat.create({
      data: { email, coins, currentStreak: streak, longestStreak: streak },
    });
  }
}

export async function resetUserProgressAdmin(email: string): Promise<void> {
  await db.$transaction([
    db.chatSession.deleteMany({ where: { email } }),
    db.flashcard.deleteMany({ where: { email } }),
    db.weaknessLog.deleteMany({ where: { email } }),
    db.userLanguageGoal.deleteMany({ where: { email } }),
    db.skillProgressLog.deleteMany({ where: { email } }),
    db.userEngagementStat.deleteMany({ where: { email } }),
    db.passwordReset.deleteMany({ where: { email } }),
    db.userBadge.deleteMany({ where: { email } }),
    db.emailVerificationToken.deleteMany({ where: { email } }),
    db.userProgressLog.deleteMany({ where: { email } }),
    db.userLanguageProgress.deleteMany({ where: { email } }),
    db.follower.deleteMany({ where: { OR: [{ followerEmail: email }, { followedEmail: email }] } }),
    db.quizBattle.deleteMany({ where: { OR: [{ challengerEmail: email }, { challengedEmail: email }] } }),
    db.user.update({ where: { email }, data: { score: 0, preferredLanguage: "English" } }),
  ]);
}

export async function updateUserRoleAdmin(email: string, newRole: string): Promise<void> {
  await db.user.update({ where: { email }, data: { role: newRole } });
}
```

Catatan: `db.chatSession.deleteMany` cascade menghapus chat_messages via FK (schema: onDelete Cascade) — parity dengan legacy yang hanya hapus chat_sessions.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 172 pass.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/admin.ts
git commit -m "feat: admin user management functions"
```

---

### Task 3: lib/admin.ts — shop + language fns

**Files:**
- Modify: `lib/admin.ts`, `lib/types.ts` (tambah AdminShopItem, AdminLanguageItem)

**Interfaces:**
- Produces:
  ```ts
  // lib/types.ts
  export interface AdminShopItem {
    id: number; name: string; description: string | null;
    cost: number; effect_type: string; icon_name: string | null;
  }
  export interface AdminLanguageItem {
    id: string; name: string; native_name: string; flag: string; description: string;
    theme_class: string; button_class: string; category: string;
    tts_lang_code: string; edge_tts_voice: string | null;
  }

  // lib/admin.ts
  export async function getShopItemsAdmin(): Promise<AdminShopItem[]>       // ORDER BY cost
  export async function createShopItemAdmin(input: { name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<void>
  export async function updateShopItemAdmin(id: number, input: { name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<void>
  export async function getLanguagesAdmin(): Promise<AdminLanguageItem[]>   // ORDER BY name
  export async function createLanguageAdmin(lang: AdminLanguageItem): Promise<void>
  export async function updateLanguageAdmin(id: string, lang: AdminLanguageItem): Promise<void>
  ```

- [ ] **Step 1: Implementasi**

Tambah 2 tipe + append ke `lib/admin.ts`:
```ts
export async function getShopItemsAdmin(): Promise<AdminShopItem[]> {
  const items = await db.shopItem.findMany({ orderBy: { cost: "asc" } });
  return items.map((i) => ({
    id: i.id, name: i.name, description: i.description, cost: i.cost,
    effect_type: i.effectType, icon_name: i.iconName,
  }));
}

export async function createShopItemAdmin(input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.create({
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function updateShopItemAdmin(id: number, input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.update({
    where: { id },
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function getLanguagesAdmin(): Promise<AdminLanguageItem[]> {
  const rows = await db.language.findMany({ orderBy: { name: "asc" } });
  return rows.map((l) => ({
    id: l.id, name: l.name, native_name: l.nativeName, flag: l.flag, description: l.description,
    theme_class: l.themeClass, button_class: l.buttonClass, category: l.category,
    tts_lang_code: l.ttsLangCode, edge_tts_voice: l.edgeTtsVoice,
  }));
}

export async function createLanguageAdmin(lang: AdminLanguageItem): Promise<void> {
  await db.language.create({
    data: {
      id: lang.id, name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice,
    },
  });
}

export async function updateLanguageAdmin(id: string, lang: AdminLanguageItem): Promise<void> {
  await db.language.update({
    where: { id },
    data: {
      name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice,
    },
  });
}
```

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 172 pass.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/admin.ts
git commit -m "feat: admin shop and language management functions"
```

---

### Task 4: lib/admin.ts — curriculum + config fns + lib/actions/admin.ts

**Files:**
- Modify: `lib/admin.ts`, `lib/types.ts` (tambah AdminLevelItem, AdminTopicItem, AdminMissionConfigItem)
- Create: `lib/actions/admin.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/types.ts
  export interface AdminLevelItem {
    id: string; title: string; description: string; base_reward_points: number; order_index: number;
  }
  export interface AdminTopicItem {
    id: number; level_id: string; title: string; order_index: number;
  }
  export interface AdminMissionConfigItem {
    id: number; name: string; lesson_target: number; quiz_target: number;
    weakness_target: number; flashcard_target_min: number; flashcard_target_max: number;
  }

  // lib/admin.ts
  export async function getLevelsAdmin(): Promise<AdminLevelItem[]>
  export async function updateLevelAdmin(id: string, level: AdminLevelItem): Promise<void>
  export async function createLevelAdmin(level: AdminLevelItem): Promise<void>
  export async function getTopicsAdmin(levelId: string): Promise<AdminTopicItem[]>
  export async function updateTopicAdmin(id: number, title: string, orderIndex: number): Promise<void>
  export async function createTopicAdmin(levelId: string, title: string, orderIndex: number): Promise<void>
  export async function getAppConfigsAdmin(): Promise<{ key: string; value: string; description: string | null }[]>
  export async function updateAppConfigAdmin(key: string, value: string): Promise<void>
  export async function getMissionConfigsAdmin(): Promise<AdminMissionConfigItem[]>
  export async function updateMissionConfigAdmin(id: number, cfg: Omit<AdminMissionConfigItem, "id" | "name">): Promise<void>

  // lib/actions/admin.ts (17 actions — semua mulai dengan guard)
  export async function requireAdminAction(): Promise<{ email: string } | { error: string }>  // helper untuk layout? — TIDAK: layout panggil requireAdmin langsung (server component)
  // Actions (guard via requireAdmin, error "Akses ditolak."):
  // getUsersAdminAction / updateUserStatsAdminAction({email, coins, streak}) / resetUserProgressAdminAction(email) / updateUserRoleAdminAction({email, role})
  // getShopItemsAdminAction / createShopItemAdminAction(input) / updateShopItemAdminAction({id, ...input})
  // getLanguagesAdminAction / createLanguageAdminAction(lang) / updateLanguageAdminAction({id, ...lang})
  // getLevelsAdminAction / updateLevelAdminAction({id, ...level}) / createLevelAdminAction(level)
  // getTopicsAdminAction(levelId) / updateTopicAdminAction({id, title, orderIndex}) / createTopicAdminAction({levelId, title, orderIndex})
  // getAppConfigsAdminAction / updateAppConfigAdminAction({key, value})
  // getMissionConfigsAdminAction / updateMissionConfigAdminAction({id, ...cfg})
  ```

- [ ] **Step 1: Implementasi curriculum + config di `lib/admin.ts`**

Tambah 3 tipe ke `lib/types.ts`.

Append ke `lib/admin.ts`:
```ts
export async function getLevelsAdmin(): Promise<AdminLevelItem[]> {
  const rows = await db.level.findMany({ orderBy: { orderIndex: "asc" } });
  return rows.map((l) => ({
    id: l.id, title: l.title, description: l.description,
    base_reward_points: l.baseRewardPoints, order_index: l.orderIndex,
  }));
}

export async function updateLevelAdmin(id: string, level: AdminLevelItem): Promise<void> {
  await db.level.update({
    where: { id },
    data: { title: level.title, description: level.description, baseRewardPoints: level.base_reward_points, orderIndex: level.order_index },
  });
}

export async function createLevelAdmin(level: AdminLevelItem): Promise<void> {
  await db.level.create({
    data: {
      id: level.id, title: level.title, description: level.description,
      baseRewardPoints: level.base_reward_points, orderIndex: level.order_index,
    },
  });
}

export async function getTopicsAdmin(levelId: string): Promise<AdminTopicItem[]> {
  const rows = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
  return rows.map((t) => ({ id: t.id, level_id: t.levelId, title: t.title, order_index: t.orderIndex }));
}

export async function updateTopicAdmin(id: number, title: string, orderIndex: number): Promise<void> {
  await db.topic.update({ where: { id }, data: { title, orderIndex } });
}

export async function createTopicAdmin(levelId: string, title: string, orderIndex: number): Promise<void> {
  await db.topic.create({ data: { levelId, title, orderIndex } });
}

export async function getAppConfigsAdmin(): Promise<{ key: string; value: string; description: string | null }[]> {
  const rows = await db.appConfig.findMany({ orderBy: { key: "asc" } });
  return rows.map((c) => ({ key: c.key, value: c.value, description: c.description }));
}

export async function updateAppConfigAdmin(key: string, value: string): Promise<void> {
  await db.appConfig.update({ where: { key }, data: { value } });
}

export async function getMissionConfigsAdmin(): Promise<AdminMissionConfigItem[]> {
  const rows = await db.missionConfig.findMany({ orderBy: { id: "asc" } });
  return rows.map((c) => ({
    id: c.id, name: c.name,
    lesson_target: c.lessonTarget ?? 1, quiz_target: c.quizTarget ?? 1,
    weakness_target: c.weaknessTarget ?? 3,
    flashcard_target_min: c.flashcardTargetMin ?? 5, flashcard_target_max: c.flashcardTargetMax ?? 15,
  }));
}

export async function updateMissionConfigAdmin(id: number, cfg: {
  lessonTarget: number; quizTarget: number; weaknessTarget: number;
  flashcardTargetMin: number; flashcardTargetMax: number;
}): Promise<void> {
  await db.missionConfig.update({
    where: { id },
    data: {
      lessonTarget: cfg.lessonTarget, quizTarget: cfg.quizTarget, weaknessTarget: cfg.weaknessTarget,
      flashcardTargetMin: cfg.flashcardTargetMin, flashcardTargetMax: cfg.flashcardTargetMax,
    },
  });
}
```

- [ ] **Step 2: Implementasi `lib/actions/admin.ts`**

```ts
"use server";

import { requireAdmin } from "../auth";
import {
  createLanguageAdmin, createLevelAdmin, createShopItemAdmin, createTopicAdmin,
  getAppConfigsAdmin, getLanguagesAdmin, getLevelsAdmin, getMissionConfigsAdmin,
  getShopItemsAdmin, getTopicsAdmin, getUsersAdmin, resetUserProgressAdmin,
  updateAppConfigAdmin, updateLanguageAdmin, updateLevelAdmin, updateMissionConfigAdmin,
  updateShopItemAdmin, updateTopicAdmin, updateUserRoleAdmin, updateUserStatsAdmin,
} from "../admin";
import type { AdminLanguageItem, AdminLevelItem } from "../types";

type AdminResult<T> = T | { error: string };

async function guard(): Promise<string | { error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Akses ditolak." };
  return admin.email;
}

export async function getUsersAdminAction(): Promise<AdminResult<{ users: Awaited<ReturnType<typeof getUsersAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { users: await getUsersAdmin() };
}

export async function updateUserStatsAdminAction(input: { email: string; coins: number; streak: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateUserStatsAdmin(input.email, input.coins, input.streak);
  return { ok: true };
}

export async function resetUserProgressAdminAction(email: string): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await resetUserProgressAdmin(email);
  return { ok: true };
}

export async function updateUserRoleAdminAction(input: { email: string; role: string }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateUserRoleAdmin(input.email, input.role);
  return { ok: true };
}

export async function getShopItemsAdminAction(): Promise<AdminResult<{ items: Awaited<ReturnType<typeof getShopItemsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { items: await getShopItemsAdmin() };
}

export async function createShopItemAdminAction(input: { name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createShopItemAdmin(input);
  return { ok: true };
}

export async function updateShopItemAdminAction(input: { id: number; name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const { id, ...rest } = input;
  await updateShopItemAdmin(id, rest);
  return { ok: true };
}

export async function getLanguagesAdminAction(): Promise<AdminResult<{ languages: Awaited<ReturnType<typeof getLanguagesAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { languages: await getLanguagesAdmin() };
}

export async function createLanguageAdminAction(lang: AdminLanguageItem): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createLanguageAdmin(lang);
  return { ok: true };
}

export async function updateLanguageAdminAction(input: { id: string; lang: AdminLanguageItem }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateLanguageAdmin(input.id, input.lang);
  return { ok: true };
}

export async function getLevelsAdminAction(): Promise<AdminResult<{ levels: Awaited<ReturnType<typeof getLevelsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { levels: await getLevelsAdmin() };
}

export async function updateLevelAdminAction(input: { id: string; level: AdminLevelItem }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateLevelAdmin(input.id, input.level);
  return { ok: true };
}

export async function createLevelAdminAction(level: AdminLevelItem): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createLevelAdmin(level);
  return { ok: true };
}

export async function getTopicsAdminAction(levelId: string): Promise<AdminResult<{ topics: Awaited<ReturnType<typeof getTopicsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { topics: await getTopicsAdmin(levelId) };
}

export async function updateTopicAdminAction(input: { id: number; title: string; orderIndex: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateTopicAdmin(input.id, input.title, input.orderIndex);
  return { ok: true };
}

export async function createTopicAdminAction(input: { levelId: string; title: string; orderIndex: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await createTopicAdmin(input.levelId, input.title, input.orderIndex);
  return { ok: true };
}

export async function getAppConfigsAdminAction(): Promise<AdminResult<{ configs: Awaited<ReturnType<typeof getAppConfigsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { configs: await getAppConfigsAdmin() };
}

export async function updateAppConfigAdminAction(input: { key: string; value: string }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  await updateAppConfigAdmin(input.key, input.value);
  return { ok: true };
}

export async function getMissionConfigsAdminAction(): Promise<AdminResult<{ configs: Awaited<ReturnType<typeof getMissionConfigsAdmin>> }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  return { configs: await getMissionConfigsAdmin() };
}

export async function updateMissionConfigAdminAction(input: { id: number; lessonTarget: number; quizTarget: number; weaknessTarget: number; flashcardTargetMin: number; flashcardTargetMax: number }): Promise<AdminResult<{ ok: boolean }>> {
  const g = await guard();
  if (typeof g !== "string") return g;
  const { id, ...rest } = input;
  await updateMissionConfigAdmin(id, rest);
  return { ok: true };
}
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 172 pass; `npm run lint` — 0 error.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/admin.ts lib/actions/admin.ts
git commit -m "feat: admin actions with role guard (curriculum, config, users, shop, languages)"
```

---

### Task 5: Admin shell — layout, login, [tab] wrapper

**Files:**
- Create: `app/(admin)/layout.tsx`, `app/(admin)/admin/login/page.tsx`, `app/(admin)/admin/[tab]/page.tsx`, `components/admin/AdminShell.tsx`, `components/admin/AdminLoginForm.tsx`

**Interfaces:**
- Consumes: `requireAdmin` (Task 1), `loginAction` (lib/actions/auth), panel components (Task 6-8)
- Produces: route group admin lengkap (shell + login + tab routing)

- [ ] **Step 1: `app/(admin)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

const TABS = [
  { key: "konfigurasi", label: "Konfigurasi", icon: "⚙️" },
  { key: "toko", label: "Toko", icon: "🏪" },
  { key: "bahasa", label: "Bahasa", icon: "🌐" },
  { key: "kurikulum", label: "Kurikulum", icon: "📚" },
  { key: "pengguna", label: "Pengguna", icon: "👥" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return <AdminShell tabs={TABS}>{children}</AdminShell>;
}
```

- [ ] **Step 2: `components/admin/AdminShell.tsx` (client wrapper untuk sidebar + topbar)**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";

export interface AdminTab { key: string; label: string; icon: string; }

export default function AdminShell({ tabs, children }: { tabs: AdminTab[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.split("/")[2] ?? "konfigurasi";
  const activeTab = tabs.find((t) => t.key === active);

  async function logout() {
    await logoutAction();
    router.push("/admin/login");
  }

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6">
          <p className="text-xl font-black">LingoAdmin</p>
          <p className="text-[11px] text-slate-400">Enterprise</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/${t.key}`}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                active === t.key ? "bg-indigo-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 text-[11px] text-slate-400">LingoMind v1.0.0</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between px-6">
          <h1 className="font-extrabold">{activeTab?.label ?? "Admin"}</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-teal-600">Aplikasi Utama</Link>
            <button type="button" onClick={logout} className="text-xs font-bold text-slate-400 hover:text-rose-500">Logout</button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Admin login**

`app/(admin)/admin/login/page.tsx`:
```tsx
import AdminLoginForm from "@/components/admin/AdminLoginForm";
export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
```

`components/admin/AdminLoginForm.tsx` (client — port dari views/admin/login.rs; reuse loginAction + cek role):
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

export default function AdminLoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    if (state.message === "ok") {
      // loginAction tidak return role — cek via /admin guard; untuk role check, gunakan pendekatan:
      // halaman ini hanya sampai jika belum login; setelah login, layout /admin akan redirect bila bukan admin.
      router.push("/admin/konfigurasi");
    }
  }, [state, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-700 text-center">
        <p className="text-2xl font-black">Admin Portal</p>
        <p className="text-xs text-slate-400 mt-1">Secure Access Control</p>
        {roleError && <p className="mt-4 p-3 bg-rose-900/30 border border-rose-700 rounded-lg text-rose-400 text-xs font-semibold">{roleError}</p>}
        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lingomind.com" disabled={pending}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-bold py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm">
            {pending ? "Memproses..." : "Secure Login"}
          </button>
        </form>
        <Link href="/login" className="inline-block mt-5 text-xs text-slate-400 hover:underline">Kembali ke Aplikasi Utama</Link>
      </div>
    </div>
  );
}
```

CATATAN PENTING (controller): loginAction tidak mengembalikan role. Pendekatan bersih: buat `adminLoginAction` baru di `lib/actions/admin.ts` yang memanggil loginAction internal? — loginAction sudah "use server" dan meng-set cookie. Alternatif yang dipilih: `AdminLoginForm` setelah `state.message === "ok"` push `/admin/konfigurasi`; layout `/admin` memanggil requireAdmin → bukan admin → redirect `/admin/login`. Untuk pesan "Akses ditolak. Anda bukan admin.": layout redirect tanpa pesan. AGAR PESAN TAMPIL: tambahkan action `checkAdminRoleAction()` di lib/actions/admin.ts yang return { isAdmin } — AdminLoginForm panggil setelah login sukses → kalau false → tampilkan "Akses ditolak. Anda bukan admin." dan jangan redirect. Implementasi:

```ts
// lib/actions/admin.ts tambah:
export async function checkAdminRoleAction(): Promise<{ isAdmin: boolean } | { error: string }> {
  const admin = await requireAdmin();
  return { isAdmin: admin !== null };
}
```
AdminLoginForm: setelah message ok → `const r = await checkAdminRoleAction(); if (r.isAdmin) router.push("/admin/konfigurasi"); else setRoleError("Akses ditolak. Anda bukan admin.");`

- [ ] **Step 4: `app/(admin)/admin/[tab]/page.tsx` (server wrapper)**

```tsx
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminConfigPanel from "@/components/admin/AdminConfigPanel";
import AdminCurriculumPanel from "@/components/admin/AdminCurriculumPanel";
import AdminLanguagePanel from "@/components/admin/AdminLanguagePanel";
import AdminShopPanel from "@/components/admin/AdminShopPanel";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";

export default async function AdminTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  switch (tab) {
    case "konfigurasi": return <AdminConfigPanel />;
    case "toko": return <AdminShopPanel />;
    case "bahasa": return <AdminLanguagePanel />;
    case "kurikulum": return <AdminCurriculumPanel />;
    case "pengguna": return <AdminUsersPanel />;
    default: return <p className="text-sm text-slate-400">Tab tidak ditemukan.</p>;
  }
}
```

- [ ] **Step 5: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (172 pass). Catatan: panel komponen belum ada — buat placeholder minimal dulu (render null) supaya tsc pass? BUKAN: Task 6-8 membuatnya. URUTAN: kerjakan Task 6-8 dulu sebelum verifikasi Task 5 — atau buat file panel kosong sementara. PILIH: buat file panel kosong (`export default function X() { return null; }`) di Task 5, lalu Task 6-8 mengisinya. JANGAN commit Task 5 dengan panel kosong — gabung commit Task 5 dengan Task 6-8? Tidak: commit Task 5 (shell + login + wrapper dengan panel placeholder), lalu Task 6-8 isi panel dalam commit masing-masing. Catatan ini untuk implementer.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/admin/login/page.tsx" "app/(admin)/admin/[tab]/page.tsx" components/admin/AdminShell.tsx components/admin/AdminLoginForm.tsx lib/actions/admin.ts
git commit -m "feat: admin shell, login, and tab routing"
```

(Catatan: buat 5 file panel placeholder kosong dulu agar build pass — commit bersama Task 5; isi di Task 6-8.)

---

### Task 6: Panel Konfigurasi + Panel Toko

**Files:**
- Modify: `components/admin/AdminConfigPanel.tsx`, `components/admin/AdminShopPanel.tsx` (isi dari placeholder)

**Interfaces:**
- Consumes: `getAppConfigsAdminAction`/`updateAppConfigAdminAction`/`getMissionConfigsAdminAction`/`updateMissionConfigAdminAction` (Task 4), `getShopItemsAdminAction`/`createShopItemAdminAction`/`updateShopItemAdminAction`
- Produces: 2 panel fungsional

- [ ] **Step 1: `AdminConfigPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  getAppConfigsAdminAction, getMissionConfigsAdminAction,
  updateAppConfigAdminAction, updateMissionConfigAdminAction,
} from "@/lib/actions/admin";

interface AppConfigRow { key: string; value: string; description: string | null; }
interface MissionConfigRow {
  id: number; name: string; lesson_target: number; quiz_target: number;
  weakness_target: number; flashcard_target_min: number; flashcard_target_max: number;
}

export default function AdminConfigPanel() {
  const [appConfigs, setAppConfigs] = useState<AppConfigRow[] | null>(null);
  const [missionConfigs, setMissionConfigs] = useState<MissionConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingApp, setEditingApp] = useState<AppConfigRow | null>(null);
  const [editingMission, setEditingMission] = useState<MissionConfigRow | null>(null);
  const [appValue, setAppValue] = useState("");
  const [missionForm, setMissionForm] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAppConfigsAdminAction(), getMissionConfigsAdminAction()])
      .then(([a, m]) => {
        if (cancelled) return;
        if ("error" in a) { setError(a.error); return; }
        if ("error" in m) { setError(m.error); return; }
        setAppConfigs(a.configs);
        setMissionConfigs(m.configs);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat konfigurasi.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  async function saveApp() {
    if (!editingApp) return;
    setStatus(null);
    const res = await updateAppConfigAdminAction({ key: editingApp.key, value: appValue }).catch(() => ({ error: "Gagal menyimpan." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus("Konfigurasi diperbarui!");
    setEditingApp(null);
    setReloadKey((k) => k + 1);
  }

  async function saveMission() {
    if (!editingMission) return;
    const toNum = (v: string, fallback: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
    const input = {
      id: editingMission.id,
      lessonTarget: toNum(missionForm.lesson, editingMission.lesson_target),
      quizTarget: toNum(missionForm.quiz, editingMission.quiz_target),
      weaknessTarget: toNum(missionForm.weakness, editingMission.weakness_target),
      flashcardTargetMin: toNum(missionForm.fcMin, editingMission.flashcard_target_min),
      flashcardTargetMax: toNum(missionForm.fcMax, editingMission.flashcard_target_max),
    };
    setStatus(null);
    const res = await updateMissionConfigAdminAction(input).catch(() => ({ error: "Gagal menyimpan." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus("Misi harian diperbarui!");
    setEditingMission(null);
    setReloadKey((k) => k + 1);
  }

  if (!appConfigs || !missionConfigs) {
    return <div className="text-sm text-slate-400">Memuat konfigurasi...</div>;
  }

  return (
    <div className="space-y-6">
      {status && <div className="px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm">{error}</div>}

      <section className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-extrabold mb-4">⚙️ Sistem Konfigurasi Utama</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3">Key</th>
                <th className="text-left py-2 px-3">Value</th>
                <th className="text-left py-2 px-3">Deskripsi</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {appConfigs.map((c) => (
                <tr key={c.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 font-bold">{c.key}</td>
                  <td className="py-2 px-3">{c.value}</td>
                  <td className="py-2 px-3 text-xs text-slate-400">{c.description}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => { setEditingApp(c); setAppValue(c.value); }} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-extrabold mb-4">🎯 Konfigurasi Misi Harian</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3">Nama</th>
                <th className="text-left py-2 px-3">Lesson</th>
                <th className="text-left py-2 px-3">Quiz</th>
                <th className="text-left py-2 px-3">Weakness</th>
                <th className="text-left py-2 px-3">FC Min</th>
                <th className="text-left py-2 px-3">FC Max</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {missionConfigs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 font-bold">{c.name}</td>
                  <td className="py-2 px-3">{c.lesson_target}</td>
                  <td className="py-2 px-3">{c.quiz_target}</td>
                  <td className="py-2 px-3">{c.weakness_target}</td>
                  <td className="py-2 px-3">{c.flashcard_target_min}</td>
                  <td className="py-2 px-3">{c.flashcard_target_max}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => {
                      setEditingMission(c);
                      setMissionForm({
                        lesson: String(c.lesson_target), quiz: String(c.quiz_target),
                        weakness: String(c.weakness_target), fcMin: String(c.flashcard_target_min),
                        fcMax: String(c.flashcard_target_max),
                      });
                    }} className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingApp && (
        <Modal title="Edit Konfigurasi" onClose={() => setEditingApp(null)}>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Key</label>
          <input value={editingApp.key} disabled className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm disabled:opacity-60" />
          <p className="text-xs text-slate-400 mt-2">{editingApp.description}</p>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Value</label>
          <input value={appValue} onChange={(e) => setAppValue(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <ModalFooter onCancel={() => setEditingApp(null)} onSave={saveApp} />
        </Modal>
      )}

      {editingMission && (
        <Modal title="Edit Misi Harian" onClose={() => setEditingMission(null)}>
          <p className="text-xs font-bold text-slate-400 mb-3">{editingMission.name}</p>
          {([
            ["lesson", "Target Lesson"], ["quiz", "Target Quiz"], ["weakness", "Target Weakness"],
            ["fcMin", "Flashcard Target Min"], ["fcMax", "Flashcard Target Max"],
          ] as const).map(([key, label]) => (
            <div key={key} className="mb-3">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
              <input type="number" value={missionForm[key] ?? ""} onChange={(e) => setMissionForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
            </div>
          ))}
          <ModalFooter onCancel={() => setEditingMission(null)} onSave={saveMission} />
        </Modal>
      )}
    </div>
  );
}

// Modal + ModalFooter — komponen kecil shared di file ini (atau components/admin/ui.tsx — pilih; implementer bebas, konsisten)
```

Catatan: buat komponen shared `components/admin/ui.tsx` berisi `Modal` dan `ModalFooter` (dipakai semua panel) — definisi: Modal = fixed inset-0 overlay + max-w-md card (title + x + children); ModalFooter = flex gap Batal/Simpan (spinner "Menyimpan..." saat saving, props onSave async handled di parent). Tulis sekali, import semua panel.

- [ ] **Step 2: `AdminShopPanel.tsx`**

Struktur: list table (icon/name/cost/effect/description + Edit), "Tambah Item" button, modal form (Ikon default 🎁, Harga default 10, Nama, Tipe Efek placeholder "e.g. shield, streak_freeze, double_xp", Deskripsi textarea; simpan disabled nama kosong). Actions: getShopItemsAdminAction/createShopItemAdminAction/updateShopItemAdminAction. Strings per brief. Error/status banner + reloadKey.

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (172 pass).

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminConfigPanel.tsx components/admin/AdminShopPanel.tsx components/admin/ui.tsx
git commit -m "feat: admin config and shop panels"
```

---

### Task 7: Panel Bahasa + Panel Kurikulum

**Files:**
- Modify: `components/admin/AdminLanguagePanel.tsx`, `components/admin/AdminCurriculumPanel.tsx` (isi dari placeholder)

**Interfaces:**
- Consumes: language actions + curriculum actions (Task 4)
- Produces: 2 panel fungsional

- [ ] **Step 1: `AdminLanguagePanel.tsx`**

Struktur: list table (flag/id/name/native/category/tts/edge/aksi Edit), "Tambah Bahasa", modal form 10 field (Bendera 🌐, Kode ID disabled edit placeholder "e.g. ja, ko, fr", Nama "e.g. Jepang", Nama Asli "e.g. 日本語", Kategori default Eropa "e.g. Asia, Eropa", Kode TTS Voice "e.g. ja-JP, ko-KR", Edge TTS Voice placeholder "e.g. ja-JP-NanamiNeural", CSS Kelas Tema default "bg-indigo-500", CSS Kelas Tombol default "bg-indigo-600 hover:bg-indigo-700", Deskripsi textarea); simpan disabled id/nama kosong (saat tambah) / nama kosong (saat edit). Strings: "Katalog Bahasa", "Tambah Bahasa", "Edit Katalog Bahasa"/"Tambah Katalog Bahasa". Error/status banner + reloadKey.

- [ ] **Step 2: `AdminCurriculumPanel.tsx`**

Dua pane: kiri levels (list ORDER BY order_index, "Tambah" button, Edit modal: Kode disabled saat edit placeholder "e.g. A1", Nama "e.g. Beginner", Base Reward default 100, Order Index default 1, Deskripsi textarea; simpan disabled id/title kosong), kanan topics (list per selected level, "Tambah Topik" modal: Level display disabled, Nama Topik placeholder "e.g. Greetings & Introductions", Order Index; simpan disabled title kosong). Level pertama auto-select saat load. Empty states: "Belum ada level." / "Tidak ada topik ditemukan di level ini." / "Pilih salah satu Level di sebelah kiri untuk melihat dan mengelola Topik." / "Memuat Levels..." / "Memuat Topik...". Strings: "Levels (CEFR)", "Daftar Topik: ", "Tambah", "Tambah Topik", "Edit Level Pembelajaran"/"Tambah Level Pembelajaran".

- [ ] **Step 3: Verifikasi**

Run: `npm run lint`, `npx tsc --noEmit`, `npm test` (172 pass).

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminLanguagePanel.tsx components/admin/AdminCurriculumPanel.tsx
git commit -m "feat: admin language and curriculum panels"
```

---

### Task 8: Panel Pengguna + AGENTS.md + verifikasi final

**Files:**
- Modify: `components/admin/AdminUsersPanel.tsx` (isi dari placeholder), `AGENTS.md`

**Interfaces:**
- Consumes: user actions (Task 4)
- Produces: panel pengguna fungsional + docs + final verify

- [ ] **Step 1: `AdminUsersPanel.tsx`**

Struktur: search input (placeholder "Cari email atau nama...") + list table (email/full_name/role/is_verified/score/coins/streak + aksi: Edit Stats, Reset, role toggle "Jadikan Admin"/"Cabut Admin"); search client-side (email/nama toLowerCase contains; empty "Tidak ada pengguna yang cocok."); loading "Memuat Data Pengguna..."; Edit Stats modal (Coins + Streak number, Batal/Simpan → updateUserStatsAdminAction); Reset tanpa konfirmasi (parity) → resetUserProgressAdminAction; role toggle → updateUserRoleAdminAction; error/status banner + reloadKey.

- [ ] **Step 2: Update AGENTS.md**

- Routes: `/admin/login`, `/admin/:tab` (group `app/(admin)` — tanpa navbar user)
- lib: `admin.ts`, `admin-guard` (requireAdmin di lib/auth.ts); actions/admin.ts (17 actions, guard "Akses ditolak.")
- Konvensi: guard admin `requireAdmin()` di semua action admin; middleware melindungi /admin (session), role di-check layout
- Status: Fase 5 selesai; tersisa 6 (cron + deploy Vercel + cutover)

- [ ] **Step 3: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminUsersPanel.tsx AGENTS.md
git commit -m "docs: admin users panel and update AGENTS.md for phase 5"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. requireAdmin + middleware | 172 test (4 baru) |
| 2. User fns | tsc/test |
| 3. Shop + language fns | tsc/test |
| 4. Curriculum/config fns + actions | tsc/lint/test |
| 5. Shell + login + routing | lint/tsc/test |
| 6. Config + shop panels | lint/tsc/test |
| 7. Language + curriculum panels | lint/tsc/test |
| 8. Users panel + AGENTS + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **loginAction tidak return role**: gunakan `checkAdminRoleAction()` setelah login sukses untuk pesan "Akses ditolak. Anda bukan admin." (Task 5).
- **Panel placeholder**: Task 5 butuh 5 file panel kosong agar build pass — dibuat di Task 5, diisi Task 6-8.
- **Modal shared**: buat `components/admin/ui.tsx` (Modal + ModalFooter) sekali, import semua panel.
- **Guard di action**: pola `const g = await guard(); if (typeof g !== "string") return g;` — konsisten semua action.
- **resetUserProgress**: deleteMany chatSession cascade menghapus chat_messages (parity legacy yang hanya hapus sessions).
- **Admin seed**: `admin@lingomind.com` / `admin` (dari fase 1 seed — sudah ada).
