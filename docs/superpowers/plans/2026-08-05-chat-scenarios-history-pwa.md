# Skenario DB + Riwayat Chat + URL Session + Responsive + PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skenario tersimpan di DB (dibuat user dari perpustakaan 45 template), sesi chat di URL (`/chat?session=<id>`), riwayat per-user dengan hapus, voice chat unified, responsive mobile+desktop 2-panel, dan PWA installable + offline shell.

**Architecture:** Lapisan data dulu (migration `scenarios` + `Session.scenarioId`, konstanta template/language, action baru + refactor chat action ke `sessionId`), lalu UI (home dengan grid+riwayat+dialog template, ChatView session-mode, sidebar desktop, voice unified), terakhir PWA (ikon/manifest/SW) dan polish responsive. Semua action guard `getSession()` + resolve `userId` dari email.

**Tech Stack:** Next.js 16 (App Router, server actions, `useSearchParams` + `Suspense`), Prisma 7 (Neon), AI SDK v7 (`instructions` option), Tailwind v4, lucide-react, sonner, vitest, sharp (devDep, hanya untuk generate ikon).

## Global Constraints

- UI & pesan error **bahasa Indonesia**; string error lama verbatim: "Sesi berakhir. Silakan login kembali.", "Pesan tidak boleh kosong.", "AI mengembalikan respons tidak valid. Silakan coba lagi.", "Pengguna tidak ditemukan."
- Error kepemilikan: `"Akses ditolak."`; session id tidak valid: `"Percakapan tidak ditemukan."`
- JANGAN tambahkan komentar di kode.
- Server action: selalu `getSession()` lalu resolve `userId` via `db.user.findUnique({ where: { email } })` (JWT tidak memuat userId).
- Migration manual: `prisma/migrations/<timestamp>_<name>/migration.sql`; client via `npm run db:generate`; deploy via `migrate deploy`. Kolom Prisma camelCase (map snake_case bila @map), FK naming `scenarios_userId_fkey` / `chat_sessions_scenario_fkey` (lihat migration `20260805000000_add_password_reset_tokens`).
- Vitest hanya untuk lib murni (`lib/*.test.ts`).
- Dark-only token (jangan tambah `.dark`/toggle).
- Tidak ada dependency baru kecuali `sharp` (devDependency) untuk generate ikon; SW manual tanpa next-pwa.
- Verifikasi tiap task: `npx tsc --noEmit` + `npm run lint` + `npm test` (build penuh di task terakhir).
- Fase transisi: Task 5 mengubah signature action; call site UI diperbaiki minimal di task yang sama agar tsc tetap hijau; runtime penuh diselesaikan di Task 6-9.

---

### Task 1: Commit perbaikan pending + skema `Scenario` + migration

**Files:**
- Modify: `prisma/schema.prisma` (model `Scenario` baru, `Session.scenarioId`, relasi `User.scenarios`)
- Create: `prisma/migrations/20260805020000_add_scenarios/migration.sql`
- (pending dari sesi sebelumnya, sudah di working tree): `lib/actions/chat.ts`, `lib/ai-content/chat.ts`, `lib/ai-content/chat.test.ts`

**Interfaces:**
- Produces: model `Scenario` + `Session.scenarioId` (Prisma `db.scenario`, `db.session.scenarioId`). Dipakai Task 4-9.
- Consumes: tidak ada.

- [ ] **Step 1: Commit perbaikan pending**

Working tree berisi 3 file yang sudah dimodifikasi & diverifikasi (tsc/lint/vitest 14/14): fix FK `userId` (resolve `User.id` dari email di `lib/actions/chat.ts`) dan fix AI SDK v7 (`instructions` option, `buildPolyglotUserMessage`/`buildPolyglotOpeningPrompt` return `{ instructions, messages }`, `lib/ai-content/chat.test.ts` disesuaikan).

```bash
git add lib/actions/chat.ts lib/ai-content/chat.ts lib/ai-content/chat.test.ts
git commit -m "fix: resolve userId dari email (FK) + instructions option AI SDK v7"
```

- [ ] **Step 2: Tambah model `Scenario` + `scenarioId` di schema**

Di `prisma/schema.prisma`:

```prisma
model Session {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  language   String
  level      String    @default("A1")
  scenarioId String?   @map("scenario_id")
  scenario   Scenario? @relation(fields: [scenarioId], references: [id], onDelete: SetNull)
  endedAt    DateTime? @map("ended_at")
  createdAt  DateTime  @default(now())
  messages   Message[]

  @@map("chat_sessions")
}

model Scenario {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  description String    @default("")
  language    String
  templateId  String?
  createdAt   DateTime  @default(now())
  sessions    Session[]

  @@map("scenarios")
}
```

Tambah relasi di `User` (setelah `flashcards Flashcard[]`):

```prisma
  scenarios     Scenario[]
```

- [ ] **Step 3: Tulis migration**

Create `prisma/migrations/20260805020000_add_scenarios/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN "scenario_id" TEXT;

-- CreateIndex
CREATE INDEX "scenarios_userId_idx" ON "scenarios"("userId");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_scenario_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerasi client + verifikasi**

Run: `npm run db:generate && npx tsc --noEmit && npm run lint && npm test`
Expected: generate sukses, tsc/lint sukses, vitest 14/14. Juga apply ke DB lokal: `npm run db:migrate-deploy`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260805020000_add_scenarios/migration.sql
git commit -m "feat: tabel scenarios + session.scenario_id (skenario per-user)"
```

---

### Task 2: `lib/languages.ts` + `lib/templates.ts` + test (TDD)

**Files:**
- Create: `lib/languages.ts`, `lib/templates.ts`, `lib/templates.test.ts`

**Interfaces:**
- Produces:
  - `LANGUAGES: { id: string; label: string }[]` (8 bahasa), `TTS_LANG_MAP: Record<string, string>` — dari `lib/languages.ts`. Dipakai Task 6 (dialog), Task 7/9 (TTS).
  - `ScenarioTemplate { id: string; category: string; title: string; description: string }`, `SCENARIO_TEMPLATES: ScenarioTemplate[]` (45 item) — dari `lib/templates.ts`. Dipakai Task 4 (`createScenarioAction`), Task 6 (dialog).
- Consumes: tidak ada.

- [ ] **Step 1: Tulis test yang gagal**

Create `lib/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SCENARIO_TEMPLATES } from "./templates";

describe("SCENARIO_TEMPLATES", () => {
  it("menyediakan minimal 40 template", () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(40);
  });

  it("memiliki id yang unik", () => {
    const ids = SCENARIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("semua field terisi dan kategori konsisten", () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.id.trim()).not.toBe("");
      expect(t.category.trim()).not.toBe("");
      expect(t.title.trim()).not.toBe("");
      expect(t.description.trim()).not.toBe("");
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run lib/templates.test.ts`
Expected: FAIL — `Cannot find module './templates'`.

- [ ] **Step 3: Implementasi**

Create `lib/languages.ts`:

