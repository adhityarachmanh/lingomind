// Generate konten bahasa via CLI (jalan di lokal — tidak tergantung Vercel).
// Usage: npm run content:generate <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status per level tanpa generate (tanpa biaya AI)
// Idempotent: unit yang sudah ada di cache di-skip; unit gagal AI >=3x di-skip sementara
// (cooldown 30 mnt) lalu dicoba lagi otomatis.
import "dotenv/config";
import { db } from "../lib/db";
import {
  FAILED_COOLDOWN_MS,
  FAILED_SKIP_THRESHOLD,
  findNextUndoneUnits,
  generateOneContentUnit,
  resolveLanguageContentStatus,
} from "../lib/admin";

const PARALLEL = 3;
const REDRAW_MS = 500;

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const isTTY = process.stdout.isTTY === true;

// ---- utilitas tampilan (ANSI; fallback polos saat bukan TTY / redirect) ----
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};
const col = (s: string, code: string): string => (isTTY ? `${code}${s}${C.reset}` : s);

function bar(percent: number, width = 24): string {
  const filled = Math.round(Math.max(0, Math.min(1, percent)) * width);
  return col("█".repeat(filled), C.green) + "░".repeat(width - filled);
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, "0")}m`;
}

function clearLine(): void {
  if (isTTY) process.stdout.write("\r\x1b[2K");
}

function unitLabel(u: { kind: string; goal: string; part: number; modifier: string }): string {
  if (u.kind === "lesson") return `Lesson: ${u.goal} — Bagian ${u.part} (${u.modifier})`;
  return `Quiz: ${u.goal}`;
}

// ---- engine per bahasa ----
async function generateLanguage(language: string): Promise<void> {
  const startedAt = Date.now();
  let levels: { title: string; done: number; total: number }[] = [];
  let totalNow = 0;
  let startDone = 0;
  let doneInRun = 0; // unit selesai dalam run ini (realtime)
  const activeUnits = new Map<string, number>(); // label → mulai (ms)
  let lastRender = "";

  console.log(`\n${col(`=== ${language} ===`, C.bold)}`);
  const initial = await resolveLanguageContentStatus(language);
  console.log(`Status awal: ${col(`${initial.done}/${initial.total} unit`, C.cyan)}`);
  startDone = initial.done;
  totalNow = initial.total;
  levels = initial.levels.map((l) => ({ title: l.title, done: l.done, total: l.total }));

  const failedCount = await db.failedContentUnit.count({ where: { language } });
  if (failedCount > 0) {
    console.log(
      col(
        `Unit gagal tersimpan: ${failedCount} (di-skip sementara setelah ${FAILED_SKIP_THRESHOLD}x gagal, cooldown ${Math.round(FAILED_COOLDOWN_MS / 60000)} menit)`,
        C.yellow
      )
    );
  }
  if (dryRun) {
    for (const lvl of initial.levels) {
      const tag = lvl.done >= lvl.total ? col("✓", C.green) : lvl.done > 0 ? col("◐", C.yellow) : col("○", C.dim);
      console.log(`  ${tag} ${lvl.title}: ${lvl.done}/${lvl.total} (lesson ${lvl.lessonDone}/${lvl.lessonTotal}, quiz ${lvl.quizDone}/${lvl.quizTotal})`);
    }
    console.log(col("(dry-run — tidak ada generate)", C.dim));
    return;
  }

  // render realtime: 1 baris live (progress + ETA + laju + unit aktif + level berjalan),
  // ditulis di baris kursor dengan \r + \x1b[K — aman terhadap log error (baris bergeser ke bawah).
  function render(): void {
    if (!isTTY) return;
    const elapsed = Date.now() - startedAt;
    const done = startDone + doneInRun;
    const pct = totalNow > 0 ? done / totalNow : 0;
    const rate = done - startDone > 0 ? (done - startDone) / (elapsed / 60000) : 0;
    const etaMs = rate > 0 ? ((totalNow - done) / rate) * 60000 : 0;
    const active = [...activeUnits.entries()]
      .map(([label, t]) => `${label} ${col(`[${fmtDuration(Date.now() - t)}]`, C.dim)}`)
      .join(" · ");
    const currentLevel = levels.find((l) => l.done < l.total);

    const content =
      `\r${bar(pct)} ${done}/${totalNow} (${Math.round(pct * 100)}%)` +
      `  ${col(`ETA ${fmtDuration(etaMs)}`, C.cyan)}` +
      `  ${col(`${rate.toFixed(1)} unit/mnt`, C.dim)}` +
      (currentLevel ? `  ${col(`${currentLevel.title} ${currentLevel.done}/${currentLevel.total}`, C.yellow)}` : "") +
      (active ? `  ${col("⟳", C.yellow)} ${active}` : "") +
      "\x1b[K";
    if (content === lastRender) return;
    process.stdout.write(content);
    lastRender = content;
  }

  const redrawTimer = setInterval(render, REDRAW_MS);

  try {
    for (;;) {
      const s = await resolveLanguageContentStatus(language);
      totalNow = s.total;
      levels = s.levels.map((l) => ({ title: l.title, done: l.done, total: l.total }));
      if (s.done >= s.total) break;

      const level = s.levels.find((l) => l.done < l.total);
      if (!level) break;

      const units = await findNextUndoneUnits(language, level.levelId, PARALLEL);
      if (units.length === 0) {
        // semua unit tersisa sedang dalam cooldown → countdown lalu lanjut otomatis
        const failed = await db.failedContentUnit.findMany({
          where: { language, failures: { gte: FAILED_SKIP_THRESHOLD } },
        });
        const now = Date.now();
        const cooling = failed.filter((f) => now - f.lastFailedAt.getTime() < FAILED_COOLDOWN_MS);
        if (cooling.length > 0) {
          const until = Math.max(...cooling.map((f) => f.lastFailedAt.getTime() + FAILED_COOLDOWN_MS)) + 1_000;
          for (;;) {
            const remain = until - Date.now();
            if (remain <= 0) break;
            clearLine();
            process.stdout.write(
              `\r${col(`⏳ ${cooling.length} unit dalam cooldown kegagalan AI — lanjut dalam ${fmtDuration(remain)}`, C.yellow)}`
            );
            await new Promise((r) => setTimeout(r, 1000));
          }
          clearLine();
          continue;
        }
        clearLine();
        console.log(
          col(
            "TIDAK ADA UNIT YANG BISA DIKERJAKAN (gagal permanen — reset via panel admin 'Reset Unit Gagal' atau Prisma Studio, lalu jalankan ulang).",
            C.red
          )
        );
        break;
      }

      await Promise.all(
        units.map(async (unit) => {
          const label = unitLabel(unit);
          activeUnits.set(label, Date.now());
          try {
            await generateOneContentUnit(language, unit, level.levelId);
            await db.failedContentUnit
              .deleteMany({
                where: { language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier },
              })
              .catch(() => {});
            doneInRun++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            clearLine();
            console.error(col(`  ✗ ${label} — ${msg}`, C.red));
            await db.failedContentUnit
              .upsert({
                where: {
                  language_level_goal_part_modifier: {
                    language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier,
                  },
                },
                create: { language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier, failures: 1, lastFailedAt: new Date() },
                update: { failures: { increment: 1 }, lastFailedAt: new Date() },
              })
              .catch(() => {});
          } finally {
            activeUnits.delete(label);
          }
        })
      );
    }

    clearInterval(redrawTimer);
    clearLine();

    const final = await resolveLanguageContentStatus(language);
    const elapsed = Date.now() - startedAt;
    if (final.done >= final.total) {
      console.log(col(`✅ SELESAI: ${final.done}/${final.total} unit dalam ${fmtDuration(elapsed)}`, C.green));
    } else {
      console.log(col(`⏹ Berhenti: ${final.done}/${final.total} unit setelah ${fmtDuration(elapsed)}`, C.yellow));
    }
    for (const lvl of final.levels) {
      const tag = lvl.done >= lvl.total ? col("✓", C.green) : lvl.done > 0 ? col("◐", C.yellow) : col("○", C.dim);
      console.log(`  ${tag} ${lvl.title}: ${lvl.done}/${lvl.total} (lesson ${lvl.lessonDone}/${lvl.lessonTotal}, quiz ${lvl.quizDone}/${lvl.quizTotal})`);
    }
    const failedNow = await db.failedContentUnit.findMany({ where: { language } });
    if (failedNow.length > 0) {
      console.log(col(`\nUnit gagal (${failedNow.length}):`, C.yellow));
      for (const f of failedNow) {
        const cooldownLeft = Math.max(0, f.lastFailedAt.getTime() + FAILED_COOLDOWN_MS - Date.now());
        const state =
          f.failures >= FAILED_SKIP_THRESHOLD
            ? col(`cooldown ${fmtDuration(cooldownLeft)}`, C.yellow)
            : col(`${f.failures}x gagal (akan dicoba lagi)`, C.dim);
        const label = unitLabel({ kind: f.part === 0 ? "quiz" : "lesson", goal: f.goal, part: f.part, modifier: f.modifier });
        console.log(`  ✗ ${label} — ${state}`);
      }
      console.log(col("Tip: reset semua kegagalan via panel admin Konten → 'Reset Unit Gagal', lalu jalankan ulang.", C.dim));
    }
  } catch (e) {
    clearInterval(redrawTimer);
    clearLine();
    console.error(col(`ERROR: ${e instanceof Error ? e.message : String(e)}`, C.red));
    throw e;
  }
}

async function main(): Promise<void> {
  if (languages.length === 0) {
    console.log("Usage: npm run content:generate <Bahasa> [bahasa lain...] [--dry-run]");
    process.exit(1);
  }
  const existing = await db.language.findMany();
  for (const language of languages) {
    const lang = existing.find((l) => l.id.toLowerCase() === language.trim().toLowerCase());
    if (!lang) {
      console.error(`Bahasa "${language}" tidak ditemukan di DB.`);
      continue;
    }
    await generateLanguage(lang.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
