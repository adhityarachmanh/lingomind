import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const languages = await db.language.count();
  const users = await db.user.count();
  console.log(`languages: ${languages}, users: ${users}`);
  if (languages !== 28) throw new Error("jumlah bahasa tidak sesuai seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
