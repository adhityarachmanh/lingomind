# Migrasi LingoMind ke Next.js — Fase 1: Fondasi + Auth + Dashboard — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan aplikasi Dioxus LingoMind ke folder `dioxus/` sebagai referensi, lalu membangun aplikasi Next.js baru di root repo (App Router + TypeScript + Tailwind + Prisma/Neon + JWT cookie auth + dashboard ringkas + setup AI SDK), tanpa mengubah database production yang dipakai bersama.

**Architecture:** Aplikasi Next.js berdiri di root repo (`app/`, `components/`, `lib/`, `prisma/`); kode Dioxus lama dipindah via `git mv` ke `dioxus/`. Prisma meng-introspect skema Neon yang sudah ada dan membuat baseline migration (tabel existing tidak di-recreate). Auth baru: JWT httpOnly cookie (jose) menggantikan pola lama yang mempercayai email dari localStorage; setiap server action memanggil `getSession()`. Semua backend lama (`#[server]` fn) menjadi server actions + query Prisma dengan pesan error Indonesia yang sama persis.

**Tech Stack:** Next.js (App Router, stabil terbaru, Node 22), TypeScript, Tailwind CSS, Prisma ORM + Neon PostgreSQL (DB lama, skema sama), jose (JWT), bcryptjs, nodemailer (SMTP Gmail), ai + @ai-sdk/openai-compatible (provider opencode.ai), vitest (unit test lib murni).

**Referensi kode lama (sumber kebenaran perilaku):**
- Auth: `dioxus/src/services/auth.rs` (register, login, verify, forgot/reset, resend)
- Stats & hearts: `dioxus/src/services/engagement.rs:98-160`
- Misi harian: `dioxus/src/services/mission.rs:5-110`
- Kurikulum & bahasa: `dioxus/src/services/curriculum.rs:18-104`
- Flashcard due: `dioxus/src/services/flashcard.rs:92-102`
- UI login: `dioxus/src/views/login.rs`; navbar: `dioxus/src/components/navbar.rs`; dashboard: `dioxus/src/views/dashboard.rs` (hanya kartu statistik/header; sisa halaman TIDAK diport di fase ini)
- Dark mode: `dioxus/src/components/app.rs:44-80` (script anti-flash) dan `:173-179`

## Global Constraints

- **UI & pesan error dalam bahasa Indonesia.** Pesan error berikut wajib dipakai apa adanya (string sama dengan aplikasi lama):
  - `Email sudah digunakan, silakan gunakan email lain.`
  - `Email atau password salah.`
  - `UNVERIFIED:Akun Anda belum diverifikasi. Silakan cek email Anda.` (prefix `UNVERIFIED:` diparsing di halaman login → tampilkan tombol "Kirim ulang email verifikasi")
  - `Email tidak terdaftar di sistem kami.`
  - `Akun ini sudah diverifikasi.`
  - `Token verifikasi tidak valid atau sudah kedaluwarsa.`
  - `Token reset tidak valid atau sudah kedaluwarsa.`
  - `Password baru minimal harus berukuran 6 karakter.`
  - `Password Anda berhasil direset! Silakan login dengan password baru Anda.`
  - `Akun Anda berhasil diverifikasi! Silakan login.`
  - `Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa folder Inbox atau Spam.`
  - `Instruksi reset password telah dikirim. Periksa email Anda (atau server console untuk testing).`
  - `Tautan verifikasi telah dikirim ulang ke email Anda.`
  - `Bahasa tidak valid.`
  - `Email dan password tidak boleh kosong!`
  - `Format email tidak valid.`
- Template email verifikasi/reset harus sama persis dengan `auth.rs:78-86` dan `auth.rs:409-417` (dengan `APP_URL` sebagai basis link).
- **Session:** JWT httpOnly cookie bernama `lingomind_session`, alg HS256, masa berlaku 30 hari, `sameSite: "lax"`, `secure` hanya saat `NODE_ENV === "production"`, `path: "/"`. Payload: `{ email, full_name, role }` — TIDAK berisi score/preferred_language (data fresh diambil dari DB per request).
- **Session lama localStorage tidak dipakai lagi.** Key `lingomind_user_session` diabaikan; user aplikasi lama harus login sekali lagi. Key `lingomind_theme` (dark mode) TETAP dipakai agar preferensi tema user lama bertahan.
- **Database adalah milik aplikasi Dioxus yang masih live.** Prisma hanya membaca tabel existing + baseline migration yang bersifat no-op. DILARANG menambah/mengubah skema di fase ini; `prisma migrate dev` TIDAK boleh membuat perubahan apa pun (verifikasi: `npx prisma migrate status` harus bersih).
- Env hanya dibaca server-side (`lib/`, server actions, server components). Jangan pernah menaruh rahasia di komponen client.
- `getSession()` wajib dipanggil di setiap server action yang butuh user — pengganti parameter `email: String` dari aplikasi lama.
- Semua query harus memakai Prisma Client, kecuali dijelaskan lain.
- Jangan commit `.env`. Commit per task (pesan commit singkat, gaya repo: `update` — bebas dipakai, tapi lebih baik deskriptif).
- Node 22 + npm 11 tersedia di mesin. Jangan ubah versi Node.

---

### Task 1: Pindahkan aplikasi Dioxus ke folder `dioxus/`

**Files:**
- Move: `src/`, `migrations/`, `assets/`, `public/`, `test_smtp.rs`, `examples/`, `apply_dark_mode.py`, `clear_ai_cache.sh`, `reset_progress.sh`, `reset_progress.sql`, `Dioxus.toml`, `clippy.toml`, `tailwind.css`, `error.txt`, `Cargo.toml`, `Cargo.lock`, `README.md`, `AGENTS.md`, `.gitignore` → `dioxus/`
- Create: `dioxus/README.md` (referensi asal — isi README lama saja)
- Create: `.gitignore` baru di root (isi di bawah)

**Interfaces:**
- Consumes: — (task pertama)
- Produces: root repo bersih (hanya `docs/` + `dioxus/` + `.git`), riwayat git utuh (pakai `git mv`)

- [ ] **Step 1: Buat folder dan pindahkan semuanya dengan `git mv`**

```bash
git mv src dioxus/src
git mv migrations dioxus/migrations
git mv assets dioxus/assets
git mv public dioxus/public
git mv test_smtp.rs examples apply_dark_mode.py clear_ai_cache.sh reset_progress.sh reset_progress.sql Dioxus.toml clippy.toml tailwind.css error.txt Cargo.toml Cargo.lock dioxus/
git mv README.md dioxus/README.md
git mv AGENTS.md dioxus/AGENTS.md
git mv .gitignore dioxus/.gitignore
```

- [ ] **Step 2: Buat `.gitignore` baru di root**

```gitignore
# Node
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts

# Env
.env
.env*.local

# Prisma
prisma/*.db

# System
.DS_Store

# Logs
npm-debug.log*
```

- [ ] **Step 3: Verifikasi pemindahan**

Run: `git status --short`
Expected: semua entri `R  src/... -> dioxus/src/...` (rename), tidak ada file hilang.
Run: `Get-ChildItem dioxus` — harus berisi `src`, `migrations`, `assets`, `Cargo.toml`, dll.
Run: `git ls-files | Measure-Object -Line` — jumlah file tidak berubah dari sebelum pindah (jumlah file berubah HANYA dari .gitignore lama→baru: beda 1 baris file).
Root sekarang hanya berisi `docs/`, `dioxus/`, `.gitignore` baru.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: move dioxus app to dioxus/ (phase 1 migration)"
```

---

### Task 2: Scaffold Next.js app di root

**Files:**
- Create (via create-next-app): `package.json`, `app/`, `components/`, `public/`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `app/globals.css`, dll
- Create: `.env` (salin dari `dioxus/.env` bila ada; jika tidak ada minta ke user) dan `.env.example`

**Interfaces:**
- Consumes: root bersih dari Task 1
- Produces: `npm run dev` berjalan; `app/layout.tsx` + `app/globals.css` (sementara default); `package.json` berisi scripts `dev`, `build`, `start`, `lint`

- [ ] **Step 1: Jalankan create-next-app non-interaktif di root**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack
```

Jika ada prompt interaktif (versi CLI lebih baru), jawab default/ya untuk semua. Jika CLI mengeluh folder tidak kosong, pastikan hanya `docs/` dan `dioxus/` yang ada (Task 1 harus selesai) lalu ulangi dengan `--yes` bila tersedia.

- [ ] **Step 2: Setup `.env` dan `.env.example`**

Salin dari `dioxus/.env` (bila ada) ke root `.env` lalu tambah baris baru:

```bash
# jika dioxus/.env ada:
Copy-Item dioxus/.env .env
# lalu tambahkan AUTH_SECRET — generate:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Isi final `.env` (nilai sebenarnya diisi sesuai .env lama + hasil generate):
```
DATABASE_URL=<dari dioxus/.env — Neon, sslmode=require>
AUTH_SECRET=<hex 64 karakter hasil generate>
SMTP_USERNAME=lingomindid@gmail.com
SMTP_PASSWORD=<dari dioxus/.env — Gmail app password>
APP_URL=http://localhost:3000
OPENCODE_AI_API_KEY=<dari environment session user>
OPENCODE_AI_ENDPOINT=https://opencode.ai/go/v1/chat/completions
OPENCODE_AI_MODEL=deepseek-v4-flash
```

Jika `dioxus/.env` tidak ada (misal sudah dihapus), tanya user untuk nilai `DATABASE_URL`, `SMTP_PASSWORD`, `OPENCODE_AI_API_KEY` sebelum lanjut.

Buat `.env.example` dengan placeholder yang sama (tanpa rahasia):
```
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
AUTH_SECRET=<random hex 64 chars>
SMTP_USERNAME=lingomindid@gmail.com
SMTP_PASSWORD=
APP_URL=http://localhost:3000
OPENCODE_AI_API_KEY=
OPENCODE_AI_ENDPOINT=https://opencode.ai/go/v1/chat/completions
OPENCODE_AI_MODEL=deepseek-v4-flash
```

- [ ] **Step 3: Verifikasi dev server**

Run: `npm run dev` (biarkan berjalan di terminal terpisah), buka `http://localhost:3000` → halaman welcome Next.js tampil. Hentikan dev server.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app components public tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs .gitignore .env.example
git commit -m "chore: scaffold next.js app (app router, tailwind, typescript)"
```

Jangan commit `.env` (sudah di .gitignore).

---

### Task 3: Prisma — introspect Neon + baseline migration

**Files:**
- Create: `prisma/schema.prisma` (hasil `db pull` — model semua tabel existing), `prisma/migrations/0_baseline/migration.sql` (hasil `migrate diff`), `scripts/check-db.ts`
- Modify: `package.json` (tambah scripts `db:pull`, `db:generate`, `db:status`; devDependency `tsx`)

**Interfaces:**
- Consumes: `.env` dengan `DATABASE_URL` (Task 2)
- Produces: `@prisma/client` siap dipakai; `db` singleton di Task 4 memakai `PrismaClient`

- [ ] **Step 1: Install Prisma**

```bash
npm install @prisma/client
npm install -D prisma tsx
```

- [ ] **Step 2: Introspect skema Neon yang ada**

```bash
npx prisma db pull
```

Expected: `prisma/schema.prisma` berisi model untuk semua tabel (users, email_verification_tokens, password_resets, user_engagement_stats, user_daily_missions, mission_config, app_config, languages, levels, topics, user_language_progress, flashcards, weakness_logs, cached_quizzes, cached_lessons, dll — ~40 tabel). TIDAK boleh ada output error koneksi.

- [ ] **Step 3: Buat baseline migration (no-op terhadap DB)**

```powershell
New-Item -ItemType Directory -Path "prisma/migrations/0_baseline" -Force | Out-Null
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_baseline/migration.sql
npx prisma migrate resolve --applied 0_baseline
```

Expected: `migration.sql` berisi `CREATE TABLE` lengkap (hasil dari schema — hanya dipakai sebagai penanda riwayat, TIDAK dieksekusi ke Neon); `migrate resolve` output `Applied migration 0_baseline`.

- [ ] **Step 4: Generate client & verifikasi status**

```bash
npx prisma generate
npx prisma migrate status
```

Expected: `migrate status` → "Database schema is up to date!" (0 unapplied).

- [ ] **Step 5: Verifikasi koneksi dengan script**

Create `scripts/check-db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const languages = await db.languages.count();
  const users = await db.users.count();
  console.log(`languages: ${languages}, users: ${users}`);
  if (languages !== 26) throw new Error("jumlah bahasa tidak sesuai seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
```

Run: `npx tsx scripts/check-db.ts`
Expected: `languages: 26, users: <jumlah user nyata>` — bukti DB production terhubung.

- [ ] **Step 6: Tambah scripts ke package.json + commit**

Edit `package.json` → `"scripts"` tambahkan:
```json
"db:pull": "prisma db pull",
"db:generate": "prisma generate",
"db:status": "prisma migrate status",
"db:check": "tsx scripts/check-db.ts"
```

```bash
git add prisma scripts package.json package-lock.json
git commit -m "feat: prisma setup with baseline migration from existing neon schema"
```

---

### Task 4: Fondasi lib — db singleton, tipe, validasi + setup vitest

**Files:**
- Create: `lib/db.ts`, `lib/types.ts`, `lib/validation.ts`, `lib/validation.test.ts`, `vitest.config.ts`
- Modify: `package.json` (scripts `test`)

**Interfaces:**
- Consumes: Prisma client (Task 3)
- Produces:
  - `export const db: PrismaClient` (dari `lib/db.ts`)
  - Tipe (dari `lib/types.ts`):
    ```ts
    export interface UserProfile {
      email: string; full_name: string; preferred_language: string;
      score: number; current_level: Record<string, string>; role: string;
    }
    export interface EngagementStats {
      current_streak: number; longest_streak: number; total_quiz_completed: number;
      total_points_earned: number; coins: number; streak_freezes: number;
      previous_streak: number; double_xp_until: Date | null; exam_retake_tickets: number;
      hearts: number; last_heart_refill: Date | null;
    }
    export interface DailyMission {
      lessons_completed: number; quizzes_completed: number; weakness_practices_completed: number;
      flashcards_reviewed: number; is_completed: boolean; reward_claimed: boolean;
      lesson_target: number; quiz_target: number; weakness_target: number; flashcard_target: number;
      correct_answers_today: number; pvp_wins_today: number;
      tier1_claimed: boolean; tier2_claimed: boolean; tier3_claimed: boolean;
    }
    export interface LanguageCourse {
      id: string; name: string; native_name: string; flag: string; description: string;
      theme_class: string; button_class: string; category: string;
      tts_lang_code: string; edge_tts_voice: string | null;
    }
    export interface CurriculumLevel {
      level: string; title: string; description: string;
      base_reward_points: number; topics: string[];
    }
    ```
  - `export function isValidEmail(email: string): boolean` — port dari `dioxus/src/services/auth.rs:16-22` (local ≥1 char, domain mengandung `.`, tidak ada `@` kedua)
  - `export function isValidPassword(pw: string): boolean` — `pw.trim().length >= 6` (pola lama: `password_plain.len() < 6`)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Edit `package.json` → `"scripts"` tambahkan: `"test": "vitest run"`.

- [ ] **Step 2: Tulis tes yang gagal dulu (TDD)**

Create `lib/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword } from "./validation";

describe("isValidEmail", () => {
  it("menerima email normal", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });
  it("menolak tanpa @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });
  it("menolak tanpa dot di domain", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });
  it("menolak double @", () => {
    expect(isValidEmail("a@b@c.com")).toBe(false);
  });
  it("menolak kosong", () => {
    expect(isValidEmail("")).toBe(false);
  });
  it("trim whitespace", () => {
    expect(isValidEmail(" user@example.com ")).toBe(true);
  });
});

