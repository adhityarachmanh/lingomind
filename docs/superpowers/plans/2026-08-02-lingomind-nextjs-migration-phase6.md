# LingoMind Fase 6 — Cron Reminder + Deploy — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan migrasi LingoMind: cron pengingat harian (Vercel Cron, port `cron.rs`), polish kecil (link toko di exam), persiapan deploy (env/AGENTS), dan push ke origin main.

**Architecture:** Route handler `/api/cron/daily-reminder` di-Vercel-Cron-kan via `vercel.json` (jadwal `0 1 * * *` UTC = 08:00 WIB), guard header `Authorization: Bearer ${CRON_SECRET}`. Logika murni `buildReminderBody` (TDD) + `sendDailyReminders` (query + send via `lib/mail.ts`, template persis `cron.rs`). Push dilakukan controller SETELAH semua review bersih.

**Tech Stack:** Next.js 16 App Router (route handler), Prisma 7, nodemailer (lib/mail.ts), vitest, vercel.json (crons).

**Referensi kode lama (sumber kebenaran):**
- `dioxus/src/services/cron.rs` (query + template email persis)

## Global Constraints

- **Template email dan subject PERSIS** legacy (dikutip tiap task); pesan log juga persis.
- **Prisma**: `UserEngagementStat` TANPA relasi ke User (schema tanpa FK) — gabung manual di JS.
- **Jangan commit `.env`**; **jangan jalankan `npm run dev`**; fire-and-forget selalu `.catch(() => {})`.
- **Tanpa perubahan skema/migration**; `npx prisma migrate status` tetap up to date.
- Route handler cron TIDAK butuh getSession (system-to-system) — guard via CRON_SECRET.
- Jangan kirim email nyata saat smoke (SMTP_PASSWORD kosong di test → fallback log).

---

### Task 1: lib/reminder.ts — buildReminderBody (TDD) + sendDailyReminders

**Files:**
- Create: `lib/reminder.ts`, `lib/reminder.test.ts`

**Interfaces:**
- Consumes: `db`, `sendMail` (lib/mail.ts)
- Produces:
  ```ts
  // lib/reminder.ts
  export function buildReminderBody(input: {
    fullName: string; currentStreak: number; dueFlashcards: number; appUrl: string;
  }): string
  export async function sendDailyReminders(): Promise<{ sent: number; skipped: boolean }>
  // skipped=true bila SMTP_PASSWORD kosong (log + return tanpa error)
  ```

- [ ] **Step 1: Tulis tes gagal**

Create `lib/reminder.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildReminderBody } from "./reminder";

describe("buildReminderBody", () => {
  it("streak > 0 + due > 0", () => {
    const body = buildReminderBody({ fullName: "Andi", currentStreak: 5, dueFlashcards: 3, appUrl: "https://app.com" });
    expect(body).toContain("Hai Andi,");
    expect(body).toContain("Hebat! Pertahankan streak 5 harimu!");
    expect(body).toContain("Ada 3 kosakata yang hampir terlupakan");
    expect(body).toContain("https://app.com");
    expect(body).toContain("Salam hangat,\nLingoMind Team");
  });
  it("streak 0 + due 0", () => {
    const body = buildReminderBody({ fullName: "Budi", currentStreak: 0, dueFlashcards: 0, appUrl: "https://app.com" });
    expect(body).toContain("Mari mulai belajar hari ini dan bangun streak-mu");
    expect(body).not.toContain("Smart Reminder");
  });
  it("streak > 0 + due 0 (tanpa kalimat flashcard)", () => {
    const body = buildReminderBody({ fullName: "Cici", currentStreak: 10, dueFlashcards: 0, appUrl: "x" });
    expect(body).toContain("streak 10 harimu");
    expect(body).not.toContain("Smart Reminder");
  });
});
```

- [ ] **Step 2: Run — harus gagal**

Run: `npx vitest run lib/reminder.test.ts` — FAIL.

- [ ] **Step 3: Implementasi**