```ts
export const LANGUAGES = [
  { id: "English", label: "🇬🇧 English" },
  { id: "Japanese", label: "🇯🇵 日本語" },
  { id: "Korean", label: "🇰🇷 한국어" },
  { id: "Mandarin", label: "🇨🇳 中文" },
  { id: "Spanish", label: "🇪🇸 Español" },
  { id: "French", label: "🇫🇷 Français" },
  { id: "German", label: "🇩🇪 Deutsch" },
  { id: "Indonesian", label: "🇮🇩 Indonesia" },
];

export const TTS_LANG_MAP: Record<string, string> = {
  English: "en-US",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Mandarin: "zh-CN",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Indonesian: "id-ID",
};
```

Create `lib/templates.ts`:

```ts
export interface ScenarioTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  { id: "daily-standup", category: "Pekerjaan & Bisnis", title: "Daily Standup Meeting", description: "Rapat standup harian tim tech" },
  { id: "job-interview", category: "Pekerjaan & Bisnis", title: "Job Interview", description: "Wawancara kerja dengan HR" },
  { id: "client-meeting", category: "Pekerjaan & Bisnis", title: "Client Meeting", description: "Meeting dengan klien membahas proyek" },
  { id: "office-small-talk", category: "Pekerjaan & Bisnis", title: "Office Small Talk", description: "Obrolan ringan dengan rekan kantor" },
  { id: "project-presentation", category: "Pekerjaan & Bisnis", title: "Project Presentation", description: "Presentasi proyek di depan tim" },
  { id: "salary-negotiation", category: "Pekerjaan & Bisnis", title: "Salary Negotiation", description: "Negosiasi gaji dengan atasan" },
  { id: "networking-event", category: "Pekerjaan & Bisnis", title: "Networking Event", description: "Berkenalan di acara networking" },
  { id: "team-feedback", category: "Pekerjaan & Bisnis", title: "Team Feedback", description: "Memberi dan menerima umpan balik kerja" },
  { id: "airport-immigration", category: "Perjalanan", title: "Airport Immigration", description: "Menjawab pertanyaan petugas imigrasi" },
  { id: "hotel-checkin", category: "Perjalanan", title: "Hotel Check-in", description: "Check-in dan bertanya fasilitas hotel" },
  { id: "lost-luggage", category: "Perjalanan", title: "Lost Luggage", description: "Melaporkan bagasi hilang" },
  { id: "taxi-ride", category: "Perjalanan", title: "Taxi Ride", description: "Naik taksi dan memberi arahan" },
  { id: "train-station", category: "Perjalanan", title: "Train Station", description: "Membeli tiket dan bertanya jadwal kereta" },
  { id: "tourist-info", category: "Perjalanan", title: "Tourist Info", description: "Bertanya wisata di pusat informasi" },
  { id: "flight-booking", category: "Perjalanan", title: "Flight Booking", description: "Memesan tiket pesawat" },
  { id: "hotel-complaint", category: "Perjalanan", title: "Hotel Complaint", description: "Mengajukan keluhan ke layanan hotel" },
  { id: "restaurant-order", category: "Makanan & Minuman", title: "Restaurant Ordering", description: "Memesan makanan di restoran" },
  { id: "coffee-shop", category: "Makanan & Minuman", title: "Coffee Shop", description: "Memesan kopi dan camilan" },
  { id: "street-food", category: "Makanan & Minuman", title: "Street Food", description: "Membeli makanan di kaki lima" },
  { id: "fine-dining", category: "Makanan & Minuman", title: "Fine Dining", description: "Makan malam di restoran mewah" },
  { id: "fast-food", category: "Makanan & Minuman", title: "Fast Food Counter", description: "Memesan di gerai makanan cepat saji" },
  { id: "food-delivery", category: "Makanan & Minuman", title: "Food Delivery", description: "Memesan makanan antar" },
  { id: "supermarket", category: "Belanja & Layanan", title: "Supermarket", description: "Berbelanja kebutuhan di supermarket" },
  { id: "clothes-shopping", category: "Belanja & Layanan", title: "Clothes Shopping", description: "Mencoba dan membeli pakaian" },
  { id: "electronics-store", category: "Belanja & Layanan", title: "Electronics Store", description: "Membeli barang elektronik" },
  { id: "bank-visit", category: "Belanja & Layanan", title: "Bank Visit", description: "Transaksi di bank" },
  { id: "post-office", category: "Belanja & Layanan", title: "Post Office", description: "Mengirim paket di kantor pos" },
  { id: "barber-salon", category: "Belanja & Layanan", title: "Barber & Salon", description: "Potong rambut di barber atau salon" },
  { id: "pharmacy", category: "Belanja & Layanan", title: "Pharmacy", description: "Membeli obat di apotek" },
  { id: "hospital-visit", category: "Kesehatan", title: "Hospital Visit", description: "Menggambarkan gejala ke dokter" },
  { id: "doctor-appointment", category: "Kesehatan", title: "Doctor Appointment", description: "Janji temu dan konsultasi dokter" },
  { id: "dentist-visit", category: "Kesehatan", title: "Dentist Visit", description: "Periksa gigi ke dokter gigi" },
  { id: "small-talk", category: "Sosial & Pertemanan", title: "Small Talk", description: "Obrolan santai dengan orang baru" },
  { id: "party-conversation", category: "Sosial & Pertemanan", title: "Party Conversation", description: "Mengobrol di pesta" },
  { id: "friends-hangout", category: "Sosial & Pertemanan", title: "Friends Hangout", description: "Nongkrong dengan teman" },
  { id: "meeting-new-people", category: "Sosial & Pertemanan", title: "Meeting New People", description: "Perkenalan dengan orang baru" },
  { id: "family-gathering", category: "Sosial & Pertemanan", title: "Family Gathering", description: "Berkumpul dengan keluarga besar" },
  { id: "tech-support", category: "Teknologi", title: "Tech Support", description: "Menghubungi dukungan teknis" },
  { id: "wifi-setup", category: "Teknologi", title: "Setting Up Wi-Fi", description: "Memasang dan mengatur Wi-Fi" },
  { id: "gadget-shopping", category: "Teknologi", title: "Gadget Shopping", description: "Konsultasi membeli gadget baru" },
  { id: "asking-directions", category: "Sehari-hari", title: "Asking Directions", description: "Bertanya arah di jalan" },
  { id: "weekend-plans", category: "Sehari-hari", title: "Weekend Plans", description: "Membicarakan rencana akhir pekan" },
  { id: "hobbies-talk", category: "Sehari-hari", title: "Hobbies Talk", description: "Membicarakan hobi dan minat" },
  { id: "weather-talk", category: "Sehari-hari", title: "Weather Talk", description: "Membicarakan cuaca" },
  { id: "time-schedule", category: "Sehari-hari", title: "Time & Schedules", description: "Mengatur jadwal dan waktu" },
];
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run lib/templates.test.ts`
Expected: PASS (45 template, id unik, field terisi).

- [ ] **Step 5: Commit**

```bash
git add lib/languages.ts lib/templates.ts lib/templates.test.ts
git commit -m "feat: perpustakaan 45 template skenario + daftar bahasa"
```

---

### Task 3: `lib/chat-utils.ts` — `trimPreview` (TDD)

