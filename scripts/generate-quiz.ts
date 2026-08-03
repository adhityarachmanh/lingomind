// Lengkapi semua varian quiz ke 10/10 untuk bahasa target dalam satu run.
// Usage: npm run content:quiz <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status varian quiz tanpa generate (tanpa biaya AI)
// 3 unit quiz paralel + anti-duplikat (generateOneContentUnit retry 3×).
// Setelah fill: auto-detect & regenerate duplikat existing (detectQuizDuplicates + isQuizVariantClean).
import "dotenv/config";
import cliProgress from "cli-progress";
import { db } from "../lib/db";
import {
  CONTENT_QUIZ_MAX_VARIANTS,
  detectQuizDuplicates,
  generateOneContentUnit,
  isQuizVariantClean,
  resolveLanguageContentStatus,
} from "../lib/admin";
import type { QuizRowQuestions } from "../lib/admin";

const PARALLEL = 3;

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const isTTY = process.stdout.isTTY === true;

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m",
};
const col = (s: string, code: string): string => (isTTY ? `${code}${s}${C.reset}` : s);

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, "0")}m`;
}

function clearLine(): void { if (isTTY) process.stdout.write("\r\x1b[2K"); }

function parseQuizQuestions(contentJson: string): { question: string; listenText?: string }[] {
  try {
    const p = JSON.parse(contentJson) as { questions?: { question?: string; listen_text?: string }[] };
    return (
      p.questions?.map((q) => ({ question: q.question ?? "", listenText: q.listen_text ?? "" })) ?? []
    );
  } catch {
    return [];
  }
}

interface QuizTarget { levelId: string; levelTitle: string; goal: string; count: number; }

async function generateQuiz(language: string): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n${col(`=== ${language} — Fill Semua Varian Quiz ke ${CONTENT_QUIZ_MAX_VARIANTS} ===`, C.bold)}`);

  const status = await resolveLanguageContentStatus(language);
  const targets: QuizTarget[] = [];
  for (const lvl of status.levels) {
    for (const g of lvl.goals) {
      const count = await db.cachedQuiz.count({
        where: { language, level: lvl.levelId, goal: g.goal, modifier: "normal" },
      });
      targets.push({ levelId: lvl.levelId, levelTitle: lvl.title, goal: g.goal, count });
    }
  }

  const pending = targets.filter((t) => t.count < CONTENT_QUIZ_MAX_VARIANTS);
  const totalToGenerate = pending.reduce((s, t) => s + (CONTENT_QUIZ_MAX_VARIANTS - t.count), 0);
  const fullCount = targets.length - pending.length;
  console.log(`Unit quiz: ${targets.length} | perlu diisi: ${pending.length} unit (total ${totalToGenerate} varian) | sudah penuh: ${fullCount}`);

  if (dryRun) {
    for (const t of pending) {
      console.log(`  ${col(`${t.levelTitle} — Quiz: ${t.goal} [${t.count}/${CONTENT_QUIZ_MAX_VARIANTS}]`, C.dim)} → +${CONTENT_QUIZ_MAX_VARIANTS - t.count} varian`);
    }
    console.log(col("(dry-run — tidak ada generate)", C.dim));
    return;
  }
  if (pending.length === 0) {
    console.log(col("Semua unit quiz sudah maksimal — tidak ada yang ditambahkan.", C.yellow));
    return;
  }

  // ---------- generate varian ----------
  const bar = new cliProgress.SingleBar({
    format: "{bar} {percentage}% | {value}/{total} | ETA {eta_formatted} | {level} | {active}",
    barCompleteChar: "█", barIncompleteChar: "░",
    hideCursor: true, clearOnComplete: true, etaBuffer: 20, fps: 10, noTTYOutput: true, stream: process.stdout,
  });
  bar.start(totalToGenerate, 0, { level: "", active: "" });

  let generated = 0;
  let failed = 0;
  const failedList: string[] = [];
  let idx = 0;

  // proses unit paralel (max PARALLEL sekaligus — beda goal = independen)
  async function processUnit(t: QuizTarget): Promise<void> {
    const label = `Quiz: ${t.goal}`;
    let currentCount = t.count;
    while (currentCount < CONTENT_QUIZ_MAX_VARIANTS) {
      const unitStart = Date.now();
      bar.update(generated, { level: t.levelTitle, active: `${label} (${currentCount + 1}/${CONTENT_QUIZ_MAX_VARIANTS})` });
      try {
        await db.cachedQuiz.count({ where: { language, level: t.levelId, goal: t.goal, modifier: "normal" } }).then((c) => { currentCount = c; });
        if (currentCount >= CONTENT_QUIZ_MAX_VARIANTS) break;
        await generateOneContentUnit(language, { kind: "quiz", goal: t.goal, part: 0, modifier: "normal" }, t.levelId);
        generated++;
        currentCount++;
        bar.update(generated, { level: t.levelTitle, active: "" });
        const duration = fmtDuration(Date.now() - unitStart);
        bar.stop();
        const logLine = `  ✓ ${label} [${duration}] (${currentCount}/${CONTENT_QUIZ_MAX_VARIANTS})`;
        console.log(col(logLine, C.green));
        bar.start(totalToGenerate, generated, { level: "", active: "" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        bar.stop();
        console.error(col(`  ✗ ${label} — ${msg}`, C.red));
        failedList.push(`${t.levelTitle} — ${label}: ${msg}`);
        failed++;
        bar.start(totalToGenerate, generated, { level: "", active: "" });
        break; // jangan loop terus jika gagal
      }
    }
  }

  // consumer: proses unit dengan paralelisme PARALLEL
  while (idx < pending.length) {
    const batch = pending.slice(idx, idx + PARALLEL);
    await Promise.all(batch.map(processUnit));
    idx += PARALLEL;
  }

  bar.stop();
  clearLine();

  if (failed > 0) {
    console.log(col(`\n⏹ Gagal: ${failed} unit (dari ${pending.length})`, C.yellow));
    for (const f of failedList) console.log(`  ✗ ${f}`);
  }

  // ---------- cleanup duplikat existing ----------
  console.log(col(`\n=== Cek Duplikat Existing ===`, C.bold));
  const quizzes = await db.cachedQuiz.findMany({ where: { language } });
  const groups = new Map<string, QuizRowQuestions[]>();
  for (const q of quizzes) {
    const key = `${q.level}|${q.goal}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id: q.id, questions: parseQuizQuestions(q.contentJson) });
  }
  const groupsArr = [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  const flags = detectQuizDuplicates(groupsArr);
  if (flags.length === 0) {
    console.log(col("Bersih — tidak ada duplikat.", C.green));
  } else {
    const identical = flags.filter((f) => f.reason === "identical").length;
    const similar = flags.length - identical;
    console.log(col(`Ditemukan ${flags.length} duplikat (${identical} identik, ${similar} mirip). Auto-regenerate...`, C.yellow));

    let cleaned = 0;
    const MAX_RETRY = 3;
    for (const f of flags) {
      const sep = f.key.indexOf("|");
      const level = f.key.slice(0, sep);
      const goal = f.key.slice(sep + 1);
      const target = await db.cachedQuiz.findUnique({ where: { id: f.rowId } });
      if (!target) continue;
      const total = await db.cachedQuiz.count({ where: { language, level, goal, modifier: "normal" } });
      if (total <= 1) {
        console.log(col(`  ◈ Quiz: ${goal} [${level}] — tidak bisa regenerate (varian terakhir).`, C.yellow));
        continue;
      }

      let replaced = false;
      for (let attempt = 1; attempt <= MAX_RETRY && !replaced; attempt++) {
        let createdId: number | null = null;
        try {
          await generateOneContentUnit(language, { kind: "quiz", goal, part: 0, modifier: "normal" }, level);
        } catch {
          continue;
        }
        const newest = await db.cachedQuiz.findFirst({
          where: { language, level, goal, modifier: "normal" },
          orderBy: { id: "desc" },
        });
        if (!newest || newest.id === f.rowId) continue;
        createdId = newest.id;

        const group = await db.cachedQuiz.findMany({ where: { language, level, goal, modifier: "normal" } });
        const groupRows = group
          .filter((q) => q.id !== f.rowId && q.id !== createdId)
          .map((q) => ({ id: q.id, questions: parseQuizQuestions(q.contentJson) }));
        const candidate = { id: createdId, questions: parseQuizQuestions(newest.contentJson) };
        if (isQuizVariantClean(groupRows, candidate)) {
          await db.cachedQuiz.deleteMany({ where: { id: f.rowId } });
          console.log(col(`  ✓ Quiz: ${goal} [${level}] — diganti varian bersih`, C.green));
          cleaned++;
          replaced = true;
        } else {
          await db.cachedQuiz.deleteMany({ where: { id: createdId } }).catch(() => {});
        }
      }
      if (!replaced) {
        console.log(col(`  ✗ Quiz: ${goal} [${level}] — gagal regenerate setelah ${MAX_RETRY}x`, C.red));
      }
    }
    console.log(col(`Cleanup selesai: ${cleaned}/${flags.length} duplikat diperbaiki.`, C.green));
  }

  // ---------- summary ----------
  console.log(col(`\n=== Ringkasan ===`, C.bold));
  const after = await resolveLanguageContentStatus(language);
  const elapsed = Date.now() - startedAt;
  console.log(col(`Selesai dalam ${fmtDuration(elapsed)} — +${generated} varian baru${failed > 0 ? `, ${failed} gagal` : ""}`, C.green));
  for (const lvl of after.levels) {
    const quizLine = lvl.goals.map((g) => `${g.goal}: ${Math.min(g.quizDone, CONTENT_QUIZ_MAX_VARIANTS)}/${CONTENT_QUIZ_MAX_VARIANTS}`).join(" · ");
    console.log(`  ${col(`${lvl.title}:`, C.bold)} ${quizLine}`);
  }
}

async function main(): Promise<void> {
  if (languages.length === 0) {
    console.log("Usage: npm run content:quiz <Bahasa> [bahasa lain...] [--dry-run]");
    process.exit(1);
  }
  const existing = await db.language.findMany();
  for (const language of languages) {
    const lang = existing.find((l) => l.id.toLowerCase() === language.trim().toLowerCase());
    if (!lang) { console.error(`Bahasa "${language}" tidak ditemukan di DB.`); continue; }
    await generateQuiz(lang.id);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