Create `lib/reminder.ts`:
```ts
import { db } from "./db";
import { sendMail } from "./mail";

export function buildReminderBody(input: {
  fullName: string;
  currentStreak: number;
  dueFlashcards: number;
  appUrl: string;
}): string {
  const { fullName, currentStreak, dueFlashcards, appUrl } = input;
  let body = `Hai ${fullName},\n\n`;
  if (currentStreak > 0) {
    body += `Hebat! Pertahankan streak ${currentStreak} harimu! Mari luangkan waktu beberapa menit hari ini untuk belajar dan menjaga streak-mu agar tidak kembali ke nol.\n\n`;
  } else {
    body += "Mari mulai belajar hari ini dan bangun streak-mu di LingoMind! Konsistensi adalah kunci dalam mempelajari bahasa baru.\n\n";
  }
  if (dueFlashcards > 0) {
    body += `🧠 Smart Reminder: Ada ${dueFlashcards} kosakata yang hampir terlupakan dan sudah waktunya untuk di-review hari ini!\n\n`;
  }
  body += `Klik di sini untuk mulai belajar: ${appUrl}\n\nSalam hangat,\nLingoMind Team`;
  return body;
}

export async function sendDailyReminders(): Promise<{ sent: number; skipped: boolean }> {
  if (!process.env.SMTP_PASSWORD) {
    console.log("SMTP_PASSWORD tidak diatur. Pengingat tidak akan dikirimkan.");
    return { sent: 0, skipped: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = await db.user.findMany({ where: { isVerified: true } });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));

  const dueCounts = await db.flashcard.groupBy({
    by: ["email"],
    where: { dueAt: { lte: new Date() } },
    _count: { _all: true },
  });
  const dueMap = new Map(dueCounts.map((d) => [d.email, d._count._all]));

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const subject = "Saatnya Belajar Bahasa di LingoMind! 🚀";

  let sent = 0;
  for (const u of users) {
    const stats = statsMap.get(u.email);
    if (!stats) continue;
    const lastActive = stats.lastActiveDate;
    if (lastActive && lastActive >= today) continue; // sudah aktif hari ini

    const body = buildReminderBody({
      fullName: u.fullName ?? "",
      currentStreak: stats.currentStreak,
      dueFlashcards: dueMap.get(u.email) ?? 0,
      appUrl,
    });

    try {
      await sendMail(u.email, subject, body);
      sent += 1;
      console.log(`Pengingat harian dikirim ke: ${u.email}`);
    } catch (e) {
      console.error(`Gagal mengirim pengingat ke ${u.email}: ${e}`);
    }
  }
  return { sent, skipped: false };
}
```

Catatan: `lastActiveDate` adalah `@db.Date` (UTC midnight) — bandingkan dengan `today` local-midnight; konsisten dengan `getDailyMission` (pola existing). Perbedaan TZ kecil diterima (legacy pakai CURRENT_DATE server).

- [ ] **Step 4: Run — harus lulus**

Run: `npm test` — 175 pass (172 + 3).
Run: `npx tsc --noEmit` — bersih.

- [ ] **Step 5: Commit**

```bash
git add lib/reminder.ts lib/reminder.test.ts
git commit -m "feat: daily reminder email builder and sender (TDD)"
```

---

### Task 2: Route handler cron + vercel.json

**Files:**
- Create: `app/api/cron/daily-reminder/route.ts`, `vercel.json`

**Interfaces:**
- Consumes: `sendDailyReminders` (Task 1)
- Produces: endpoint cron ter-proteksi + konfigurasi Vercel Cron

- [ ] **Step 1: `app/api/cron/daily-reminder/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/reminder";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyReminders();
  return NextResponse.json(result);
}
```