**Files:**
- Create: `lib/chat-utils.ts`, `lib/chat-utils.test.ts`

**Interfaces:**
- Produces: `trimPreview(content: string | null | undefined, maxLen?: number): string` — normalisasi spasi/newline, potong `maxLen` (default 60) + `"..."`. Dipakai Task 4 (`getChatHomeAction`).

- [ ] **Step 1: Tulis test yang gagal**

Create `lib/chat-utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { trimPreview } from "./chat-utils";

describe("trimPreview", () => {
  it("memotong teks panjang dan menambahkan elipsis", () => {
    const long = "a".repeat(100);
    expect(trimPreview(long)).toBe("a".repeat(60) + "...");
  });

  it("mengembalikan teks pendek tanpa perubahan", () => {
    expect(trimPreview("Halo!")).toBe("Halo!");
  });

  it("menormalisasi newline dan spasi ganda", () => {
    expect(trimPreview("Hello\n\n  world  ")).toBe("Hello world");
  });

  it("mengembalikan string kosong untuk null/undefined/kosong", () => {
    expect(trimPreview(null)).toBe("");
    expect(trimPreview(undefined)).toBe("");
    expect(trimPreview("   ")).toBe("");
  });

  it("menghormati maxLen kustom", () => {
    expect(trimPreview("abcdef", 3)).toBe("abc...");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run lib/chat-utils.test.ts`
Expected: FAIL — module tidak ditemukan.

- [ ] **Step 3: Implementasi**

Create `lib/chat-utils.ts`:

```ts
export function trimPreview(content: string | null | undefined, maxLen = 60): string {
  const text = (content ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= maxLen ? text : `${text.slice(0, maxLen).trimEnd()}...`;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run lib/chat-utils.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/chat-utils.ts lib/chat-utils.test.ts
git commit -m "feat: trimPreview untuk preview pesan riwayat"
```

---

### Task 4: `lib/actions/scenario.ts` — aksi skenario & riwayat

**Files:**
- Create: `lib/actions/scenario.ts`

**Interfaces:**
- Consumes: `getSession()` (`lib/auth.ts`), `db` (`lib/db.ts`), `ActionResult` (`lib/actions/types.ts`), `SCENARIO_TEMPLATES` (`lib/templates.ts`), `trimPreview` (`lib/chat-utils.ts`).
- Produces (dipakai Task 5-9):
  - `ScenarioSummary { id; title; description; language; createdAt: Date; lastActivityAt: Date | null; hasActiveSession: boolean }`
  - `SessionSummary { id; scenarioTitle; language; lastMessagePreview; messageCount: number; updatedAt: Date; active: boolean }`
  - `createScenarioAction(input: { templateId?: string; title: string; description: string; language: string })` → `{ scenarioId } | { error }`
  - `getChatHomeAction()` → `{ scenarios: ScenarioSummary[]; history: SessionSummary[] } | { error }`
  - `ChatMessageDto { id; role: "user" | "ai"; content: string; analysisJson: unknown; createdAt: Date }`, `SessionDto { id; scenarioTitle; language; active: boolean }`
  - `getSessionMessagesAction(sessionId: string)` → `{ session: SessionDto; messages: ChatMessageDto[] } | { error }`
  - `resumeSessionAction(sessionId: string)` → `ActionResult`
  - `deleteSessionAction(sessionId: string)` → `ActionResult`
  - `clearChatHistoryAction()` → `ActionResult`

- [ ] **Step 1: Implementasi**

Create `lib/actions/scenario.ts`:

