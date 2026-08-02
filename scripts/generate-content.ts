// Generate konten bahasa via CLI (jalan di lokal — tidak tergantung background Vercel).
// Usage: npx tsx scripts/generate-content.ts <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status per level tanpa generate (tanpa biaya AI)
// Idempotent: unit yang sudah ada di cache di-skip; unit gagal AI >=3x di-skip (lihat failed_content_units).
import "dotenv/config";
import { db } from "../lib/db";
import {
  findNextUndoneUnits,
  generateOneContentUnit,
  resolveLanguageContentStatus,
} from "../lib/admin";

const PARALLEL = 3;
const FAILED_SKIP = 3;

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

function unitLabel(u: { kind: string; goal: string; part: number; modifier: string }): string {
  if (u.kind === "lesson") return `Lesson: ${u.goal} — Bagian ${u.part} (${u.modifier})`;
  return `Quiz: ${u.goal}`;
}

async function generateLanguage(language: string): Promise<void> {
  console.log(`\n=== ${language} ===`);
  const status = await resolveLanguageContentStatus(language);
  console.log(`Status awal: ${status.done}/${status.total} unit`);
  for (const lvl of status.levels) {
    console.log(`  ${lvl.title}: ${lvl.done}/${lvl.total} (lesson ${lvl.lessonDone}/${lvl.lessonTotal}, quiz ${lvl.quizDone}/${lvl.quizTotal})`);
  }
  const failedCount = await db.failedContentUnit.count({ where: { language } });
  if (failedCount > 0) console.log(`Unit gagal tersimpan: ${failedCount} (di-skip setelah ${FAILED_SKIP}x gagal)`);
  if (dryRun) {
    console.log("(dry-run — tidak ada generate)");
    return;
  }

  let lastPrint = 0;
  let iterations = 0;
  for (;;) {
    const s = await resolveLanguageContentStatus(language);
    if (s.done >= s.total) {
      console.log(`SELESAI: ${s.done}/${s.total} unit untuk ${language}`);
      return;
    }
    const level = s.levels.find((l) => l.done < l.total);
    if (!level) {
      console.log("TIDAK ADA UNIT YANG BISA DIKERJAKAN (semua sisa di-skip karena gagal AI).");
      console.log(`Reset via: npx prisma studio → hapus baris failed_content_units untuk ${language}, lalu jalankan ulang.`);
      return;
    }
    const units = await findNextUndoneUnits(language, level.levelId, PARALLEL);
    if (units.length === 0) {
      console.log("TIDAK ADA UNIT YANG BISA DIKERJAKAN (level di-skip semua).");
      return;
    }
    await Promise.all(
      units.map(async (unit) => {
        try {
          await generateOneContentUnit(language, unit, level.levelId);
          await db.failedContentUnit
            .deleteMany({
              where: { language, level: level.levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier },
            })
            .catch(() => {});
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`  [GAGAL] ${unitLabel(unit)} — ${msg}`);
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
        }
      })
    );
    iterations++;
    if (iterations % 10 === 0 || s.done + units.length >= s.total) {
      const after = await resolveLanguageContentStatus(language);
      console.log(`  Progress: ${after.done}/${after.total} unit (${level.title})`);
      lastPrint = after.done;
    } else if (s.done !== lastPrint) {
      // progress kecil — tampilkan sesekali saja
    }
  }
}

async function main(): Promise<void> {
  if (languages.length === 0) {
    console.log("Usage: npx tsx scripts/generate-content.ts <Bahasa> [bahasa lain...] [--dry-run]");
    process.exit(1);
  }
  const existing = await db.language.findMany();
  for (const language of languages) {
    if (!existing.some((l) => l.id.toLowerCase() === language.trim().toLowerCase())) {
      console.error(`Bahasa "${language}" tidak ditemukan di DB.`);
      continue;
    }
    await generateLanguage(language.trim());
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