- [ ] **Step 2: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminder",
      "schedule": "0 1 * * *",
      "headers": {
        "authorization": "Bearer __CRON_SECRET__"
      }
    }
  ]
}
```

CATATAN PENTING (controller): `__CRON_SECRET__` di vercel.json tidak bisa memakai env var langsung di cron headers pada semua setup. Pilihan yang benar untuk produksi: vercel.json cron headers berisi placeholder, dan user menggantinya dengan nilai CRON_SECRET saat pertama deploy (atau Vercel mendukung `$CRON_SECRET`? — beberapa dokumentasi menyebut `"authorization": "Bearer $CRON_SECRET"` tidak didukung; cara paling aman: user edit vercel.json setelah clone). ALTERNATIF lebih baik: TIDAK pakai header di vercel.json, tapi route handler menerima cron Vercel karena Vercel MENAMBAHKAN header `x-vercel-cron: 1` otomatis pada request cron. Gunakan kombinasi: route handler cek `x-vercel-cron` ATAU Bearer CRON_SECRET (untuk smoke manual):

```ts
export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authed = (secret && auth === `Bearer ${secret}`) || isVercelCron;
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```
vercel.json cukup tanpa headers (Vercel menandai request cron dengan x-vercel-cron). Smoke manual: panggil dengan header Bearer CRON_SECRET.

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit` — bersih; `npm test` — 175 pass; `npm run lint` — 0 error.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/daily-reminder/route.ts vercel.json
git commit -m "feat: vercel cron daily reminder endpoint"
```

---

### Task 3: Polish (exam shop link) + env example + AGENTS.md + verifikasi final

**Files:**
- Modify: `components/ExamView.tsx` (link toko di cooldown screen), `.env.example` (+ CRON_SECRET), `AGENTS.md`

- [ ] **Step 1: Exam cooldown — link "Beli Tiket di Toko 🏪"**

Edit `components/ExamView.tsx` — di blok cooldown (bila `phase.tickets === 0`), ganti teks `"Tidak punya Tiket Ujian Ulang."` menjadi:

```tsx
<p className="text-xs text-slate-400">Tidak punya Tiket Ujian Ulang.</p>
<Link href="/shop" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">Beli Tiket di Toko 🏪</Link>
```
(import Link sudah ada di ExamView.)

- [ ] **Step 2: `.env.example`**

Tambah baris:
```
CRON_SECRET=<random secret untuk melindungi endpoint cron>
```

- [ ] **Step 3: AGENTS.md**

- Tambah: `app/api/cron/daily-reminder` (Vercel Cron `0 1 * * *` UTC = 08:00 WIB; guard x-vercel-cron / Bearer CRON_SECRET); lib/reminder.ts
- Env: `CRON_SECRET`
- Status: **Fase 6 selesai — MIGRASI LENGKAP**. Catatan: aplikasi aktif = Next.js (main); Dioxus di `dioxus/` hanya referensi; deploy Vercel — env diisi di dashboard (DATABASE_URL, AUTH_SECRET, SMTP_*, APP_URL, OPENCODE_AI_*, CRON_SECRET); VPS deploy.sh TIDAK dipakai lagi.

- [ ] **Step 4: Verifikasi final menyeluruh**

Run (urutan wajib, semua sukses):
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx prisma migrate status
```

- [ ] **Step 5: Commit**

```bash
git add components/ExamView.tsx .env.example AGENTS.md
git commit -m "docs: finalize phase 6 (exam shop link, env example, AGENTS.md)"
```

---

## Ringkasan task & hasil teruji

| Task | Hasil teruji |
|---|---|
| 1. buildReminderBody + sendDailyReminders | 175 test (3 baru) |
| 2. Route handler + vercel.json | tsc/lint/test |
| 3. Polish + env + AGENTS + final | lint/tsc/test/build/migrate |

## Catatan risiko

- **Vercel Cron auth**: gunakan `x-vercel-cron` header (otomatis dari Vercel) ATAU Bearer CRON_SECRET; jangan hardcode secret di vercel.json.
- **lastActiveDate @db.Date vs local midnight**: pola konsisten dengan getDailyMission; perbedaan TZ kecil.
- **Email nyata**: jangan kirim saat smoke — pastikan SMTP_PASSWORD kosong di lingkungan test (fallback log).
- **Push**: dilakukan controller setelah review bersih (bukan di task subagent).