```ts
"use server";

import { getSession } from "../auth";
import { db } from "../db";
import { trimPreview } from "../chat-utils";
import { SCENARIO_TEMPLATES } from "../templates";
import type { ActionResult } from "./types";

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  language: string;
  createdAt: Date;
  lastActivityAt: Date | null;
  hasActiveSession: boolean;
}

export interface SessionSummary {
  id: string;
  scenarioTitle: string;
  language: string;
  lastMessagePreview: string;
  messageCount: number;
  updatedAt: Date;
  active: boolean;
}

export async function createScenarioAction(input: {
  templateId?: string;
  title: string;
  description: string;
  language: string;
}): Promise<{ scenarioId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const title = input.title.trim();
  if (!title) return { error: "Judul skenario wajib diisi." };
  const language = input.language.trim();
  if (!language) return { error: "Pilih bahasa target." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const template = SCENARIO_TEMPLATES.find((t) => t.id === input.templateId);
  const scenario = await db.scenario.create({
    data: {
      userId: user.id,
      title,
      description: input.description.trim(),
      language,
      templateId: template?.id ?? null,
    },
  });
  return { scenarioId: scenario.id };
}

export async function getChatHomeAction(): Promise<{ scenarios: ScenarioSummary[]; history: SessionSummary[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };

  const scenarioRows = await db.scenario.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const sessionRows = await db.session.findMany({
    where: { userId: user.id, scenarioId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      scenario: { select: { title: true, language: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });

  const history: SessionSummary[] = sessionRows.map((s) => ({
    id: s.id,
    scenarioTitle: s.scenario?.title ?? "Percakapan",
    language: s.scenario?.language ?? s.language,
    lastMessagePreview: trimPreview(s.messages[0]?.content),
    messageCount: s._count.messages,
    updatedAt: s.messages[0]?.createdAt ?? s.createdAt,
    active: s.endedAt === null,
  }));

  const scenarios: ScenarioSummary[] = scenarioRows.map((sc) => {
    const scSessions = sessionRows.filter((s) => s.scenarioId === sc.id);
    const last = scSessions[0] ?? null;
    return {
      id: sc.id,
      title: sc.title,
      description: sc.description,
      language: sc.language,
      createdAt: sc.createdAt,
      lastActivityAt: last ? (last.messages[0]?.createdAt ?? last.createdAt) : null,
      hasActiveSession: scSessions.some((s) => s.endedAt === null),
    };
  });

  return { scenarios, history };
}

export interface ChatMessageDto {
  id: string;
  role: "user" | "ai";
  content: string;
  analysisJson: unknown;
  createdAt: Date;
}

export interface SessionDto {
  id: string;
  scenarioTitle: string;
  language: string;
  active: boolean;
}

export async function getSessionMessagesAction(sessionId: string): Promise<{ session: SessionDto; messages: ChatMessageDto[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const s = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!s) return { error: "Percakapan tidak ditemukan." };
  const messages = await db.message.findMany({
    where: { sessionId: s.id },
    orderBy: { createdAt: "asc" },
  });
  return {
    session: {
      id: s.id,
      scenarioTitle: s.scenario?.title ?? "Percakapan",
      language: s.scenario?.language ?? s.language,
      active: s.endedAt === null,
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "ai",
      content: m.content ?? "",
      analysisJson: m.analysisJson,
      createdAt: m.createdAt,
    })),
  };
}

export async function resumeSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return { error: "Akses ditolak." };
  await db.session.update({ where: { id: existing.id }, data: { endedAt: null } });
  return { message: "ok" };
}

export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const existing = await db.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return { error: "Akses ditolak." };
  await db.session.delete({ where: { id: existing.id } });
  return { message: "ok" };
}

export async function clearChatHistoryAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  await db.session.deleteMany({ where: { userId: user.id, scenarioId: { not: null } } });
  return { message: "ok" };
}
```

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint`
Expected: sukses tanpa error (action baru belum dipakai UI — itu normal).

- [ ] **Step 3: Commit**

```bash
git add lib/actions/scenario.ts
git commit -m "feat: aksi skenario & riwayat (create, home, messages, resume, delete, clear)"
```

---

### Task 5: Refactor `lib/actions/chat.ts` ke `scenarioId`/`sessionId` + adaptasi call site

**Files:**
- Modify: `lib/actions/chat.ts`
- Modify: `components/ChatView.tsx` (minimal — call site)
- Modify: `components/VoiceChatView.tsx` (minimal — call site)

**Interfaces:**
- Consumes: model `Scenario` (Task 1).
- Produces (dipakai Task 6-9):
  - `openSessionAction(scenarioId: string, language: string)` → `OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }` (sama seperti sebelumnya, argumen `scenario: string` → `scenarioId: string`; sesi dibuat dengan `scenarioId`)
  - `sendPolyglotMessageAction(sessionId: string, userMessage: string)` → `ChatResult | { error: string }` (argumen `(scenario, language, text)` → `(sessionId, text)`)
  - `endChatSessionAction(sessionId)` — tidak berubah.

- [ ] **Step 1: Ubah `getOrCreateSession` + `openSessionAction`**

Di `lib/actions/chat.ts`, ganti `getOrCreateSession`:

```ts
async function getOrCreateSession(
  userId: string,
  language: string,
  scenarioId: string
): Promise<string | null> {
  const existing = await db.session.findFirst({
    where: { userId, scenarioId, endedAt: null },
  });
  if (existing) return existing.id;
  const level = "A1";
  const created = await db.session.create({
    data: { userId, language, level, scenarioId },
  });
  return created.id;
}
```

Ganti signature & pemanggilan `openSessionAction` (termasuk resolve user & judul skenario untuk prompt):

```ts
export async function openSessionAction(
  scenarioId: string,
  language: string
): Promise<OpenSessionResult | { alreadyStarted: true; sessionId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const scenario = await db.scenario.findUnique({ where: { id: scenarioId }, select: { title: true } });
  if (!scenario) return { error: "Akses ditolak." };

  const sessionId = await getOrCreateSession(user.id, language, scenarioId);
  if (!sessionId) return { error: "Pengguna tidak ditemukan." };

  const count = await db.message.count({ where: { sessionId } });
  if (count > 0) return { alreadyStarted: true, sessionId };

  const level = "A1";
  const { instructions, messages } = buildPolyglotOpeningPrompt(language, level, scenario.title);
  // ...sisa kode sama (generateText, parse, create message, return)
}
```

Catatan: prompt pembuka menerima `scenario.title` (bukan `scenarioId` UUID) agar AI tahu konteks skenario.

Ganti signature `sendPolyglotMessageAction`:

```ts
export async function sendPolyglotMessageAction(
  sessionId: string,
  userMessage: string
): Promise<ChatResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  if (!userMessage.trim()) return { error: "Pesan tidak boleh kosong." };
  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) return { error: "Pengguna tidak ditemukan." };
  const dbSession = await db.session.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!dbSession) return { error: "Percakapan tidak ditemukan." };
  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";
  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  // ...sisa kode sama (map history, buildPolyglotUserMessage(userMessage.trim(), language, level, scenario, aiMessages), generateText, parse, persist, return)
}
```

- [ ] **Step 2: Adaptasi call site `ChatView` minimal**

Di `components/ChatView.tsx` (hanya agar tsc hijau; penulisan ulang penuh di Task 7):
- `startChat(sId, sTitle)`: `openSessionAction(sId, language)` — parameter sId (id hardcoded array) dijadikan `scenarioId`; tambah `const [sessionId, setSessionId] = useState<string | null>(null)` (sudah ada dari fitur sebelumnya) dan set dari hasil.
- `send(textOverride?)`: `sendPolyglotMessageAction(sessionId ?? "", text)`.

- [ ] **Step 3: Adaptasi call site `VoiceChatView` minimal**

Di `components/VoiceChatView.tsx`:
- Tambah state `const [sessionId, setSessionId] = useState<string | null>(null)`; import `openSessionAction` dari `@/lib/actions/chat`.
- Di `startChat(s)`: setelah set phase, panggil `openSessionAction(s.id, language)` → simpan `sessionId`.
- Di loop STT: `sendPolyglotMessageAction(sessionId ?? "", text)`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses; vitest tetap hijau (chat.test.ts tidak menyentuh signature action).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/chat.ts components/ChatView.tsx components/VoiceChatView.tsx
git commit -m "refactor: chat action berbasis scenarioId/sessionId + adaptasi call site"
```

---

### Task 6: `ChatHomeView` + `ScenarioCreateDialog` + halaman `/chat`

**Files:**
- Create: `components/ChatHomeView.tsx`, `components/ScenarioCreateDialog.tsx`, `components/chat-lists.tsx`
- Modify: `app/(app)/chat/page.tsx`

**Interfaces:**
- Consumes: Task 2 (`LANGUAGES`, `SCENARIO_TEMPLATES`), Task 4 (`getChatHomeAction`, `createScenarioAction`, `openSessionAction`, `resumeSessionAction`, `deleteSessionAction`, `clearChatHistoryAction`, `ScenarioSummary`, `SessionSummary`), Task 5 (`openSessionAction` dari `lib/actions/chat.ts`).
- Produces: named exports `ScenarioCard` dan `HistoryRow` dari `components/chat-lists.tsx` (dipakai Task 8 `ChatSidebar`).

- [ ] **Step 1: `components/chat-lists.tsx` (kartu & baris riwayat bersama)**

```tsx
"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ScenarioSummary, SessionSummary } from "@/lib/actions/scenario";

export function LanguageBadge({ language }: { language: string }) {
  const labels: Record<string, string> = {
    English: "🇬🇧", Japanese: "🇯🇵", Korean: "🇰🇷", Mandarin: "🇨🇳",
    Spanish: "🇪🇸", French: "🇫🇷", German: "🇩🇪", Indonesian: "🇮🇩",
  };
  return (
    <Badge variant="outline" className="text-[11px] text-muted-foreground">
      {labels[language] ?? "🌐"} {language}
    </Badge>
  );
}

export function ScenarioCard({ scenario, onOpen }: { scenario: ScenarioSummary; onOpen: (s: ScenarioSummary) => void }) {
  return (
    <Card
      className="cursor-pointer p-4 hover:border-teal-500/60 hover:shadow-md transition-all"
      onClick={() => onOpen(scenario)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-sm truncate">{scenario.title}</p>
        {scenario.hasActiveSession && <Badge variant="secondary" className="shrink-0 text-[10px]">Aktif</Badge>}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{scenario.description}</p>
      <div className="mt-2"><LanguageBadge language={scenario.language} /></div>
    </Card>
  );
}

export function HistoryRow({ item, onOpen, onDelete }: { item: SessionSummary; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item.id)}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{item.scenarioTitle}</span>
          {item.active && <Badge variant="secondary" className="shrink-0 text-[10px]">Aktif</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.lastMessagePreview || "Belum ada pesan"}</p>
        <div className="flex items-center gap-2 mt-1">
          <LanguageBadge language={item.language} />
          <span className="text-[10px] text-muted-foreground">{item.messageCount} pesan</span>
        </div>
      </button>
      <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => onDelete(item.id)} aria-label="Hapus percakapan">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: `components/ScenarioCreateDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { SCENARIO_TEMPLATES } from "@/lib/templates";