describe("isValidPassword", () => {
  it("menerima 6 karakter", () => {
    expect(isValidPassword("abcdef")).toBe(true);
  });
  it("menolak kurang dari 6", () => {
    expect(isValidPassword("abcde")).toBe(false);
  });
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Jalankan tes — harus gagal**

Run: `npm test`
Expected: FAIL — `validation.ts` belum ada ("Failed to resolve import ./validation").

- [ ] **Step 4: Implementasi**

Create `lib/validation.ts`:

```ts
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  const local = parts[0] ?? "";
  const domain = parts[1] ?? "";
  return local.length >= 1 && domain.includes(".") && parts.length === 2 && domain.length >= 2;
}

export function isValidPassword(password: string): boolean {
  return password.trim().length >= 6;
}
```

Create `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Create `lib/types.ts` dengan tipe persis seperti di blok **Interfaces** di atas (salin kode TS dari sana).

- [ ] **Step 5: Jalankan tes — harus lulus**

Run: `npm test`
Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib vitest.config.ts package.json package-lock.json
git commit -m "feat: lib foundation (db singleton, types, validation) with unit tests"
```

---

### Task 5: lib/auth.ts — JWT session (jose) + tes

**Files:**
- Create: `lib/auth.ts`, `lib/auth.test.ts`
- Modify: `package.json` (dependency `jose`)

**Interfaces:**
- Consumes: `lib/types.ts` (Task 4) — tidak wajib untuk sesi; payload sederhana
- Produces:
  ```ts
  export interface SessionUser { email: string; full_name: string; role: string; }
  export const SESSION_COOKIE = "lingomind_session";
  export async function createSessionToken(user: SessionUser): Promise<string>
  export async function verifySessionToken(token: string): Promise<SessionUser | null>
  export async function setSessionCookie(user: SessionUser): Promise<void>
  export async function clearSessionCookie(): Promise<void>
  export async function getSession(): Promise<SessionUser | null>
  ```
  - `getSession()` membaca cookie `lingomind_session` (via `await cookies()` dari `next/headers`), verifikasi JWT, kembalikan payload atau `null` (termasuk jika `AUTH_SECRET` tidak ter-set → kembalikan `null`, jangan throw).

- [ ] **Step 1: Install jose + tulis tes gagal**

```bash
npm install jose
```

Create `lib/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./auth";

const user = { email: "a@b.com", full_name: "Test User", role: "user" };

describe("session token", () => {
  it("round-trip menghasilkan payload sama", async () => {
    const token = await createSessionToken(user);
    const decoded = await verifySessionToken(token);
    expect(decoded).toEqual(user);
  });
  it("menolak token yang diubah", async () => {
    const token = await createSessionToken(user);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });
  it("menolak sampah", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — harus gagal**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL (`auth.ts` belum ada).

- [ ] **Step 3: Implementasi `lib/auth.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface SessionUser {
  email: string;
  full_name: string;
  role: string;
}

export const SESSION_COOKIE = "lingomind_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return new Uint8Array();
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const secret = getSecret();
  if (secret.byteLength === 0) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.email || !payload.full_name || !payload.role) return null;
    return {
      email: payload.email as string,
      full_name: payload.full_name as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
```

Catatan: `cookies()` tidak tersedia di lingkungan vitest (node) — test hanya menyentuh `createSessionToken`/`verifySessionToken` (fungsi murni). `getSecret()` dengan `AUTH_SECRET` kosong → token signature dengan kunci kosong tetap valid untuk round-trip test; aman karena hanya dipakai test.

- [ ] **Step 4: Run test — harus lulus**

Run: `npm test`
Expected: 11 tests PASS (8 lama + 3 baru).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts package.json package-lock.json
git commit -m "feat: jwt session with jose (httpOnly cookie) + tests"
```

---

### Task 6: lib/mail.ts + lib/profile.ts (nodemailer, profil user)

**Files:**
- Create: `lib/mail.ts`, `lib/profile.ts`
- Modify: `package.json` (dependency `nodemailer`, devDependency `@types/nodemailer`)

**Interfaces:**
- Consumes: `db` (Task 4), tipe `UserProfile` (Task 4)
- Produces:
  ```ts
  // lib/mail.ts
  export async function sendMail(to: string, subject: string, text: string): Promise<void>
  // Kirim via SMTP Gmail (SMTP_USERNAME/SMTP_PASSWORD). Jika SMTP_PASSWORD kosong:
  // console.log("====== EMAIL (dev): ", subject, to, text) lalu return (tanpa error).
  // From: `LingoMind <SMTP_USERNAME>`. SMTP_USERNAME default "lingomindid@gmail.com".

  // lib/profile.ts
  export async function getUserProfile(email: string): Promise<UserProfile | null>
  // Load users + user_language_progress; current_level = map {language_id -> `${base_level}.${topic_idx}`}
  // Mengembalikan null jika user tidak ditemukan.
  ```

- [ ] **Step 1: Install**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Implementasi `lib/mail.ts`**

```ts
import nodemailer from "nodemailer";

const DEFAULT_SMTP_USER = "lingomindid@gmail.com";

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const username = process.env.SMTP_USERNAME || DEFAULT_SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!password) {
    console.log(`====== EMAIL (dev, SMTP tidak dikonfigurasi) ======`);
    console.log(`To: ${to} | Subject: ${subject}`);
    console.log(text);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: username, pass: password },
  });

  await transporter.sendMail({
    from: `LingoMind <${username}>`,
    to,
    subject,
    text,
  });
}
```

- [ ] **Step 3: Implementasi `lib/profile.ts`**

```ts
import { db } from "./db";
import type { UserProfile } from "./types";

export async function getUserProfile(email: string): Promise<UserProfile | null> {
  const user = await db.users.findUnique({ where: { email } });
  if (!user) return null;

  const progress = await db.user_language_progress.findMany({ where: { email } });
  const current_level: Record<string, string> = {};
  for (const p of progress) {
    current_level[p.language_id] = `${p.base_level}.${p.topic_idx}`;
  }

  return {
    email: user.email,
    full_name: user.full_name ?? "",
    preferred_language: user.preferred_language ?? "English",
    score: user.score ?? 0,
    current_level,
    role: user.role ?? "user",
  };
}
```

Catatan: nama field di Prisma mengikuti hasil `db pull` (snake_case sesuai kolom). Jika nama kolom Prisma berbeda (misal `passwordHash`), sesuaikan dengan membaca `prisma/schema.prisma`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit`
Expected: tidak ada error. (Tidak ada test unit untuk fungsi DB — diuji manual di Task 9 dashboard.)

- [ ] **Step 5: Commit**

```bash
git add lib/mail.ts lib/profile.ts package.json package-lock.json
git commit -m "feat: mailer (nodemailer) and user profile loader"
```

---

### Task 7: Server actions auth + halaman login/register + middleware

**Files:**
- Create: `lib/actions/auth.ts` ("use server"), `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/layout.tsx`, `middleware.ts`, `components/LoginForm.tsx`, `components/RegisterForm.tsx`
- Modify: `app/layout.tsx` (metadata: title "LingoMind", lang `id`; biarkan globals.css default dulu)

**Interfaces:**
- Consumes: `db` (T4), `isValidEmail`/`isValidPassword` (T4), `createSessionToken`/`setSessionCookie`/`clearSessionCookie`/`getSession` (T5), `sendMail` (T6), `getUserProfile` (T6)
- Produces (semua di `lib/actions/auth.ts`, tipe `useActionState`-friendly — `prev` diabaikan):
  ```ts
  export interface ActionResult { error?: string; message?: string; }
  export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult>
  export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult>
  export async function logoutAction(): Promise<void>
  export async function resendVerificationAction(email: string): Promise<ActionResult>
  ```
  - `registerAction`: validasi (error `Email dan password tidak boleh kosong!` bila kosong; `Format email tidak valid.`; `Password baru minimal harus berukuran 6 karakter.` — catatan: app lama menamai validasi register "Nama lengkap, email wajib diisi dan password minimal 6 karakter." → gunakan pesan lama ini), hash `bcrypt.hash(pw, 10)` (bcryptjs; cost sama dengan bcrypt DEFAULT_COST=10), insert `users` dengan `full_name`, `email` (trim), `password_hash`, `preferred_language: "English"`, `score: 0` → tangkap error unique → `Email sudah digunakan, silakan gunakan email lain.` → token `crypto.randomUUID()`, insert `email_verification_tokens` (expires `new Date(Date.now() + 24*3600*1000)`) → `sendMail` dengan template verifikasi (link `${APP_URL}/verify-email?token=${token}`, APP_URL default `http://localhost:3000`) → return `{ message: "Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa folder Inbox atau Spam." }`
  - `loginAction`: validasi format → cari user → jika null: `Email atau password salah.` → `bcrypt.compare` → jika gagal: `Email atau password salah.` → jika `!is_verified`: `{ error: "UNVERIFIED:Akun Anda belum diverifikasi. Silakan cek email Anda." }` → `setSessionCookie({ email, full_name, role })` → `{ message: "ok" }`
  - `logoutAction`: `clearSessionCookie()` + `redirect("/login")`
  - `resendVerificationAction(email)`: cari user → null: `Email tidak terdaftar.` → sudah verified: `Akun ini sudah diverifikasi.` → delete token lama, insert baru (24 jam), kirim email → `{ message: "Tautan verifikasi telah dikirim ulang ke email Anda." }`
  - `middleware.ts`: `/dashboard` tanpa session → redirect `/login`; `/login`|`/register` dengan session → redirect `/dashboard`

- [ ] **Step 1: Install bcryptjs + tulis middleware**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

Create `middleware.ts` (verifikasi JWT inline dengan jose — JANGAN import dari `lib/auth` karena modul itu mengimpor `next/headers` yang tidak tersedia di middleware/edge runtime):

```ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED_PREFIX = ["/dashboard"];

async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("lingomind_session")?.value;
  const hasSession = token ? await verifyToken(token) : false;
  const { pathname } = req.nextUrl;

  if (PROTECTED_PREFIX.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
```

- [ ] **Step 2: Implementasi `lib/actions/auth.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { isValidEmail, isValidPassword } from "../validation";
import { setSessionCookie, clearSessionCookie } from "../auth";
import { sendMail } from "../mail";
import type { ActionResult } from "./types";

const APP_URL = () => process.env.APP_URL || "http://localhost:3000";

export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const full_name = (formData.get("full_name") as string ?? "").trim();
  const email = (formData.get("email") as string ?? "").trim();
  const password = formData.get("password") as string ?? "";

  if (!full_name || !email || !password) {
    return { error: "Nama lengkap, email wajib diisi dan password minimal 6 karakter." };
  }
  if (!isValidEmail(email)) {
    return { error: "Format email tidak valid." };
  }
  if (!isValidPassword(password)) {
    return { error: "Nama lengkap, email wajib diisi dan password minimal 6 karakter." };
  }

  const password_hash = await bcrypt.hash(password, 10);

  try {
    await db.users.create({
      data: {
        full_name,
        email,
        password_hash,
        preferred_language: "English",
        score: 0,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { error: "Email sudah digunakan, silakan gunakan email lain." };
    }
    throw e;
  }

  const token = crypto.randomUUID();
  await db.email_verification_tokens.create({
    data: { email, token, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verify_link = `${APP_URL()}/verify-email?token=${token}`;
  const subject = "Verifikasi Akun - LingoMind";
  const body = `Halo ${full_name},\n\nTerima kasih telah mendaftar di LingoMind!\n\nSilakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n${verify_link}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(email, subject, body);

  return { message: "Pendaftaran berhasil! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa folder Inbox atau Spam." };
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = (formData.get("email") as string ?? "").trim();
  const password = formData.get("password") as string ?? "";

  if (!email || !password) {
    return { error: "Email dan password tidak boleh kosong!" };
  }
  if (!isValidEmail(email)) {
    return { error: "Format email tidak valid." };
  }

  const user = await db.users.findUnique({ where: { email } });
  if (!user || !user.password_hash) {
    return { error: "Email atau password salah." };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { error: "Email atau password salah." };
  }

  if (!user.is_verified) {
    return { error: "UNVERIFIED:Akun Anda belum diverifikasi. Silakan cek email Anda." };
  }

  await setSessionCookie({
    email: user.email,
    full_name: user.full_name ?? "",
    role: user.role ?? "user",
  });
  return { message: "ok" };
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  const user = await db.users.findUnique({ where: { email: email.trim() } });
  if (!user) return { error: "Email tidak terdaftar." };
  if (user.is_verified) return { error: "Akun ini sudah diverifikasi." };

  await db.email_verification_tokens.deleteMany({ where: { email: user.email } });
  const token = crypto.randomUUID();
  await db.email_verification_tokens.create({
    data: { email: user.email, token, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verify_link = `${APP_URL()}/verify-email?token=${token}`;
  const subject = "Verifikasi Akun - LingoMind";
  const body = `Halo ${user.full_name},\n\nTerima kasih telah mendaftar di LingoMind!\n\nSilakan klik link berikut untuk mengaktifkan akun Anda (berlaku 24 jam):\n${verify_link}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(user.email, subject, body);

  return { message: "Tautan verifikasi telah dikirim ulang ke email Anda." };
}
```

Buat `lib/actions/types.ts`:
```ts
export interface ActionResult {
  error?: string;
  message?: string;
}
```

Catatan: `(formData.get("x") as string ?? "")` — di TypeScript, tulis sebagai `const x = String(formData.get("x") ?? "")` untuk hindari lint error; pola bebas dipakai asal hasil akhir sama (trim + empty check).

- [ ] **Step 3: Implementasi `components/LoginForm.tsx` (client)**

Port dari `dioxus/src/views/login.rs` — struktur + class Tailwind sama. Perilaku:
- `useActionState(loginAction, {})`; state `error`/`message` dari hasil
- Jika `error` dimulai `UNVERIFIED:` → tampilkan pesan tanpa prefix + tombol "Kirim ulang email verifikasi" yang memanggil `resendVerificationAction(email)` lalu tampilkan hasilnya
- Jika `message === "ok"` → `router.push("/dashboard")` via `useEffect`
- Validasi client: email & password kosong → `Email dan password tidak boleh kosong!` (tanpa server call)
- Toggle show/hide password (`HIDE`/`SHOW`), spinner loading "Memverifikasi Akun...", link "Lupa Password?" → `/forgot-password`, "Daftar sekarang" → `/register`, logo dari `public/logo.png` (salin `dioxus/assets/logo.png` → `public/logo.png`)

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { loginAction, resendVerificationAction } from "@/lib/actions/auth";

export default function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);

  const isUnverified = state.error?.startsWith("UNVERIFIED:");
  const errorMsg = state.error?.replace("UNVERIFIED:", "");

  useEffect(() => {
    if (state.message === "ok") router.push("/dashboard");
  }, [state, router]);

  async function handleResend() {
    setResendPending(true);
    const res = await resendVerificationAction(email);
    setResendMsg(res.message ?? `Gagal: ${res.error ?? "terjadi kesalahan"}`);
    setResendPending(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800" />
        <h2 className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2">Welcome Back</h2>
        <p className="text-slate-500/30 dark:text-slate-400 text-sm mb-6 font-medium">Learn English & German powered by Gemini AI</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex flex-col gap-2">
            <div className="flex items-center gap-2">⚠️ {errorMsg}</div>
            {isUnverified && (
              <button type="button" onClick={handleResend} disabled={resendPending}
                className="mt-1 self-start text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:underline bg-transparent border-none cursor-pointer p-0">
                {resendPending ? "Mengirim..." : "Kirim ulang email verifikasi"}
              </button>
            )}
          </div>
        )}

        {resendMsg && (
          <div className="mb-4 p-3 bg-teal-50/30 dark:bg-teal-900/30 border border-teal-200 rounded-lg text-teal-700 dark:text-teal-400 text-xs text-left font-semibold flex items-center gap-2">📩 {resendMsg}</div>
        )}

        <form action={formAction} className="text-left">
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email Anda..." disabled={pending}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline">Lupa Password?</Link>
            </div>
            <div className="relative flex items-center">
              <input type={showPassword ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..." disabled={pending}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={pending}
                className="absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors">
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={pending}
            className={`w-full font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 ${
              pending ? "bg-teal-100 text-teal-800 cursor-not-allowed opacity-80" : "bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30"}`}>
            {pending ? (
              <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" /> Memverifikasi Akun...</span>
            ) : (
              <span>Masuk ke Aplikasi 🚀</span>
            )}
          </button>
        </form>

        <div className="text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
          Belum punya akun?{" "}
          <Link href="/register" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Daftar sekarang</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Halaman login/register + layout auth**

Create `app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

Create `app/(auth)/login/page.tsx`:
```tsx
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

Create `components/RegisterForm.tsx` — port dari `dioxus/src/views/register.rs` dengan pola `useActionState(registerAction, {})`; field `full_name`, `email`, `password`, `confirm_password`. Validasi client (string persis dari `register.rs:46-56`):
- field kosong → `Seluruh kolom input wajib diisi!`
- password < 6 → `Password minimal harus berukuran 6 karakter!`
- `password !== confirm_password` → `Konfirmasi password tidak cocok dengan password utama!`
Sukses → tampilkan kotak hijau berisi `state.message` (tidak redirect; user menunggu verifikasi email). Link balik ke `/login`: "Sudah punya akun? Masuk".

Create `app/(auth)/register/page.tsx`:
```tsx
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return <RegisterForm />;
}
```

Salin logo: `Copy-Item dioxus/assets/logo.png public/logo.png`

- [ ] **Step 5: Update metadata root layout**

Edit `app/layout.tsx`: `<html lang="id">` dan `metadata: { title: "LingoMind", description: "Belajar bahasa asing dengan AI" }` (hapus template default). Biarkan struktur lain default untuk sekarang (Task 9 merapikan dark mode & fonts).

- [ ] **Step 6: Verifikasi**

Run: `npm run lint && npx tsc --noEmit`
Expected: 0 error.
Run: `npm run dev`, buka `http://localhost:3000/login` → halaman login tampil dengan styling gelap/terang sesuai sistem. Coba register dengan email palsu (misal `test@example.com`) → sukses message; cek console dev server: jika `SMTP_PASSWORD` terisi, email benar terkirim (cek folder spam) — untuk dev disarankan coba juga tanpa `SMTP_PASSWORD` untuk melihat fallback console log. Coba login dengan password salah → `Email atau password salah.`; dengan akun unverified → tombol "Kirim ulang email verifikasi". Hapus akun test dari DB via `npx prisma studio` (tabel `users` + `email_verification_tokens`) setelah verifikasi.

- [ ] **Step 7: Commit**

```bash
git add app components middleware.ts lib/actions public/logo.png package.json package-lock.json
git commit -m "feat: auth server actions, login/register pages, middleware"
```

---

### Task 8: Halaman verify-email, forgot-password, reset-password

**Files:**
- Create: `lib/actions/password.ts` ("use server"), `app/(auth)/verify-email/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`, `components/ForgotPasswordForm.tsx`, `components/ResetPasswordForm.tsx`

**Interfaces:**
- Consumes: `db`, `isValidEmail`/`isValidPassword`, `sendMail` (Task 6)
- Produces (di `lib/actions/password.ts`):
  ```ts
  export async function verifyEmailAction(token: string): Promise<ActionResult>
  export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult>
  export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult>
  ```
  - `verifyEmailAction(token)`: cari `email_verification_tokens` dengan `token` + `expires_at > now` → tidak ada: `Token verifikasi tidak valid atau sudah kedaluwarsa.` → `users.update is_verified = true` → delete token user → `{ message: "Akun Anda berhasil diverifikasi! Silakan login." }`
  - `forgotPasswordAction`: email kosong → `{ error: "Email dan password tidak boleh kosong!" }`; cari user → tidak ada: `Email tidak terdaftar di sistem kami.` → delete `password_resets` lama untuk email → insert token `crypto.randomUUID()`, `expires_at = now + 1 jam` → kirim email reset (template `auth.rs:409-417`, link `${APP_URL}/reset-password?token=${token}`) → `{ message: "Instruksi reset password telah dikirim. Periksa email Anda (atau server console untuk testing)." }`
  - `resetPasswordAction`: ambil `token` + `password` dari formData; password < 6 → `Password baru minimal harus berukuran 6 karakter.`; validasi token (sama seperti verify) → `Token reset tidak valid atau sudah kedaluwarsa.` → `users.update password_hash = bcrypt.hash(pw, 10)` → delete `password_resets` email → `{ message: "Password Anda berhasil direset! Silakan login dengan password baru Anda." }`

- [ ] **Step 1: Implementasi `lib/actions/password.ts`**

```ts
"use server";

import bcrypt from "bcryptjs";
import { db } from "../db";
import { isValidPassword } from "../validation";
import { sendMail } from "../mail";
import type { ActionResult } from "./types";

const APP_URL = () => process.env.APP_URL || "http://localhost:3000";

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  const record = await db.email_verification_tokens.findFirst({
    where: { token, expires_at: { gt: new Date() } },
  });
  if (!record) return { error: "Token verifikasi tidak valid atau sudah kedaluwarsa." };

  await db.users.update({ where: { email: record.email }, data: { is_verified: true } });
  await db.email_verification_tokens.deleteMany({ where: { email: record.email } });

  return { message: "Akun Anda berhasil diverifikasi! Silakan login." };
}

export async function forgotPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email dan password tidak boleh kosong!" };
  if (!isValidEmail(email)) return { error: "Format email tidak valid." };

  const user = await db.users.findUnique({ where: { email } });
  if (!user) return { error: "Email tidak terdaftar di sistem kami." };

  await db.password_resets.deleteMany({ where: { email } });
  const token = crypto.randomUUID();
  await db.password_resets.create({
    data: { email, token, expires_at: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const reset_link = `${APP_URL()}/reset-password?token=${token}`;
  const subject = "Reset Password - LingoMind";
  const body = `Halo,\n\nKami menerima permintaan untuk mereset password akun LingoMind Anda.\n\nSilakan klik link berikut untuk mereset password Anda (berlaku selama 1 jam):\n${reset_link}\n\nJika Anda tidak merasa mengajukan ini, abaikan email ini.\n\nSalam,\nLingoMind Team`;
  await sendMail(email, subject, body);

  return { message: "Instruksi reset password telah dikirim. Periksa email Anda (atau server console untuk testing)." };
}

export async function resetPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isValidPassword(password)) {
    return { error: "Password baru minimal harus berukuran 6 karakter." };
  }

  const record = await db.password_resets.findFirst({
    where: { token, expires_at: { gt: new Date() } },
  });
  if (!record) return { error: "Token reset tidak valid atau sudah kedaluwarsa." };

  const password_hash = await bcrypt.hash(password, 10);
  await db.users.update({ where: { email: record.email }, data: { password_hash } });
  await db.password_resets.deleteMany({ where: { email: record.email } });

  return { message: "Password Anda berhasil direset! Silakan login dengan password baru Anda." };
}
```

- [ ] **Step 2: Halaman verify-email (server component)**

Create `app/(auth)/verify-email/page.tsx`:
```tsx
import { verifyEmailAction } from "@/lib/actions/password";
import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailAction(token) : { error: "Token verifikasi tidak valid atau sudah kedaluwarsa." };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <h2 className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mb-3">Verifikasi Email</h2>
        {result.error ? (
          <p className="text-rose-600 dark:text-rose-400 text-sm font-semibold mb-4">⚠️ {result.error}</p>
        ) : (
          <p className="text-teal-700 dark:text-teal-400 text-sm font-semibold mb-4">✅ {result.message}</p>
        )}
        <Link href="/login" className="inline-block w-full font-bold py-3 px-4 rounded-xl transition-all text-sm bg-teal-500 hover:bg-teal-600 text-white shadow-md">
          Masuk ke Aplikasi
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Forgot + reset password forms & pages**

Create `components/ForgotPasswordForm.tsx` — port dari `dioxus/src/views/forgot_password.rs`: satu input email + tombol "Kirim Link Reset"; `useActionState(forgotPasswordAction, {})`; sukses → kotak hijau `state.message`; link balik "/login".

Create `app/(auth)/forgot-password/page.tsx`:
```tsx
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
```

Create `components/ResetPasswordForm.tsx` — port dari `dioxus/src/views/reset_password.rs`: menerima prop `token: string`, hidden input `token`, input password + konfirmasi (validasi client cocok), `useActionState(resetPasswordAction, {})`; sukses → pesan hijau + link login.

Create `app/(auth)/reset-password/page.tsx`:
```tsx
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <p className="text-center text-rose-500 p-8">Token reset tidak valid atau sudah kedaluwarsa.</p>;
  }
  return <ResetPasswordForm token={token} />;
}
```

- [ ] **Step 4: Verifikasi**

Run: `npm run lint && npx tsc --noEmit` — 0 error.
Manual (dengan `SMTP_PASSWORD` kosong di .env untuk dev): buka `/forgot-password`, input email terdaftar → lihat link reset di console dev server → buka link → set password baru (min 6) → sukses → login dengan password baru. Ulangi dengan email tidak terdaftar → `Email tidak terdaftar di sistem kami.`. Buka `/verify-email?token=abc` → error token.

- [ ] **Step 5: Commit**

```bash
git add app components lib/actions
git commit -m "feat: verify-email, forgot/reset password pages and actions"
```

---

### Task 9: Layout root + navbar + dark mode (port dari app lama)

**Files:**
- Modify: `app/layout.tsx` (inline script anti-flash dark mode di `<head>`, fonts default), `app/globals.css` (custom variant dark Tailwind v4)
- Create: `components/ThemeToggle.tsx`, `components/Navbar.tsx`, `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getSession` (T5)
- Produces:
  - `components/Navbar.tsx` — client component dengan props `{ full_name: string; score: number; email: string }`; menampilkan logo+kata "LingoMind", badge `🔥 {score} pts`, tombol tema, tombol logout (panggil `logoutAction`), navigasi hanya ke halaman yang ADA di fase 1 (`/dashboard`); item menu lain (Kurikulum, Leaderboard, Analisis, Panduan, Toko) DILEWATI sampai halamannya ada.
  - `app/(app)/layout.tsx` — server component: `getSession()` → `redirect("/login")` jika null → render `<Navbar .../>` + `{children}`
  - `components/ThemeToggle.tsx` — client: baca `localStorage["lingomind_theme"]` saat mount, toggle `.dark` di `document.documentElement`, persist key

- [ ] **Step 1: Inline script anti-flash + dark variant di globals.css**

Edit `app/layout.tsx` — di dalam `<html lang="id">`, tambahkan di `<head>`:
```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{if(localStorage.getItem('lingomind_theme')==='dark'||(!('lingomind_theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
  }}
/>
```
(Logika sama persis dengan `dioxus/src/components/app.rs:173-179`.)

Edit `app/globals.css` — tambahkan di bagian atas (setelah `@import "tailwindcss";`):
```css
@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Step 2: ThemeToggle + Navbar**

Create `components/ThemeToggle.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("lingomind_theme");
    setDark(stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("lingomind_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-base"
      aria-label="Ganti tema"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
```

Create `components/Navbar.tsx` — port struktur `dioxus/src/components/navbar.rs:50-263` (header fixed, backdrop-blur, logo kiri). Navigasi kanan fase 1:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { logoutAction } from "@/lib/actions/auth";

interface NavbarProps {
  full_name: string;
  score: number;
  email: string;
}

export default function Navbar({ full_name, score, email }: NavbarProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const tabClass = (active: boolean) =>
    active
      ? "text-teal-600 dark:text-teal-400 font-bold transition-colors"
      : "text-slate-600/50 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 font-bold transition-colors";

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="LingoMind Logo" className="w-8 h-8 rounded-xl shadow-sm object-cover border border-slate-100 dark:border-slate-800" />
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">LingoMind</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className={tabClass(isDashboard)}>Beranda</Link>
            <div className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 shadow-sm flex items-center gap-1">
              <span>🔥</span>
              <span>{score} pts</span>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <button type="submit" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
```

Catatan: `logoutAction` dipanggil dari form action → redirect otomatis ke `/login`. `full_name`/`email` belum dipakai di fase 1 (dipakai fase profile) — boleh dihilangkan dari props bila lint warning; keputusan di tangan implementer asal konsisten.

- [ ] **Step 3: Layout area aplikasi (dengan navbar) + lindungi dashboard**

Create `app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import Navbar from "@/components/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await getUserProfile(session.email);
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <Navbar full_name={profile.full_name} score={profile.score} email={profile.email} />
      <main className="pt-16">{children}</main>
    </div>
  );
}
```

Buat `app/(app)/dashboard/page.tsx` sementara (Task 10 mengisi penuh):
```tsx
export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>
      <p className="text-slate-500 dark:text-slate-400">Dalam pembangunan (Fase 1).</p>
    </div>
  );
}
```

- [ ] **Step 4: Verifikasi**

Run: `npm run lint && npx tsc --noEmit` — 0 error.
Run: `npm run dev`. Buka `/login` → halaman terang/gelap mengikuti preferensi sistem. Login dengan akun user lama (sudah verified) → diarahkan `/dashboard`, navbar tampil dengan badge poin benar. Klik toggle tema → seluruh halaman berganti + localStorage `lingomind_theme` ter-set; refresh → tema bertahan; buka tab baru → `/login` langsung sesuai tema (script anti-flash). Klik "Keluar" → kembali `/login`, cookie hilang (cek DevTools → Application → Cookies).

- [ ] **Step 5: Commit**

```bash
git add app components
git commit -m "feat: root layout with dark mode, navbar, protected app layout"
```

---

### Task 10: Dashboard halaman (statistik, misi harian, kurikulum, flashcard due, ganti bahasa)

**Files:**
- Create: `lib/dashboard.ts` (fungsi server data), `lib/hearts.test.ts` (unit test), `components/LanguageSwitcher.tsx`, `lib/actions/dashboard.ts` ("use server")
- Modify: `app/(app)/dashboard/page.tsx` (isi penuh)

**Interfaces:**
- Consumes: `db` (T4), tipe `EngagementStats`/`DailyMission`/`LanguageCourse`/`CurriculumLevel` (T4), `getSession` (T5)
- Produces:
  ```ts
  // lib/dashboard.ts (fungsi murni + akses DB, dipanggil server component)
  export function computeHeartRefill(hearts: number, lastRefill: Date | null, now: Date): { hearts: number; lastRefill: Date | null }
  // Port persis engagement.rs:111-148: jika hearts < 5 dan lastRefill != null dan diff >= 4 jam:
  //   hearts += floor(diff/4); hearts = min(5, hearts); jika 5 → lastRefill = null; else lastRefill += (n*4) jam
  // jika hearts < 5 dan lastRefill == null → lastRefill = now (jangan update hearts)
  export async function getEngagementStats(email: string): Promise<EngagementStats | null>
  // SELECT row user_engagement_stats → jalankan computeHeartRefill(hearts, last_heart_refill, new Date())
  // → jika berubah, UPDATE hearts + last_heart_refill; return objek (default 0 bila null → null)
  export async function getDailyMission(email: string, language: string): Promise<DailyMission>
  // Port mission.rs:5-110: due flashcard count, weakness count 7d (weakness_logs),
  // config mission_config WHERE name='Daily Standard' (fallback 1,1,3,5,15),
  // flash_target = due<=0 ? min : min(due,max); weakness_target = weak_7d>=10 ? base+2 : base
  // upsert user_daily_missions (CURRENT_DATE), auto-complete check, return DailyMission
  export async function getDueFlashcardCount(email: string, language: string): Promise<number>
  export async function getLanguages(): Promise<LanguageCourse[]>
  export async function getCurriculum(): Promise<CurriculumLevel[]>
  // languages/levels+topics via prisma, urutan sama (order by name / order_index)

  // lib/actions/dashboard.ts
  export async function updatePreferredLanguageAction(languageId: string): Promise<ActionResult>
  // Port update_preferred_language_server: cek bahasa ada (case-insensitive via findFirst where id equalsIgnoreCase? → pakai findMany + compare toLowerCase),
  // update users.preferred_language, return { message: "ok" }
  ```

- [ ] **Step 1: Tulis tes heart refill (TDD) — harus gagal**

Create `lib/hearts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeHeartRefill } from "./dashboard";

const base = new Date("2026-07-31T08:00:00Z");

describe("computeHeartRefill", () => {
  it("tidak refill jika full", () => {
    const r = computeHeartRefill(5, new Date("2026-07-30T00:00:00Z"), base);
    expect(r).toEqual({ hearts: 5, lastRefill: new Date("2026-07-30T00:00:00Z") });
  });
  it("refill 1 heart setelah 4 jam", () => {
    const last = new Date("2026-07-31T04:00:00Z");
    const r = computeHeartRefill(4, last, base);
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
  it("refill 2 hearts setelah 8 jam (kapasitas 3→5)", () => {
    const last = new Date("2026-07-31T00:00:00Z");
    const r = computeHeartRefill(3, last, base);
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
  it("tetap 1 heart jika belum 4 jam", () => {
    const last = new Date("2026-07-31T07:30:00Z");
    const r = computeHeartRefill(2, last, base);
    expect(r.hearts).toBe(2);
    expect(r.lastRefill).toBe(last);
  });
  it("set lastRefill ke now jika null dan kurang dari 5", () => {
    const r = computeHeartRefill(3, null, base);
    expect(r.hearts).toBe(3);
    expect(r.lastRefill).toEqual(base);
  });
  it("advance lastRefill saat refill parsial (kapasitas 4→5 butuh 2 heart = 8 jam)", () => {
    const last = new Date("2026-07-31T00:00:00Z");
    const r = computeHeartRefill(4, last, new Date("2026-07-31T20:00:00Z")); // 20 jam > 8 jam butuh
    expect(r.hearts).toBe(5);
    expect(r.lastRefill).toBeNull();
  });
});
```

- [ ] **Step 2: Run — harus gagal, lalu implementasi `lib/dashboard.ts`**

Run: `npx vitest run lib/hearts.test.ts` → FAIL (fungsi belum ada).

Create `lib/dashboard.ts`:

```ts
import { db } from "./db";
import type { CurriculumLevel, DailyMission, EngagementStats, LanguageCourse } from "./types";

export function computeHeartRefill(
  hearts: number,
  lastRefill: Date | null,
  now: Date
): { hearts: number; lastRefill: Date | null } {
  if (hearts >= 5 || lastRefill === null) {
    if (hearts < 5 && lastRefill === null) {
      return { hearts, lastRefill: now };
    }
    return { hearts, lastRefill };
  }
  const diffHours = Math.floor((now.getTime() - lastRefill.getTime()) / (60 * 60 * 1000));
  if (diffHours < 4) return { hearts, lastRefill };

  const heartsToAdd = Math.floor(diffHours / 4);
  const newHearts = Math.min(5, hearts + heartsToAdd);
  if (newHearts === 5) return { hearts: newHearts, lastRefill: null };

  const advanced = new Date(lastRefill.getTime() + heartsToAdd * 4 * 60 * 60 * 1000);
  return { hearts: newHearts, lastRefill: advanced };
}

export async function getEngagementStats(email: string): Promise<EngagementStats | null> {
  const row = await db.user_engagement_stats.findUnique({ where: { email } });
  if (!row) return null;

  const now = new Date();
  const { hearts, lastRefill } = computeHeartRefill(row.hearts ?? 0, row.last_heart_refill, now);
  if (hearts !== (row.hearts ?? 0) || lastRefill?.getTime() !== row.last_heart_refill?.getTime()) {
    await db.user_engagement_stats.update({
      where: { email },
      data: { hearts, last_heart_refill: lastRefill },
    });
  }

  return {
    current_streak: row.current_streak ?? 0,
    longest_streak: row.longest_streak ?? 0,
    total_quiz_completed: row.total_quiz_completed ?? 0,
    total_points_earned: row.total_points_earned ?? 0,
    coins: row.coins ?? 0,
    streak_freezes: row.streak_freezes ?? 0,
    previous_streak: row.previous_streak ?? 0,
    double_xp_until: row.double_xp_until,
    exam_retake_tickets: row.exam_retake_tickets ?? 0,
    hearts,
    last_heart_refill: lastRefill,
  };
}

export async function getDueFlashcardCount(email: string, language: string): Promise<number> {
  return db.flashcards.count({
    where: { email, language, due_at: { lte: new Date() } },
  });
}

export async function getDailyMission(email: string, language: string): Promise<DailyMission> {
  const dueCount = await getDueFlashcardCount(email, language);
  const weak7d = await db.weakness_logs.count({
    where: { email, language, created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  let lesson_target = 1;
  let quiz_target = 1;
  let baseWeaknessTarget = 3;
  let fcMin = 5;
  let fcMax = 15;

  const cfg = await db.mission_config.findFirst({ where: { name: "Daily Standard" } });
  if (cfg) {
    lesson_target = cfg.lesson_target ?? lesson_target;
    quiz_target = cfg.quiz_target ?? quiz_target;
    baseWeaknessTarget = cfg.weakness_target ?? baseWeaknessTarget;
    fcMin = cfg.flashcard_target_min ?? fcMin;
    fcMax = cfg.flashcard_target_max ?? fcMax;
  }

  const flashTarget = dueCount <= 0 ? fcMin : Math.min(dueCount, fcMax);
  const weaknessTarget = weak7d >= 10 ? baseWeaknessTarget + 2 : baseWeaknessTarget;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.user_daily_missions.upsert({
    where: { email_date: { email, date: today } },
    create: { email, date: today },
    update: {},
  });

  const row = await db.user_daily_missions.findUnique({
    where: { email_date: { email, date: today } },
  });

  let isCompleted = row?.is_completed ?? false;
  if (!isCompleted && (row?.lessons_completed ?? 0) >= lesson_target && (row?.quizzes_completed ?? 0) >= quiz_target &&
      (row?.weakness_practices_completed ?? 0) >= weaknessTarget && (row?.flashcards_reviewed ?? 0) >= flashTarget) {
    isCompleted = true;
    await db.user_daily_missions.update({
      where: { email_date: { email, date: today } },
      data: { is_completed: true },
    });
  }

  return {
    lessons_completed: row?.lessons_completed ?? 0,
    quizzes_completed: row?.quizzes_completed ?? 0,
    weakness_practices_completed: row?.weakness_practices_completed ?? 0,
    flashcards_reviewed: row?.flashcards_reviewed ?? 0,
    is_completed: isCompleted,
    reward_claimed: row?.reward_claimed ?? false,
    lesson_target,
    quiz_target,
    weakness_target: weaknessTarget,
    flashcard_target: flashTarget,
    correct_answers_today: row?.correct_answers_today ?? 0,
    pvp_wins_today: row?.pvp_wins_today ?? 0,
    tier1_claimed: row?.tier1_claimed ?? false,
    tier2_claimed: row?.tier2_claimed ?? false,
    tier3_claimed: row?.tier3_claimed ?? false,
  };
}

export async function getLanguages(): Promise<LanguageCourse[]> {
  const rows = await db.languages.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({
    id: r.id, name: r.name, native_name: r.native_name, flag: r.flag,
    description: r.description, theme_class: r.theme_class, button_class: r.button_class,
    category: r.category, tts_lang_code: r.tts_lang_code, edge_tts_voice: r.edge_tts_voice,
  }));
}

export async function getCurriculum(): Promise<CurriculumLevel[]> {
  const levels = await db.levels.findMany({ orderBy: { order_index: "asc" } });
  const topics = await db.topics.findMany({ orderBy: { order_index: "asc" } });
  return levels.map((l) => ({
    level: l.id,
    title: l.title,
    description: l.description,
    base_reward_points: l.base_reward_points,
    topics: topics.filter((t) => t.level_id === l.id).map((t) => t.title),
  }));
}
```

Catatan: nama field Prisma & nama constraint komposit `email_date` mengikuti hasil `db pull` — periksa `prisma/schema.prisma` (bagian `user_daily_missions`), sesuaikan jika berbeda (misal `@@id([email, date])` → generated name `email_date`).

- [ ] **Step 3: Run test heart — harus lulus**

Run: `npm test`
Expected: 17 tests PASS (11 lama + 6 baru).

- [ ] **Step 4: Action ganti bahasa (memakai session)**

Create `lib/actions/dashboard.ts`:
```ts
"use server";

import { getSession } from "../auth";
import { db } from "../db";
import type { ActionResult } from "./types";

export async function updatePreferredLanguageAction(languageId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };

  const lang = await db.languages.findMany();
  const found = lang.find((l) => l.id.toLowerCase() === languageId.trim().toLowerCase());
  if (!found) return { error: "Bahasa tidak valid." };

  await db.users.update({
    where: { email: session.email },
    data: { preferred_language: found.id },
  });
  return { message: "ok" };
}
```

- [ ] **Step 5: Halaman dashboard penuh + LanguageSwitcher**

Create `components/LanguageSwitcher.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePreferredLanguageAction } from "@/lib/actions/dashboard";
import type { LanguageCourse } from "@/lib/types";

export default function LanguageSwitcher({
  initial,
  languages,
}: {
  initial: string;
  languages: LanguageCourse[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: string) {
    setSelected(value);
    setError(null);
    const res = await updatePreferredLanguageAction(value);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
      >
        {languages.map((l) => (
          <option key={l.id} value={l.id}>
            {l.flag} {l.native_name} — {l.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
```

Ganti isi `app/(app)/dashboard/page.tsx` (server component) — struktur kartu diport dari `dioxus/src/views/dashboard.rs` (bagian header statistik); konten data:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getDailyMission, getDueFlashcardCount, getEngagementStats, getLanguages } from "@/lib/dashboard";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [profile, stats, languages] = await Promise.all([
    getUserProfile(session.email),
    getEngagementStats(session.email),
    getLanguages(),
  ]);
  if (!profile) redirect("/login");

  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";

  const [curriculum, mission, dueCount] = await Promise.all([
    getCurriculum(),
    getDailyMission(session.email, langId),
    getDueFlashcardCount(session.email, langId),
  ]);

  const currentLevel = profile.current_level[langId] ?? "A1.0";
  const baseLevel = currentLevel.split(".")[0] ?? "A1";
  const topicIdx = Number(currentLevel.split(".")[1] ?? 0);
  const level = curriculum.find((c) => c.level === baseLevel);
  const nextTopic = level?.topics[topicIdx] ?? "Belajar";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Halo, {profile.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Lanjutkan belajar {langId} — {level?.title ?? baseLevel}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <LanguageSwitcher initial={langId} languages={languages} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Streak</p>
          <p className="text-2xl font-black text-orange-500 mt-1">🔥 {stats?.current_streak ?? 0} hari</p>
          <p className="text-[11px] text-slate-400 mt-1">Terpanjang: {stats?.longest_streak ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koin</p>
          <p className="text-2xl font-black text-amber-500 mt-1">🪙 {stats?.coins ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">Total {stats?.total_points_earned ?? 0} pts</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nyawa</p>
          <p className="text-2xl font-black text-rose-500 mt-1">❤️ {stats?.hearts ?? 0}/5</p>
          <p className="text-[11px] text-slate-400 mt-1">1 per 4 jam</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skor</p>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">⭐ {profile.score}</p>
          <p className="text-[11px] text-slate-400 mt-1">{baseLevel}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold mb-3">Misi Harian</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>📚 Pelajaran ({mission.lessons_completed}/{mission.lesson_target})</span>
            </li>
            <li className="flex justify-between">
              <span>📝 Kuis ({mission.quizzes_completed}/{mission.quiz_target})</span>
            </li>
            <li className="flex justify-between">
              <span>🎯 Latihan kelemahan ({mission.weakness_practices_completed}/{mission.weakness_target})</span>
            </li>
            <li className="flex justify-between">
              <span>🃏 Flashcard ({mission.flashcards_reviewed}/{mission.flashcard_target})</span>
            </li>
            <li className="flex justify-between font-bold">
              <span>Status</span>
              <span className={mission.is_completed ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}>
                {mission.is_completed ? "✅ Selesai" : "⏳ Belum"}
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold mb-3">Lanjutkan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Topik berikutnya: <span className="font-bold text-slate-800 dark:text-slate-200">{nextTopic}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            🃏 {dueCount} flashcard menunggu review
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Level {level?.title ?? baseLevel}: {level?.topics.join(" · ") ?? ""}
          </p>
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold mb-3">Kurikulum ({langId})</h2>
        <div className="space-y-4">
          {curriculum.map((c) => (
            <div key={c.level} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm">{c.level} — {c.title}</p>
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">{c.base_reward_points} pts</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{c.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.topics.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Catatan: misi harian dipanggil dengan `langId` (bukan `""`) karena query weakness & due flashcard memakai bahasa.

- [ ] **Step 6: Verifikasi**

Run: `npm run lint && npx tsc --noEmit` — 0 error.
Run: `npm test` — semua pass.
Manual: `npm run dev` → login akun lama → dashboard menampilkan streak/koin/nyawa/skor yang cocok dengan DB (cek via prisma studio); ganti bahasa via dropdown → halaman refresh → kartu kurikulum & "Lanjutkan" menyesuaikan; nyawa menampilkan hasil refill logic; misi harian menampilkan progres hari ini.

- [ ] **Step 7: Commit**

```bash
git add lib components app
git commit -m "feat: dashboard with stats, daily mission, curriculum, language switcher"
```

---

### Task 11: AI SDK — provider opencode.ai + smoke test di dashboard

**Files:**
- Create: `lib/ai.ts`, `lib/actions/ai.ts` ("use server"), `components/AiStatus.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (tambah kartu "AI Siap")

**Interfaces:**
- Consumes: `getSession` (T5)
- Produces:
  ```ts
  // lib/ai.ts
  export const model: OpenAICompatibleProviderModel  // (tipe dari @ai-sdk/openai-compatible)
  // lib/actions/ai.ts
  export async function testAiAction(): Promise<{ ok: boolean; text?: string; error?: string }>
  ```

- [ ] **Step 1: Install AI SDK + tulis provider**

```bash
npm install ai @ai-sdk/openai-compatible
```

Create `lib/ai.ts`:
```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const baseURL = (process.env.OPENCODE_AI_ENDPOINT || "https://opencode.ai/go/v1/chat/completions").replace(
  /\/chat\/completions$/,
  ""
);

export const provider = createOpenAICompatible({
  name: "opencode-ai",
  apiKey: process.env.OPENCODE_AI_API_KEY,
  baseURL,
});

export const model = provider(process.env.OPENCODE_AI_MODEL || "deepseek-v4-flash");
```

Catatan: `baseURL` tanpa suffix `/chat/completions` (SDK menambahkannya sendiri). Jika env tidak ter-set, provider tetap terbuat (panggilan akan gagal saat dipakai — ditangani di server action).

- [ ] **Step 2: Server action smoke test**

Create `lib/actions/ai.ts`:
```ts
"use server";

import { generateText } from "ai";
import { getSession } from "../auth";
import { model } from "../ai";

export async function testAiAction(): Promise<{ ok: boolean; text?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi berakhir. Silakan login kembali." };

  try {
    const { text } = await generateText({
      model,
      prompt: "Balas dengan tepat satu kata: siap",
      maxTokens: 20,
    });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi AI." };
  }
}
```

- [ ] **Step 3: Widget client + pasang di dashboard**

Create `components/AiStatus.tsx`:
```tsx
"use client";

import { useState } from "react";
import { testAiAction } from "@/lib/actions/ai";

export default function AiStatus() {
  const [state, setState] = useState<{ pending: boolean; result?: string; error?: string }>({ pending: false });

  async function run() {
    setState({ pending: true });
    const res = await testAiAction();
    setState({ pending: false, result: res.ok ? res.text : undefined, error: res.ok ? undefined : res.error });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state.pending}
        className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-colors"
      >
        {state.pending ? "Memeriksa..." : "Cek AI"}
      </button>
      {state.result && <span className="text-xs font-bold text-teal-600 dark:text-teal-400">AI siap: {state.result}</span>}
      {state.error && <span className="text-xs font-bold text-rose-500 max-w-xs truncate">{state.error}</span>}
    </div>
  );
}
```

Edit `app/(app)/dashboard/page.tsx` — tambahkan di bawah header (sebelum grid statistik):
```tsx
<div className="flex justify-end">
  <AiStatus />
</div>
```
+ import `AiStatus from "@/components/AiStatus";`

- [ ] **Step 4: Verifikasi**

Run: `npm run lint && npx tsc --noEmit` — 0 error.
Manual: `npm run dev` → dashboard → klik "Cek AI" → tampil "AI siap: siap" (pastikan `OPENCODE_AI_API_KEY` terisi di `.env`; jika gagal, error dari provider tampil di widget).

- [ ] **Step 5: Commit**

```bash
git add lib components app package.json package-lock.json
git commit -m "feat: ai sdk provider (opencode.ai) with dashboard smoke test"
```

---

### Task 12: AGENTS.md baru + verifikasi final

**Files:**
- Rewrite: `AGENTS.md` (root — untuk repo Next.js)
- Create: `README.md` (ringkas: cara jalankan, struktur, status migrasi)
- Modify: `dioxus/AGENTS.md` (header kecil: "Legacy Dioxus app — referensi hanya; gunakan root AGENTS.md untuk pengembangan aktif") — cukup tambah 2-3 baris di atas file lama, jangan rombak isi.

**Interfaces:**
- Consumes: semua task sebelumnya
- Produces: instruksi yang akurat untuk session opencode berikutnya

- [ ] **Step 1: Tulis root `AGENTS.md`**

Ganti seluruh isi `AGENTS.md` dengan konten ringkas berikut (perbaiki bila ada perbedaan dari kenyataan setelah implementasi):

```markdown
# LingoMind

Aplikasi belajar bahasa. **Fase 1 migrasi dari Dioxus ke Next.js sedang berlangsung** — aplikasi aktif (Next.js) ada di root; aplikasi lama di `dioxus/` (referensi; masih live di production sampai cutover).

## Perintah

- Dev: `npm run dev` (http://localhost:3000)
- Verify: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` (vitest — hanya lib murni)
- DB: `npm run db:pull`, `npm run db:generate`, `npm run db:status`, `npm run db:check` (cek koneksi), `npx prisma studio`
- Legacy Dioxus (referensi saja, tidak dikembangkan): `cargo check --features server` di dalam `dioxus/`

## Lingkungan (.env di root — jangan commit)

- `DATABASE_URL` — Neon PostgreSQL (skema dipakai bersama aplikasi lama; **jangan ubah skema** — Prisma punya baseline migration no-op `prisma/migrations/0_baseline`)
- `AUTH_SECRET` — jose JWT (cookie httpOnly `lingomind_session`, 30 hari)
- `SMTP_USERNAME`/`SMTP_PASSWORD` (Gmail app password) — tanpa password, email dicetak ke console server (mode dev)
- `APP_URL` (default `http://localhost:3000`)
- `OPENCODE_AI_API_KEY`/`OPENCODE_AI_ENDPOINT` (suffix `/chat/completions` di-strip di `lib/ai.ts`)/`OPENCODE_AI_MODEL` — Vercel AI SDK

## Arsitektur

- `app/(auth)/*` — login, register, verify-email, forgot/reset password (tanpa navbar)
- `app/(app)/*` — area berlogin; layout melindungi via `getSession()` + `middleware.ts` juga melindungi `/dashboard`
- `lib/` — `db.ts` (Prisma singleton), `auth.ts` (JWT + `getSession()`), `profile.ts`, `mail.ts`, `dashboard.ts` (logika data), `validation.ts`, `ai.ts`; `lib/actions/*` = server actions (pengganti `#[server]` fn Dioxus)
- `prisma/schema.prisma` — hasil introspect skema Neon (~40 tabel); sumber kebenaran; tambah model per fase
- `dioxus/` — aplikasi lama utuh (Dioxus 0.7 + sqlx migrations di `dioxus/migrations/`). Sumber referensi perilaku & pesan error (Indonesia)

## Konvensi

- UI & pesan error **bahasa Indonesia**; string error lama wajib dipertahankan (lihat `lib/actions/*`)
- Setiap server action yang butuh user memanggil `getSession()` — jangan pakai parameter email dari client
- Dark mode: class `.dark` di `<html>`, key localStorage `lingomind_theme` (konsisten dengan aplikasi lama)
- Jangan commit `.env`; `test_smtp.rs` di `dioxus/` berisi password SMTP keras (rahasia)

## Status migrasi

Fase 1 selesai: auth lengkap + dashboard ringkas + AI SDK setup. Belum: quiz/lesson/chat/story/TTS/pronunciation (fase 2-3), gamifikasi (fase 4), admin (fase 5), cron + deploy Vercel + cutover (fase 6). Spec: `docs/superpowers/specs/2026-07-31-lingomind-nextjs-migration-phase1-design.md`.
```

- [ ] **Step 2: Tulis `README.md` root ringkas**

```markdown
# LingoMind

Aplikasi belajar bahasa (Next.js App Router + Prisma + Neon + Tailwind). Migrasi dari Dioxus sedang berlangsung; aplikasi lama di `dioxus/`.

## Menjalankan

1. Salin `.env.example` → `.env`, isi `DATABASE_URL`, `AUTH_SECRET`, `OPENCODE_AI_*` (dan `SMTP_PASSWORD` bila mau email sungguhan).
2. `npm install`
3. `npm run db:generate` (client Prisma; baseline migration sudah applied)
4. `npm run dev` → http://localhost:3000

## Verifikasi

`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

## Status

Fase 1 (auth + dashboard) selesai. Lihat `docs/superpowers/specs/` untuk rancangan fase.
```

- [ ] **Step 3: Tambah header legacy di `dioxus/AGENTS.md`**

Tambahkan di baris paling atas `dioxus/AGENTS.md`:
```markdown
> **LEGACY (referensi)** — Aplikasi Dioxus LingoMind. Tidak dikembangkan aktif; dipakai sebagai sumber perilaku & pesan error untuk migrasi Next.js di root repo. Baca `AGENTS.md` di root untuk panduan repo aktif.
```

- [ ] **Step 4: Verifikasi final menyeluruh**

Run (urutan wajib, semua harus sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Run: `npx prisma migrate status` — "up to date".
Manual smoke: `npm run dev` → register akun baru (hapus setelahnya via prisma studio) → buka link verifikasi dari console → login → dashboard tampil dengan data → ganti bahasa → cek AI → logout. Login akun user lama → semua data lama tampil.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md dioxus/AGENTS.md
git commit -m "docs: rewrite AGENTS.md and README for next.js phase 1"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. Pindah Dioxus | `git status` semua rename; root bersih |
| 2. Scaffold Next.js | `npm run dev` menampilkan halaman default |
| 3. Prisma baseline | `prisma migrate status` up to date; `db:check` = 26 bahasa |
| 4. lib fondasi | 8 unit test lulus |
| 5. JWT session | 11 unit test lulus (3 baru) |
| 6. Mail + profile | `tsc --noEmit` bersih |
| 7. Auth actions + login/register | smoke manual: register, login salah, UNVERIFIED + resend |
| 8. Verify/forgot/reset | smoke manual: reset password via console link |
| 9. Layout + navbar + dark mode | smoke manual: tema persist, navbar, logout |
| 10. Dashboard | 17 unit test lulus; smoke manual data nyata + ganti bahasa |
| 11. AI SDK | smoke manual: "AI siap: siap" |
| 12. AGENTS.md + final | lint + tsc + test + build + migrate status semua lulus |

## Catatan risiko

- **Nama field Prisma**: hasil `db pull` bisa memberi nama field berbeda dari asumsi di atas (misal `user_language_progress` → field `base_level`). Selalu cek `prisma/schema.prisma` saat query gagal dan sesuaikan nama field, bukan logika.
- **create-next-app prompt**: versi terbaru mungkin bertanya beberapa opsi; jawab default. Jika CLI gagal di folder non-kosong, dokumentasikan outputnya dan pindahkan sementara `docs/` + `dioxus/` keluar repo, scaffold, lalu pindah balik (jangan commit hasil pindahan itu).
- **App lama masih live**: jangan pernah menjalankan `prisma migrate dev --name ...` (akan mencoba alter skema); kalau perlu perubahan skema di fase berikutnya, itu dilakukan di fase tersendiri setelah cutover.
