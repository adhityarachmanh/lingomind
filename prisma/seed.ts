import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("admin", 10);
  await db.user.upsert({
    where: { email: "admin@lingomind.com" },
    update: {},
    create: {
      email: "admin@lingomind.com",
      fullName: "Admin",
      passwordHash: hash,
      role: "admin",
      isVerified: true,
    },
  });
  console.log("admin seeded");
}

main().finally(() => db.$disconnect());