import { createScenarioAction } from "@/lib/actions/scenario";

export default function ScenarioCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [language, setLanguage] = useState("English");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = [...new Set(SCENARIO_TEMPLATES.map((t) => t.category))];

  function pickTemplate(id: string) {
    const t = SCENARIO_TEMPLATES.find((x) => x.id === id);
    setTemplateId(id);
    if (t) {
      setTitle(t.title);
      setDescription(t.description);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await createScenarioAction({ templateId: templateId ?? undefined, title, description, language });
    setSaving(false);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Skenario berhasil dibuat!");
    setTemplateId(null);
    setTitle("");
    setDescription("");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Skenario</DialogTitle>
          <DialogDescription>Pilih bahasa, lalu pilih template atau buat sendiri.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bahasa Target</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Pilih Template</Label>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1.5">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SCENARIO_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTemplate(t.id)}
                        className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                          templateId === t.id ? "border-teal-500 bg-teal-500/10" : "border-border hover:border-teal-500/60"
                        }`}
                      >
                        <span className="text-xs font-semibold block">{t.title}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama skenario..." />
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider pt-1">Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat..." rows={2} />
          </div>
          <Button type="button" className="w-full" onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Menyimpan..." : "Simpan Skenario"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: `components/ChatHomeView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearChatHistoryAction,
  deleteSessionAction,
  getChatHomeAction,
  resumeSessionAction,
  type ScenarioSummary,
  type SessionSummary,
} from "@/lib/actions/scenario";
import { openSessionAction } from "@/lib/actions/chat";
import ScenarioCreateDialog from "./ScenarioCreateDialog";
import { HistoryRow, ScenarioCard } from "./chat-lists";

