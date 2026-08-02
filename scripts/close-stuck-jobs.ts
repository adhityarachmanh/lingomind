import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const res = await db.contentGenerationJob.updateMany({
    where: { status: "running" },
    data: { status: "failed", error: "Job lama ditutup — klik Generate di Background untuk mulai ulang." },
  });
  console.log(`job ditutup: ${res.count}`);
}

main().finally(() => db.$disconnect());
