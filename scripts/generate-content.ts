// Generate konten bahasa via CLI — lesson 3/goal + quiz fill ke 10/10 + auto-regenerate duplikat.
// Usage: npm run content:generate <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status per level tanpa generate (tanpa biaya AI)
// Idempotent: unit yang sudah ada di cache di-skip; unit gagal AI >=3x di-skip sementara
// (cooldown 30 mnt) lalu dicoba lagi otomatis.
import "dotenv/config";
import cliProgress from "cli-progress";
import { db } from "../lib/db";
import {
  CONTENT_QUIZ_MAX_VARIANTS,
  FAILED_COOLDOWN_MS,
  FAILED_SKIP_THRESHOLD,
  detectQuizDuplicates,
  findNextUndoneUnits,
  generateOneContentUnit,
  isQuizVariantClean,
  resolveLanguageContentStatus,
} from "../lib/admin";
import type { QuizRowQuestions } from "../lib/admin";

const PARALLEL = 3;
const RATE_WINDOW_MS = 3 * 60 * 1000; // jendela bergulir untuk laju

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const allLanguages = args.includes("--all");
const maxUnitsArg = args.indexOf("--max-units");
const maxUnits =
  maxUnitsArg >= 0 && args[maxUnitsArg + 1] ? Math.max(1, Math.floor(Number(args[maxUnitsArg + 1])) || 1) : Infinity;
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

function parseQuizQuestions(contentJson: string): { question: string; listenText?: string }[] {
  try {
    const p = JSON.parse(contentJson) as { questions?: { question?: string; listen_text?: string }[] };
    return p.questions?.map((q) => ({ question: q.question ?? "", listenText: q.listen_text ?? "" })) ?? [];
  } catch { return []; }
}