export default function ChatHomeView() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function load() {
    const res = await getChatHomeAction();
    if ("error" in res) { toast.error(res.error); return; }
    setScenarios(res.scenarios);
    setHistory(res.history);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openScenario(s: ScenarioSummary) {
    const res = await openSessionAction(s.id, s.language);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/chat?session=${res.sessionId}`);
  }

  async function openHistory(id: string) {
    const item = history.find((h) => h.id === id);
    if (item && !item.active) {
      const r = await resumeSessionAction(id);
      if ("error" in r) { toast.error(r.error); return; }
    }
    router.push(`/chat?session=${id}`);
  }

  async function removeSession(id: string) {
    if (!confirm("Hapus percakapan ini?")) return;
    const res = await deleteSessionAction(id);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Percakapan dihapus.");
    load();
  }

  async function clearAll() {
    if (!confirm("Hapus semua riwayat percakapan?")) return;
    setClearing(true);
    const res = await clearChatHistoryAction();
    setClearing(false);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Semua riwayat dihapus.");
    load();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Skenario Saya</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">Belum ada skenario. Buat skenario pertamamu untuk mulai belajar!</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Riwayat Percakapan
        </h2>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearAll} disabled={clearing}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {clearing ? "Menghapus..." : "Hapus Semua"}
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada riwayat percakapan.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <HistoryRow key={h.id} item={h} onOpen={openHistory} onDelete={removeSession} />
          ))}
        </div>
      )}

      <ScenarioCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
}
```

- [ ] **Step 4: Ubah halaman `/chat`**

`app/(app)/chat/page.tsx` menjadi:

```tsx
import { Suspense } from "react";
import ChatView from "@/components/ChatView";
import ChatHomeView from "@/components/ChatHomeView";
import { getSessionMessagesAction } from "@/lib/actions/scenario";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  if (session) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat percakapan...</div>}>
        <ChatView />
      </Suspense>
    );
  }
  return <ChatHomeView />;
}
```

Catatan: `ChatView` Task 7 yang membaca `useSearchParams` — bungkus `Suspense` di sini sudah disiapkan.

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 6: Commit**

```bash
git add components/chat-lists.tsx components/ScenarioCreateDialog.tsx components/ChatHomeView.tsx "app/(app)/chat/page.tsx"
git commit -m "feat: home chat (grid skenario, dialog template, riwayat + hapus)"
```

---

### Task 7: `ChatView` session-mode (`?session=`, load pesan, back button)

**Files:**
- Modify: `components/ChatView.tsx` (penulisan ulang — hapus phase picker & SCENARIOS/LANGUAGES hardcoded)

**Interfaces:**
- Consumes: Task 4 (`getSessionMessagesAction`, `SessionDto`, `ChatMessageDto`), Task 5 (`sendPolyglotMessageAction(sessionId, text)`, `endChatSessionAction`), Task 2 (`TTS_LANG_MAP`), Task 8 (`ChatSidebar` — import di Step 1, dibuat di Task 8; untuk sementara beri placeholder import yang dikomentari dihapus — atau langsung buat `ChatSidebar` minimal di Task 7? Tidak: Task 7 belum menyertakan sidebar; import ditambahkan di Task 8).
- Produces: `ChatView` session-only; `app/(app)/chat/page.tsx` sudah mendukung (Task 6).

- [ ] **Step 1: Tulis ulang `components/ChatView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Bot, ChevronDown, ChevronUp, FileCheck2, Loader2, LogOut, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { endChatSessionAction, saveFlashcardAction, sendPolyglotMessageAction, type PolyglotAnalysis } from "@/lib/actions/chat";
import { getSessionMessagesAction, type SessionDto } from "@/lib/actions/scenario";
import { TTS_LANG_MAP } from "@/lib/languages";
import { toast } from "sonner";
import SpeakButton from "./SpeakButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LanguageBadge } from "./chat-lists";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  analysis?: PolyglotAnalysis;
  translation?: string;
  expanded?: boolean;
}

export default function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<SessionDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const ttsLang = TTS_LANG_MAP[session?.language ?? ""] ?? "en-US";

  useEffect(() => {
    if (!sessionId) {
      router.replace("/chat");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getSessionMessagesAction(sessionId);
      if (cancelled) return;
      if ("error" in res) {
        toast.error(res.error ?? "Percakapan tidak ditemukan.");
        router.replace("/chat");
        return;
      }
      setSession(res.session);
      setMessages(res.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        analysis: (m.analysisJson as PolyglotAnalysis | null) ?? undefined,
        translation: m.role === "ai" ? ((m.analysisJson as PolyglotAnalysis | null)?.reply_translation_in_indonesian ?? undefined) : undefined,
        expanded: false,
      })));
      const lastAi = [...res.messages].reverse().find((m) => m.role === "ai");
      const sugg = (lastAi?.analysisJson as PolyglotAnalysis | null)?.suggested_replies;
      setSuggestions(Array.isArray(sugg) ? sugg : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  async function send(textOverride?: string) {
    if (!sessionId || sending) return;
    const text = (textOverride ?? input).trim();
    if (!text) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Tidak ada koneksi internet. Coba lagi.");
      return;
    }
    setInput("");
    setSuggestions([]);
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
    try {
      const res = await sendPolyglotMessageAction(sessionId, text);
      if ("error" in res) { setError(res.error ?? null); return; }
      setSuggestions(res.analysis.suggested_replies ?? []);
      setMessages((m) => [...m, { id: res.messageId, role: "ai", content: res.analysis.reply_in_target_language, analysis: res.analysis, translation: res.analysis.reply_translation_in_indonesian, expanded: false }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
    } finally {
      setSending(false);
    }
  }

  async function saveVocab(word: string, meaning: string) {
    const res = await saveFlashcardAction(word, meaning, session?.language ?? "English");
    if ("error" in res) { setError(res.error ?? null); return; }
    toast.success(`${word} disimpan ke flashcard!`);
  }

  async function endSession() {
    if (!sessionId) { router.push("/chat"); return; }
    try {
      const res = await endChatSessionAction(sessionId);
      if ("error" in res) { toast.error(res.error); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengakhiri sesi.");
      return;
    }
    toast.success("Sesi diakhiri. Percakapan baru dimulai saat memilih skenario.");
    router.push("/chat");
  }

  function toggleExpanded(id: string) {
    setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Skeleton className="h-6 w-40 mb-6" />
        <Skeleton className="h-16 w-2/3 mb-3" />
        <Skeleton className="h-16 w-1/2" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <div className="hidden lg:flex w-80 shrink-0 border-r border-border" />
      <div className="flex-1 min-w-0 flex flex-col max-w-3xl mx-auto w-full px-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push("/chat")} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold truncate">{session?.scenarioTitle}</h1>
              <LanguageBadge language={session?.language ?? ""} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={endSession} disabled={sending}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Akhiri Sesi
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-[env(safe-area-inset-bottom)]">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                {m.analysis && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground -ml-2"
                      onClick={() => toggleExpanded(m.id)}
                    >
                      {m.expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                      {m.expanded ? "Tutup Penjelasan" : "Lihat Penjelasan"}
                    </Button>
                    {m.expanded && (
                      <Card className="border-border bg-card overflow-hidden shadow-none">
                        <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Analisis Bahasa
                          </span>
                          <Badge variant="outline" className="text-[11px] text-muted-foreground">
                            Grammar {m.analysis.scores.grammar} · {m.analysis.scores.fluency}
                          </Badge>
                        </div>
                        {m.analysis.detailed_analysis.length > 0 ? (
                          <div className="px-4 py-3 space-y-2">
                            {m.analysis.detailed_analysis.map((d, i) => (
                              <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                                <p className="text-sm">
                                  <span className="text-destructive line-through decoration-destructive/60">{d.original_segment}</span>
                                  <span className="mx-1.5 text-muted-foreground">→</span>
                                  <span className="text-emerald-400 font-semibold">{d.corrected_segment}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  <span className="font-semibold text-foreground">{d.rule}</span> — {d.explanation_in_indonesian}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-xs text-emerald-400 font-medium">Tidak ada kesalahan — kalimat Anda sudah tepat.</div>
                        )}
                        {m.analysis.native_rephrasing && (
                          <div className="px-4 py-3 border-t border-border space-y-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ungkapan Alternatif</p>
                            <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Formal</span> — {m.analysis.native_rephrasing.formal}</p>
                            <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Casual</span> — {m.analysis.native_rephrasing.casual}</p>
                          </div>
                        )}
                        {m.analysis.vocab_highlight && (
                          <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 bg-muted/20">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{m.analysis.vocab_highlight.word_target}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{m.analysis.vocab_highlight.meaning_in_indonesian}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => saveVocab(m.analysis!.vocab_highlight.word_target, m.analysis!.vocab_highlight.meaning_in_indonesian)} className="shrink-0">
                              <Bookmark className="h-3.5 w-3.5 mr-1" /> Simpan
                            </Button>
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}
                <div className="flex justify-start gap-2.5">
                  <Avatar className="h-8 w-8 shrink-0 border border-border bg-secondary text-primary">
                    <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%] space-y-1.5">
                    <div className="flex items-start gap-2">
                      <SpeakButton text={m.content} lang={ttsLang} rate={1.0} />
                      <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border text-sm whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                    {(m.translation ?? m.analysis?.reply_translation_in_indonesian) && (
                      <p className="text-[11px] text-muted-foreground italic pl-10">{m.translation ?? m.analysis?.reply_translation_in_indonesian}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
          {sending && (
            <div className="flex justify-start gap-2">
              <Avatar className="h-8 w-8 shrink-0 border border-border bg-muted">
                <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="max-w-[85%] space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <p className="text-[11px] text-muted-foreground pt-1">AI Tutor menganalisis...</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        {suggestions.length > 0 && !sending && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saran jawaban:</span>
            {suggestions.map((s, i) => (
              <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            disabled={sending}
            placeholder={`Ketik dalam bahasa ${session?.language ?? "..."}...`}
            className="flex-1"
          />
          <Button type="button" onClick={() => send()} disabled={!input.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {sending ? "" : "Kirim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses (kotak `ChatSidebar` kosong sementara).

- [ ] **Step 3: Commit**

```bash
git add components/ChatView.tsx
git commit -m "feat: chat session-mode (?session=, load pesan dari DB, kembali ke home)"
```

---

### Task 8: `ChatSidebar` + desktop dua panel

**Files:**
- Create: `components/ChatSidebar.tsx`
- Modify: `components/ChatView.tsx` (isi placeholder sidebar)

**Interfaces:**
- Consumes: Task 4 actions, Task 5 (`openSessionAction` dari `lib/actions/chat.ts`), Task 6 (`ScenarioCard`, `HistoryRow` dari `components/chat-lists.tsx`).
- Produces: `ChatSidebar({ activeSessionId: string | null })` — dipasang di `ChatView` (Task 7 placeholder).

- [ ] **Step 1: `components/ChatSidebar.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteSessionAction,
  getChatHomeAction,
  resumeSessionAction,
  type ScenarioSummary,
  type SessionSummary,
} from "@/lib/actions/scenario";
import { openSessionAction } from "@/lib/actions/chat";
import { HistoryRow, ScenarioCard } from "./chat-lists";
import ScenarioCreateDialog from "./ScenarioCreateDialog";

export default function ChatSidebar({ activeSessionId }: { activeSessionId: string | null }) {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    const res = await getChatHomeAction();
    if ("error" in res) { toast.error(res.error); return; }
    setScenarios(res.scenarios);
    setHistory(res.history);
  }

  useEffect(() => {
    load();
  }, [activeSessionId]);

  async function openScenario(s: ScenarioSummary) {
    const res = await openSessionAction(s.id, s.language);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/chat?session=${res.sessionId}`);
  }

  async function openHistory(id: string) {
    const item = history.find((h) => h.id === id);
    if (item && !item.active) {
      const r = await resumeSessionAction(id);
      if ("error" in r) { toast.error(r.error); return; }
    }
    router.push(`/chat?session=${id}`);
  }

  async function removeSession(id: string) {
    if (!confirm("Hapus percakapan ini?")) return;
    const res = await deleteSessionAction(id);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Percakapan dihapus.");
    load();
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-3 space-y-4">
      <Button variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
      </Button>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Skenario</p>
        <div className="space-y-2">
          {scenarios.length === 0 && <p className="text-xs text-muted-foreground">Belum ada skenario.</p>}
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Riwayat
        </p>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>}
          {history.map((h) => (
            <HistoryRow key={h.id} item={h} onOpen={openHistory} onDelete={removeSession} />
          ))}
        </div>
      </div>

      <ScenarioCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
}
```

- [ ] **Step 2: Pasang di `ChatView`**

Di `components/ChatView.tsx`, ganti placeholder:

```tsx
import ChatSidebar from "./ChatSidebar";
```

dan di dalam `<div className="hidden lg:flex w-80 shrink-0 border-r border-border">`:

```tsx
<ChatSidebar activeSessionId={sessionId} />
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 4: Commit**

```bash
git add components/ChatSidebar.tsx components/ChatView.tsx
git commit -m "feat: sidebar desktop dua panel (skenario + riwayat di chat)"
```

---

### Task 9: Voice chat unified (skenario user + `?session=`)

**Files:**
- Modify: `components/VoiceChatView.tsx`, `app/(app)/voice-chat/page.tsx`

**Interfaces:**
- Consumes: Task 2 (`TTS_LANG_MAP`), Task 4 (`getChatHomeAction`, `getSessionMessagesAction`, `SessionDto`), Task 5 (`openSessionAction`, `sendPolyglotMessageAction(sessionId, text)`), Task 6 (`ScenarioCard` dari `chat-lists.tsx`).
- Produces: `/voice-chat` (picker skenario user) dan `/voice-chat?session=` (mode suara). `VoiceChatView` menerima `sessionId` via `useSearchParams` (bukan props).

- [ ] **Step 1: Tulis ulang `components/VoiceChatView.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { openSessionAction, sendPolyglotMessageAction } from "@/lib/actions/chat";
import { getChatHomeAction, getSessionMessagesAction, type ScenarioSummary, type SessionDto } from "@/lib/actions/scenario";
import { TTS_LANG_MAP } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageBadge } from "./chat-lists";
import { ScenarioCard } from "./chat-lists";
import { speak } from "./voice-tts";

type Status = "idle" | "listening" | "processing";

export default function VoiceChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiTranslation, setAiTranslation] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const ttsLang = TTS_LANG_MAP[session?.language ?? ""] ?? "en-US";

  useEffect(() => {
    if (sessionId) {
      (async () => {
        const res = await getSessionMessagesAction(sessionId);
        if ("error" in res) {
          toast.error(res.error ?? "Percakapan tidak ditemukan.");
          router.replace("/voice-chat");
          return;
        }
        setSession(res.session);
        const lastAi = [...res.messages].reverse().find((m) => m.role === "ai");
        if (lastAi) {
          setAiReply(lastAi.content);
          const analysis = lastAi.analysisJson as { reply_translation_in_indonesian?: string } | null;
          setAiTranslation(analysis?.reply_translation_in_indonesian ?? "");
        }
      })();
    } else {
      (async () => {
        const res = await getChatHomeAction();
        if ("error" in res) { toast.error(res.error); return; }
        setScenarios(res.scenarios);
      })();
    }
  }, [sessionId, router]);

  async function openScenario(s: ScenarioSummary) {
    const res = await openSessionAction(s.id, s.language);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/voice-chat?session=${res.sessionId}`);
  }

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
    }
  }, [recognition]);

  const startListening = useCallback(() => {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition tidak didukung browser ini.");
      return;
    }
    const rec = new SR();
    rec.lang = ttsLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setUserText(text);
      setStatus("processing");
      if (!sessionId) return;
      const res = await sendPolyglotMessageAction(sessionId, text);
      setStatus("idle");
      if ("error" in res) { toast.error(res.error); return; }
      setAiReply(res.analysis.reply_in_target_language);
      setAiTranslation(res.analysis.reply_translation_in_indonesian);
      speak(res.analysis.reply_in_target_language, ttsLang);
    };
    rec.onerror = () => {
      setStatus("idle");
      toast.error("Gagal mendengarkan. Coba lagi.");
    };
    rec.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
    setRecognition(rec);
    setStatus("listening");
    rec.start();
  }, [ttsLang, sessionId]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-2">Voice Chat</h1>
        <p className="text-sm text-muted-foreground mb-6">Pilih skenario untuk latihan bicara dengan AI.</p>
        {scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada skenario. Buat dulu di halaman Chat.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 self-start">
        <Button variant="ghost" size="icon" onClick={() => router.push("/voice-chat")} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-extrabold">{session.scenarioTitle}</h1>
        <LanguageBadge language={session.language} />
      </div>

      <div className="w-full rounded-2xl border border-border bg-card p-5 text-center space-y-2">
        {userText && <p className="text-sm text-muted-foreground">Anda: {userText}</p>}
        {aiReply && (
          <>
            <p className="text-lg font-semibold leading-relaxed">{aiReply}</p>
            {aiTranslation && <p className="text-xs text-muted-foreground italic">{aiTranslation}</p>}
          </>
        )}
        {!aiReply && !userText && <p className="text-sm text-muted-foreground">Tekan tombol mikrofon untuk mulai berbicara.</p>}
      </div>

      <Button
        size="lg"
        className="h-16 w-16 rounded-full"
        variant={status === "listening" ? "destructive" : "default"}
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "processing"}
        aria-label={status === "listening" ? "Berhenti" : "Mulai bicara"}
      >
        {status === "processing" ? <MicOff className="h-6 w-6 animate-pulse" /> : status === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>
      <p className="text-xs text-muted-foreground">
        {status === "listening" ? "Mendengarkan... (klik untuk berhenti)" : status === "processing" ? "AI merespons..." : "Klik mikrofon untuk berbicara"}
      </p>
    </div>
  );
}
```

Catatan: `speak` helper ada di `components/SpeakButton.tsx`? Tidak — cek: `SpeakButton` memakai `window.speechSynthesis` di dalam. Ekstrak helper `speak(text, lang)` ke `components/voice-tts.ts` dan import di `SpeakButton` serta `VoiceChatView`:

Create `components/voice-tts.ts`:

```ts
export function speak(text: string, lang: string, rate = 1) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
```

`SpeakButton.tsx` diubah memakai `speak` dari `./voice-tts` (hapus logika inline-nya).

- [ ] **Step 2: Ubah halaman `/voice-chat`**

`app/(app)/voice-chat/page.tsx` menjadi:

```tsx
import { Suspense } from "react";
import VoiceChatView from "@/components/VoiceChatView";

export default function VoiceChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>}>
      <VoiceChatView />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses. Cek juga tidak ada importer tersisa ke `components/useSpeechRecognition.ts`; bila tidak ada, hapus file tersebut (dead code) dan lint lagi.

- [ ] **Step 4: Commit**

```bash
git add components/VoiceChatView.tsx components/voice-tts.ts components/SpeakButton.tsx components/useSpeechRecognition.ts "app/(app)/voice-chat/page.tsx"
git commit -m "feat: voice chat unified (skenario user + session di URL)"
```

---

### Task 10: PWA — ikon + manifest

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `public/icons/` (hasil script: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`)
- Modify: `app/manifest.ts`, `package.json` (+devDep `sharp`)

