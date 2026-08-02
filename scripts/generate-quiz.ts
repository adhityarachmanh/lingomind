// Tambah 1 varian quiz per unit quiz (semua level) untuk bahasa target — meningkatkan random/keragaman.
// Usage: npm run content:quiz <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status varian quiz tanpa generate (tanpa biaya AI)
// Per run: +1 varian per unit (goal topik / exam / general_practice); unit 0 varian ikut dibuatkan 1;
// sudah 10/10 di-skip. Idempotent — jalankan ulang untuk menambah lagi (anti-duplikat soal otomatis).
import "dotenv/config";
import cliProgress from "cli-progress";
import { db } from "../lib/db";
import {
  CONTENT_QUIZ_MAX_VARIANTS,
  generateOneContentUnit,
  resolveLanguageContentStatus,
} from "../lib/admin";

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const isTTY = process.stdout.isTTY === true;

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

interface QuizTarget {
  levelId: string;
  levelTitle: string;
  goal: string;
  count: number;
}

async function generateQuiz(language: string): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n${col(`=== ${language} — Tambah Varian Quiz ===`, C.bold)}`);

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
  // Rata-ratakan: unit dengan varian PALING SEDIKIT diproses duluan — jika putus di tengah,
  // run berikutnya melengkapi yang masih kurang (mis. 1/10 → 2/10) sebelum menaikkan yang sudah 2/10.
  targets.sort((a, b) => a.count - b.count || a.levelTitle.localeCompare(b.levelTitle) || a.goal.localeCompare(b.goal));

  const pending = targets.filter((t) => t.count < CONTENT_QUIZ_MAX_VARIANTS);
  const full = targets.length - pending.length;
  console.log(`Unit quiz: ${targets.length} (varian < ${CONTENT_QUIZ_MAX_VARIANTS}: ${pending.length}, sudah penuh: ${full})`);
  if (dryRun) {
    for (const t of pending) {
      console.log(`  ${col(`${t.levelTitle} — Quiz: ${t.goal}`, C.dim)}: varian ${t.count}/${CONTENT_QUIZ_MAX_VARIANTS} → +1`);
    }
    console.log(col("(dry-run — tidak ada generate)", C.dim));
    return;
  }
  if (pending.length === 0) {
    console.log(col("Semua unit quiz sudah maksimal — tidak ada yang ditambahkan.", C.yellow));
    return;
  }

  const bar = new cliProgress.SingleBar({
    format: "{bar} {percentage}% | {value}/{total} | ETA {eta_formatted} | {level} | {active}",
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
    clearOnComplete: true,
    etaBuffer: 20,
    fps: 10,
    noTTYOutput: true,
    stream: process.stdout,
  });
  bar.start(pending.length, 0, { level: "", active: "" });

  let added = 0;
  let failed = 0;
  const failedList: string[] = [];

  try {
    for (const t of pending) {
      const label = `Quiz: ${t.goal}`;
      const unitStart = Date.now();
      bar.update(added, { level: t.levelTitle, active: label });
      try {
        await generateOneContentUnit(language, { kind: "quiz", goal: t.goal, part: 0, modifier: "normal" }, t.levelId);
        added++;
        const newCount = await db.cachedQuiz.count({
          where: { language, level: t.levelId, goal: t.goal, modifier: "normal" },
        });
        const duration = fmtDuration(Date.now() - unitStart);
        bar.stop();
        const logLine = `  ✓ ${label} [${duration}] (varian ${newCount}/${CONTENT_QUIZ_MAX_VARIANTS})`;
        console.log(col(logLine, C.green));
        bar.start(pending.length, added, { level: "", active: "" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        bar.stop();
        console.error(col(`  ✗ ${label} — ${msg}`, C.red));
        failedList.push(`${t.levelTitle} — ${label}: ${msg}`);
        failed++;
        bar.start(pending.length, added, { level: "", active: "" });
      }
    }
    bar.stop();
    clearLine();

    const elapsed = Date.now() - startedAt;
    console.log(col(`✅ Selesai: +${added} varian quiz dalam ${fmtDuration(elapsed)}${failed > 0 ? `, ${failed} gagal` : ""}`, added > 0 ? C.green : C.yellow));

    // status varian aktual per level
    const after = await resolveLanguageContentStatus(language);
    for (const lvl of after.levels) {
      const quizLine = lvl.goals.map((g) => `${g.goal}: ${Math.min(g.quizDone, CONTENT_QUIZ_MAX_VARIANTS)}/${CONTENT_QUIZ_MAX_VARIANTS}`).join(" · ");
      console.log(`  ${col(`${lvl.title}:`, C.bold)} ${quizLine}`);
    }
    if (failedList.length > 0) {
      console.log(col(`\nGagal (${failedList.length}):`, C.yellow));
      for (const f of failedList) console.log(`  ✗ ${f}`);
      console.log(col("Jalankan ulang untuk mencoba lagi — unit yang sukses tidak diulang.", C.dim));
    }
  } catch (e) {
    bar.stop();
    clearLine();
    console.error(col(`ERROR: ${e instanceof Error ? e.message : String(e)}`, C.red));
    throw e;
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
    if (!lang) {
      console.error(`Bahasa "${language}" tidak ditemukan di DB.`);
      continue;
    }
    await generateQuiz(lang.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