// ---- engine per bahasa ----
// budget = jumlah unit yang boleh digenerate di run ini (Infinity = tanpa batas); return = unit selesai.
async function generateLanguage(language: string, budget: number): Promise<number> {
  const startedAt = Date.now();
  let totalNow = 0;
  let startDone = 0;
  let doneInRun = 0; // unit selesai dalam run ini
  const completions: number[] = []; // timestamp tiap unit selesai (laju jendela bergulir)
  const activeUnits = new Map<string, number>(); // label → mulai (ms)
  let levelTitle = "";

  console.log(`\n${col(`=== ${language} ===`, C.bold)}`);
  const initial = await resolveLanguageContentStatus(language);
  console.log(`Status awal: ${col(`${initial.done}/${initial.total} unit`, C.cyan)}`);
  startDone = initial.done;
  totalNow = initial.total;

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
    return 0;
  }

  // Progress bar (cli-progress): ETA rolling built-in (etaBuffer), update hanya saat state berubah.
  const bar = new cliProgress.SingleBar({
    format:
      "{bar} {percentage}% | {value}/{total} | ETA {eta_formatted} | {rate} unit/mnt" +
      "{level}{active}",
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
    clearOnComplete: true,
    etaBuffer: 30,
    fps: 10,
    noTTYOutput: true, // non-TTY (redirect/pipe): bar tidak dicetak, hanya log ✓ + summary
    stream: process.stdout,
  });

  function startBar(): void {
    bar.start(Math.max(1, totalNow), Math.min(startDone + doneInRun, totalNow), { rate: "0.0", level: "", active: "" });
    refreshBar();
  }

  function refreshBar(): void {
    const done = startDone + doneInRun;
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    const rate = completions.filter((t) => t >= cutoff).length / (RATE_WINDOW_MS / 60000);
    const active = [...activeUnits.keys()].join(" · ");
    bar.update(Math.min(done, totalNow), {
      rate: rate.toFixed(1),
      level: levelTitle ? ` | ${levelTitle}` : "",
      active: active ? ` | ⟳ ${active}` : "",
    });
  }

  startBar();

  try {
    for (;;) {
      const s = await resolveLanguageContentStatus(language);
      totalNow = s.total;
      levelTitle = s.levels.find((l) => l.done < l.total)?.title ?? "";
      if (s.done >= s.total) break;
      if (doneInRun >= budget) break; // batas --max-units tercapai

      const level = s.levels.find((l) => l.done < l.total);
      if (!level) break;

      const units = await findNextUndoneUnits(language, level.levelId, Math.min(PARALLEL, budget - doneInRun));
      if (units.length === 0) {
        // semua unit tersisa sedang dalam cooldown → tunggu lalu lanjut otomatis
        const failed = await db.failedContentUnit.findMany({
          where: { language, failures: { gte: FAILED_SKIP_THRESHOLD } },
        });
        const now = Date.now();
        const cooling = failed.filter((f) => now - f.lastFailedAt.getTime() < FAILED_COOLDOWN_MS);
        if (cooling.length > 0) {
          const waitMs = Math.max(...cooling.map((f) => f.lastFailedAt.getTime() + FAILED_COOLDOWN_MS - now)) + 5_000;
          bar.stop();
          console.log(
            col(
              `⏳ ${cooling.length} unit dalam cooldown kegagalan AI — menunggu ${fmtDuration(waitMs)} lalu lanjut otomatis... (Ctrl+C aman, resume idempotent)`,
              C.yellow
            )
          );
          await new Promise((r) => setTimeout(r, waitMs));
          startBar();
          continue;
        }
        bar.stop();
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
          const unitStart = Date.now();
          activeUnits.set(label, unitStart);
          refreshBar();
          try {
            await generateOneContentUnit(language, unit, level.levelId);
            await db.failedContentUnit
              .deleteMany({
                where: { language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier },
              })
              .catch(() => {});
            doneInRun++;
            completions.push(Date.now());
            const duration = fmtDuration(Date.now() - unitStart);
            bar.stop();
            console.log(col(`  ✓ ${label} ${col(`[${duration}]`, C.dim)}`, C.green));
            startBar();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            bar.stop();
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
            startBar();
          } finally {
            activeUnits.delete(label);
          }
        })
      );
      refreshBar();
    }

    bar.stop();
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

    // ---------- fase 2: fill quiz ke 10/10 + auto-regenerate duplikat ----------
    const quizFillStarted = Date.now();
    const quizTargets: { levelId: string; levelTitle: string; goal: string; count: number }[] = [];
    const quizStatus = await resolveLanguageContentStatus(language);
    for (const lvl of quizStatus.levels) {
      for (const g of lvl.goals) {
        const count = await db.cachedQuiz.count({ where: { language, level: lvl.levelId, goal: g.goal, modifier: "normal" } });
        if (count < CONTENT_QUIZ_MAX_VARIANTS) {
          quizTargets.push({ levelId: lvl.levelId, levelTitle: lvl.title, goal: g.goal, count });
        }
      }
    }
    const quizTotalToFill = quizTargets.reduce((s, t) => s + (CONTENT_QUIZ_MAX_VARIANTS - t.count), 0);
    console.log(col(`\n=== Fill Varian Quiz → ${CONTENT_QUIZ_MAX_VARIANTS} ===`, C.bold));
    console.log(`Unit quiz perlu diisi: ${quizTargets.length} (total ${quizTotalToFill} varian)`);
    // --max-units juga membatasi fase fill varian (sisa budget dari fase unit)
    const quizBudget = Math.max(0, budget - doneInRun);
    if (quizTargets.length > 0 && quizBudget === 0) {
      console.log(col("⏹ --max-units habis — fase fill varian di-skip, lanjut di run berikutnya.", C.yellow));
    }

    if (quizTargets.length > 0 && quizBudget > 0) {
      const quizBar = new cliProgress.SingleBar({
        format: "{bar} {percentage}% | {value}/{total} | ETA {eta_formatted} | {active}",
        barCompleteChar: "█", barIncompleteChar: "░",
        hideCursor: true, clearOnComplete: true, etaBuffer: 20, fps: 10, noTTYOutput: true, stream: process.stdout,
      });
      quizBar.start(quizTotalToFill, 0, { active: "" });
      let quizGenerated = 0;
      async function processQuizUnit(t: { levelId: string; levelTitle: string; goal: string; count: number }): Promise<void> {
        const label = `Quiz: ${t.goal}`;
        let currentCount = t.count;
        while (currentCount < CONTENT_QUIZ_MAX_VARIANTS && quizGenerated < quizBudget) {
          const unitStart = Date.now();
          quizBar.update(quizGenerated, { active: `${label} (${currentCount + 1}/${CONTENT_QUIZ_MAX_VARIANTS})` });
          try {
            await db.cachedQuiz.count({ where: { language, level: t.levelId, goal: t.goal, modifier: "normal" } }).then((c) => { currentCount = c; });
            if (currentCount >= CONTENT_QUIZ_MAX_VARIANTS) break;
            await generateOneContentUnit(language, { kind: "quiz", goal: t.goal, part: 0, modifier: "normal" }, t.levelId);
            quizGenerated++;
            currentCount++;
            const duration = fmtDuration(Date.now() - unitStart);
            quizBar.stop();
            console.log(col(`  ✓ ${label} [${duration}] (${currentCount}/${CONTENT_QUIZ_MAX_VARIANTS})`, C.green));
            quizBar.start(quizTotalToFill, quizGenerated, { active: "" });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            quizBar.stop();
            console.error(col(`  ✗ ${label} — ${msg}`, C.red));
            quizBar.start(quizTotalToFill, quizGenerated, { active: "" });
            break;
          }
        }
      }
      let qi = 0;
      while (qi < quizTargets.length) {
        const batch = quizTargets.slice(qi, qi + PARALLEL);
        await Promise.all(batch.map(processQuizUnit));
        qi += PARALLEL;
      }
      quizBar.stop();
      clearLine();
      console.log(col(`Quiz fill selesai dalam ${fmtDuration(Date.now() - quizFillStarted)} — +${quizGenerated} varian`, C.green));
      if (quizBudget !== Infinity && quizGenerated >= quizBudget) {
        console.log(col(`⏹ --max-units tercapai di fase fill varian (${quizGenerated} varian) — lanjut di run berikutnya (resume idempotent).`, C.yellow));
      }
    } else {
      console.log(col("Semua varian quiz sudah penuh.", C.dim));
    }

    // ---------- cleanup duplikat existing ----------
    console.log(col(`\n=== Cek Duplikat Quiz ===`, C.bold));
    const allQuizzes = await db.cachedQuiz.findMany({ where: { language } });
    const groups = new Map<string, QuizRowQuestions[]>();
    for (const q of allQuizzes) {
      const key = `${q.level}|${q.goal}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: q.id, questions: parseQuizQuestions(q.contentJson) });
    }
    const groupsArr = [...groups.entries()].map(([key, rows]) => ({ key, rows }));
    const dupFlags = detectQuizDuplicates(groupsArr);
    if (dupFlags.length === 0) {
      console.log(col("Bersih — tidak ada duplikat.", C.green));
    } else {
      const identical = dupFlags.filter((f) => f.reason === "identical").length;
      console.log(col(`Ditemukan ${dupFlags.length} duplikat (${identical} identik, ${dupFlags.length - identical} mirip). Auto-regenerate...`, C.yellow));
      let cleaned = 0;
      for (const f of dupFlags) {
        const sep = f.key.indexOf("|");
        const level = f.key.slice(0, sep);
        const goal = f.key.slice(sep + 1);
        const target = await db.cachedQuiz.findUnique({ where: { id: f.rowId } });
        if (!target) continue;
        const total = await db.cachedQuiz.count({ where: { language, level, goal, modifier: "normal" } });
        if (total <= 1) { console.log(col(`  ◈ Quiz: ${goal} [${level}] — tidak bisa regenerate (varian terakhir).`, C.yellow)); continue; }
        let replaced = false;
        for (let attempt = 1; attempt <= 3 && !replaced; attempt++) {
          let createdId: number | null = null;
          try { await generateOneContentUnit(language, { kind: "quiz", goal, part: 0, modifier: "normal" }, level); } catch { continue; }
          const newest = await db.cachedQuiz.findFirst({ where: { language, level, goal, modifier: "normal" }, orderBy: { id: "desc" } });
          if (!newest || newest.id === f.rowId) continue;
          createdId = newest.id;
          const group = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier: "normal" } });
          const groupRows = group.filter((q) => q.id !== f.rowId && q.id !== createdId).map((q) => ({ id: q.id, questions: parseQuizQuestions(q.contentJson) }));
          if (isQuizVariantClean(groupRows, { id: createdId, questions: parseQuizQuestions(newest.contentJson) })) {
            await db.cachedQuiz.deleteMany({ where: { id: f.rowId } });
            console.log(col(`  ✓ Quiz: ${goal} [${level}] — diganti varian bersih`, C.green));
            cleaned++; replaced = true;
          } else { await db.cachedQuiz.deleteMany({ where: { id: createdId } }).catch(() => {}); }
        }
        if (!replaced) console.log(col(`  ✗ Quiz: ${goal} [${level}] — gagal regenerate setelah 3×`, C.red));
      }
      console.log(col(`Cleanup selesai: ${cleaned}/${dupFlags.length} duplikat diperbaiki.`, C.green));
    }

    const totalElapsed = Date.now() - startedAt;
    console.log(col(`\n=== Ringkasan Akhir — ${fmtDuration(totalElapsed)} ===`, C.bold));
    const finalStatus = await resolveLanguageContentStatus(language);
    for (const lvl of finalStatus.levels) {
      const quizLine = lvl.goals.map((g) => `Quiz:${Math.min(g.quizDone, CONTENT_QUIZ_MAX_VARIANTS)}/${CONTENT_QUIZ_MAX_VARIANTS}`).join(" · ");
      console.log(`  ${col(`${lvl.title}:`, C.bold)} Lesson ${lvl.lessonDone}/${lvl.lessonTotal} · ${quizLine}`);
    }
  } catch (e) {
    bar.stop();
    clearLine();
    console.error(col(`ERROR: ${e instanceof Error ? e.message : String(e)}`, C.red));
    throw e;
  }
  if (budget !== Infinity && doneInRun >= budget) {
    console.log(col(`⏹ --max-units tercapai (${doneInRun} unit) — lanjut di run berikutnya (resume idempotent).`, C.yellow));
  }
  return doneInRun;
}

async function main(): Promise<void> {
  const existing = await db.language.findMany();
  const targets = allLanguages ? existing.map((l) => l.id) : languages;
  if (targets.length === 0) {
    console.log("Usage: npm run content:generate <Bahasa> [bahasa lain...] [--dry-run] [--all] [--max-units <N>]");
    process.exit(1);
  }
  let remaining = maxUnits;
  for (const language of targets) {
    const lang = existing.find((l) => l.id.toLowerCase() === language.trim().toLowerCase());
    if (!lang) {
      if (!allLanguages) console.error(`Bahasa "${language}" tidak ditemukan di DB.`);
      continue;
    }
    const made = await generateLanguage(lang.id, remaining);
    remaining -= made;
    if (remaining <= 0) break;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