**Interfaces:**
- Produces: `public/icons/*.png` + manifest lengkap. Dipakai Task 11 (SW precache).

- [ ] **Step 1: Pasang sharp**

Run: `npm i -D sharp`

- [ ] **Step 2: `scripts/generate-icons.mjs`**

```js
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const out = "public/icons";
await mkdir(out, { recursive: true });

const entries = [
  ["icon-192.png", 192, "any"],
  ["icon-512.png", 512, "any"],
  ["icon-maskable-512.png", 512, "maskable"],
  ["apple-touch-icon.png", 180, "any"],
];

for (const [name, size, purpose] of entries) {
  let img = sharp("public/icon.svg").resize(size, size);
  if (purpose === "maskable") {
    const bg = await sharp("public/icon.svg").resize(size, size).png().toBuffer();
    img = sharp(bg).composite([
      { input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="100%" height="100%" fill="#161a20"/></svg>`), gravity: "center" },
    ]);
  }
  await img.png().toFile(`${out}/${name}`);
  console.log(`generated ${out}/${name} (${size})`);
}
```

Catatan: implementasi maskable yang benar: latar gelap `#161a20` + ikon asli di tengah dengan padding 20%. Sesuaikan di implementasi bila hasil visual perlu (pastikan `icon-maskable-512.png` = kotak gelap dengan logo di zona aman tengah).

