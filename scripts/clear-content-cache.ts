import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const lessonCount = await db.cachedLesson.count();
  const quizCount = await db.cachedQuiz.count();
  console.log(`sebelum: cached_lessons=${lessonCount}, cached_quizzes=${quizCount}`);

  await db.cachedLesson.deleteMany({});
  await db.cachedQuiz.deleteMany({});

  const lessonAfter = await db.cachedLesson.count();
  const quizAfter = await db.cachedQuiz.count();
  console.log(`sesudah: cached_lessons=${lessonAfter}, cached_quizzes=${quizAfter}`);
  console.log(`dihapus: lesson=${lessonCount}, quiz=${quizCount}`);

  if (lessonAfter !== 0 || quizAfter !== 0) throw new Error("masih ada sisa cache");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
