import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { processContentBatch } from "@/lib/admin";

// Background generation via Vercel Background Functions (after()):
// tiap invokasi memproses batch unit sampai ~4,5 menit, lalu me-chain invokasi berikutnya
// (POST resume dengan Bearer CRON_SECRET) hingga seluruh konten bahasa selesai.
const BATCH_MS = 270_000;
const STALE_MS = 8 * 60 * 1000;

async function chainNext(language: string): Promise<void> {
  const url = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET ?? "";
  try {
    const res = await fetch(`${url}/api/content-generation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ language, resume: true }),
    });
    if (!res.ok) {
      // Tandai job failed agar user TAHU chain putus (jangan sembunyi) dan bisa mulai ulang.
      const data = await res.json().catch(() => null);
      const detail = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
      const hint =
        res.status === 401
          ? " (pastikan CRON_SECRET terisi di Vercel env dan sama nilainya)"
          : "";
      await db.contentGenerationJob.updateMany({
        where: { language, status: "running" },
        data: { status: "failed", error: `Chain terputus: ${detail}${hint}`, updatedAt: new Date() },
      });
    }
  } catch {
    await db.contentGenerationJob.updateMany({
      where: { language, status: "running" },
      data: { status: "failed", error: "Chain terputus (jaringan) — klik Generate di Background untuk melanjutkan.", updatedAt: new Date() },
    });
  }
}

async function runChunk(language: string): Promise<void> {
  const job = await db.contentGenerationJob.findFirst({
    where: { language, status: "running" },
    orderBy: { id: "desc" },
  });
  if (!job) return;
  try {
    // heartbeat: updatedAt segar sejak batch mulai → deteksi stale akurat jika chain mati
    await db.contentGenerationJob.update({ where: { id: job.id }, data: { updatedAt: new Date() } });
    const { done, total, blocked } = await processContentBatch(language, BATCH_MS);
    if (done >= total) {
      await db.contentGenerationJob.update({ where: { id: job.id }, data: { status: "done", updatedAt: new Date() } });
      return;
    }
    if (blocked) {
      // sisa unit semuanya sedang dalam cooldown kegagalan AI — hentikan chain agar tidak jalan selamanya
      const failedCount = await db.failedContentUnit.count({ where: { language } });
      await db.contentGenerationJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error: `Ada ${failedCount} unit gagal AI (di-skip sementara — dicoba lagi otomatis setelah 30 menit; atau klik "Reset Unit Gagal" untuk mencoba segera).`,
          updatedAt: new Date(),
        },
      });
      return;
    }
    await db.contentGenerationJob.update({ where: { id: job.id }, data: { updatedAt: new Date() } });
    await chainNext(language);
  } catch (e) {
    await db.contentGenerationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message : "error tidak diketahui",
        updatedAt: new Date(),
      },
    });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const language = typeof body?.language === "string" && body.language.trim() !== "" ? body.language.trim() : null;
  if (!language) return NextResponse.json({ error: "Bahasa tidak valid." }, { status: 400 });

  // Jalur resume internal (self-chain) — hanya dengan Bearer CRON_SECRET.
  if (body?.resume === true) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    after(() => runChunk(language));
    return NextResponse.json({ ok: true, resume: true });
  }

  // Jalur start — guard admin (session cookie).
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Job running yang stale (chain terputus) → tutup sebagai failed agar bisa mulai ulang.
  await db.contentGenerationJob.updateMany({
    where: { language, status: "running", updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "failed", error: "Chain background terputus — mulai ulang.", updatedAt: new Date() },
  });

  const running = await db.contentGenerationJob.count({ where: { language, status: "running" } });
  if (running > 0) return NextResponse.json({ error: "Generate sedang berjalan." }, { status: 409 });

  await db.contentGenerationJob.create({ data: { language } });
  after(() => runChunk(language));
  return NextResponse.json({ ok: true });
}