- [ ] **Step 3: Jalankan script**

Run: `node scripts/generate-icons.mjs`
Expected: 4 file PNG muncul di `public/icons/` (cek ukuran file > 1KB).

- [ ] **Step 4: Perluas `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LingoMind",
    short_name: "LingoMind",
    description: "Belajar bahasa asing dengan AI",
    id: "/",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#161a20",
    theme_color: "#14b8a6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Chat", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
```

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-icons.mjs public/icons app/manifest.ts package.json package-lock.json
git commit -m "feat: ikon PWA + manifest lengkap (installable)"
```

---

### Task 11: Service worker + registrasi + CSP

**Files:**
- Create: `public/sw.js`, `components/pwa-register.ts`
- Modify: `app/layout.tsx` (pasang `PwaRegister`), `next.config.ts` (CSP `worker-src`)

**Interfaces:**
- Consumes: Task 10 (`/icons/*`).
- Produces: offline shell + registrasi SW di semua halaman.

- [ ] **Step 1: `public/sw.js`**

```js
const CACHE_VERSION = "v1";
const APP_SHELL = [
  "/",
  "/chat",
  "/voice-chat",
  "/login",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== `shell-${CACHE_VERSION}`).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/") || caches.match("/chat"))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(`shell-${CACHE_VERSION}`).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(`shell-${CACHE_VERSION}`).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
  }
});
```

- [ ] **Step 2: `components/pwa-register.ts`**

```ts
"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
```

- [ ] **Step 3: Pasang di `app/layout.tsx`**

Import `PwaRegister` dan render `<PwaRegister />` (komponen client, return null) di dalam `<body>` — dekat `<Toaster />` bila ada.

- [ ] **Step 4: CSP di `next.config.ts`**

Di blok headers (production CSP), pastikan ada `worker-src 'self'` dan `script-src 'self'` (SW dimuat sebagai file eksternal — tidak butuh inline). Tambahkan `worker-src 'self';` ke directive list bila belum ada.

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sukses. Manual: buka `/sw.js` di browser → JSON/JS ter-serve; DevTools Application → Service Worker terdaftar.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js components/pwa-register.ts app/layout.tsx next.config.ts
git commit -m "feat: service worker offline shell + registrasi PWA"
```

---

### Task 12: Responsive polish + verifikasi akhir

**Files:**
- Modify: `app/layout.tsx` (viewport export)
- Modify: `app/globals.css` (safe-area helper bila perlu)
- Modify: `components/ChatView.tsx` (penyesuaian kelas mobile bila ditemukan saat manual test)
- Verify: `app/not-found.tsx` (link `/dashboard` → `/chat` — perbaiki bila masih menunjuk route lama)

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: pengalaman mobile/desktop nyaman + build hijau.

- [ ] **Step 1: Viewport eksplisit di `app/layout.tsx`**

```ts
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 2: Cek `app/not-found.tsx`**

Ganti link `href="/dashboard"` → `href="/chat"` (route dashboard tidak ada).

- [ ] **Step 3: Verifikasi penuh**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: semua sukses; build penuh (termasuk generate manifest + SW static file).

- [ ] **Step 4: Manual test checklist (jalankan di browser)**

1. Login baru → `/chat` kosong → tombol "Buat Skenario" → pilih bahasa + template → simpan → kartu muncul dengan badge bahasa.
2. Buka skenario → `/chat?session=<id>` → AI menyapa + chip saran → kirim pesan → kartu analisis.
3. Refresh halaman → percakapan tetap (pesan dimuat dari DB).
4. Kembali → riwayat muncul (preview, jumlah pesan, badge bahasa + Aktif).
5. Akhiri Sesi → kembali ke `/chat`; riwayat baris menjadi non-aktif; klik riwayat → percakapan dilanjutkan.
6. Hapus satu riwayat (trash) + Hapus Semua (konfirmasi).
7. Desktop (≥1024px): sidebar kiri tampil; pilih skenario lain dari sidebar → pindah sesi.
8. Mobile (DevTools iPhone): chat fullscreen, tombol kembali, input di bawah dengan safe-area; dialog template scroll; grid 2 kolom.
9. Voice chat: pilih skenario → mic → AI merespons + TTS; riwayat muncul di `/chat`.
10. PWA: DevTools Application → installable (manifest valid, ikon 192/512); SW terdaftar; offline (Network offline) → buka `/chat` tetap muncul (shell); kirim pesan offline → toast "Tidak ada koneksi internet. Coba lagi."
11. Buka `/chat?session=<id-acak>` → redirect `/chat` + toast "Percakapan tidak ditemukan."

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/not-found.tsx components/ChatView.tsx
git commit -m "style: responsive polish + viewport safe-area"
```

---

## Verifikasi akhir (setelah semua task)

- `npm test` — semua vitest hijau (templates, chat-utils, parse, chat prompt).
- `npx tsc --noEmit && npm run lint && npm run build` — sukses.
- `npm run db:migrate-deploy` — migration `20260805020000_add_scenarios` applied.
- Manual checklist Task 12 Step 4 selesai (HP + desktop + PWA).
