// Pre-gen pool latihan kelemahan per topik — kunjungan user jadi instan (pick acak dari pool, tanpa AI).
// Usage: npm run content:weakness <Bahasa> [bahasa lain...] [--dry-run]
//   --dry-run: hanya tampilkan status pool tanpa generate (tanpa biaya AI)
// Isi pool: WEAKNESS_TOPICS (classifier) + judul goal tiap level, masing-masing hingga
// CONTENT_WEAKNESS_VARIANTS varian (goal="weakness", modifier=topik). Idempotent — jalankan ulang
// untuk mengisi topik yang masih kurang (anti-duplikat soal otomatis via hasDuplicateQuiz + retry 3x).
import "dotenv/config";
import { db } from "../lib/db";
import { CONTENT_WEAKNESS_VARIANTS, hasDuplicateQuiz } from "../lib/admin";
import { WEAKNESS_TOPICS } from "../lib/weakness";
import { buildWeaknessPrompt, generateQuizWithPrompt } from "../lib/ai-content/quiz";

const args = process.argv.slice(2);
const languages = args.filter((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const allLanguages = args.includes("--all");
const maxUnitsArg = args.indexOf("--max-units");
const maxUnits =
  maxUnitsArg >= 0 && args[maxUnitsArg + 1] ? Math.max(1, Math.floor(Number(args[maxUnitsArg + 1])) || 1) : Infinity;

async function fillTopicPool(language: string, levelId: string, topic: string, maxNew: number): Promise<{ added: number; failed: string | null }> {
  let added = 0;
  let failed: string | null = null;
  for (let v = 0; v < Math.min(CONTENT_WEAKNESS_VARIANTS, maxNew); v++) {
    const count = await db.cachedQuiz.count({
      where: { language, level: levelId, goal: "weakness", modifier: topic },
    });
    if (count >= CONTENT_WEAKNESS_VARIANTS) break;
    const existing = await db.cachedQuiz.findMany({
      where: { language, level: levelId, goal: "weakness", modifier: topic },
      select: { contentJson: true },
    });
    const existingQuestions = existing.flatMap((e) => {
      try {
        const p = JSON.parse(e.contentJson) as { questions?: { question?: string; listen_text?: string }[] };
        return p.questions?.map((q) => ({ question: q.question ?? "", listenText: q.listen_text ?? "" })) ?? [];
      } catch {
        return [];
      }
    });
    let quiz: Awaited<ReturnType<typeof generateQuizWithPrompt>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const candidate = await generateQuizWithPrompt({
        prompt: buildWeaknessPrompt(language, levelId, topic, "(belum ada riwayat kelemahan)"),
        expectedCount: 3,
        label: "weakness quiz",
      });
      if (!hasDuplicateQuiz(existingQuestions, candidate.questions.map((q) => ({ question: q.question, listenText: q.listen_text ?? "" })))) {
        quiz = candidate;
        break;
      }
    }
    if (!quiz) {
      failed = "hasil generate masih mirip dengan varian existing setelah 3x";
      break;
    }
    await db.cachedQuiz.create({
      data: { language, level: levelId, goal: "weakness", modifier: topic, contentJson: JSON.stringify(quiz) },
    });
    added++;
  }
  return { added, failed };
}

// budget = jumlah varian yang boleh ditambah di run ini (Infinity = tanpa batas); return = varian baru.
async function generateLanguage(language: string, budget: number): Promise<number> {
  const [levels, topics] = await Promise.all([
    db.level.findMany({ orderBy: { orderIndex: "asc" } }),
    db.topic.findMany({ orderBy: { orderIndex: "asc" } }),
  ]);
  console.log(`\n=== ${language} — Pool Latihan Kelemahan ===`);
  let totalAdded = 0;
  let totalFailed = 0;
  for (const lvl of levels) {
    const goals = topics.filter((t) => t.levelId === lvl.id).map((t) => t.title);
    if (goals.length === 0) continue;
    const topicList = [...WEAKNESS_TOPICS, ...goals];
    for (const topic of topicList) {
      if (totalAdded >= budget) break;
      const count = await db.cachedQuiz.count({
        where: { language, level: lvl.id, goal: "weakness", modifier: topic },
      });
      if (dryRun) {
        console.log(`  ${lvl.title} — ${topic}: ${count}/${CONTENT_WEAKNESS_VARIANTS}`);
        continue;
      }
      if (count >= CONTENT_WEAKNESS_VARIANTS) continue;
      const { added, failed } = await fillTopicPool(language, lvl.id, topic, budget - totalAdded);
      if (failed) {
        totalFailed++;
        console.error(`  ✗ ${lvl.title} — ${topic}: ${failed}`);
      } else {
        totalAdded += added;
        console.log(`  ✓ ${lvl.title} — ${topic}: +${added} (total ${count + added}/${CONTENT_WEAKNESS_VARIANTS})`);
      }
    }
  }
  if (dryRun) {
    console.log("(dry-run — tidak ada generate)");
  } else {
    console.log(`✅ Selesai: +${totalAdded} varian${totalFailed > 0 ? `, ${totalFailed} topik gagal (jalankan ulang)` : ""}`);
    if (budget !== Infinity && totalAdded >= budget) {
      console.log(`⏹ --max-units tercapai (${totalAdded} varian) — lanjut di run berikutnya (resume idempotent).`);
    }
  }
  return totalAdded;
}

async function main(): Promise<void> {
  const existing = await db.language.findMany();
  const targets = allLanguages ? existing.map((l) => l.id) : languages;
  if (targets.length === 0) {
    console.log("Usage: npm run content:weakness <Bahasa> [bahasa lain...] [--dry-run] [--all] [--max-units <N>]");
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
