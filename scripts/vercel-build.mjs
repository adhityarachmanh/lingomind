// Build entrypoint Vercel (vercel.json buildCommand):
// 1. Terapkan migration yang belum di-apply (prisma migrate deploy) — hanya bila DATABASE_URL tersedia
//    (preview tanpa DATABASE_URL tetap bisa build).
// 2. Jalankan next build.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (process.env.DATABASE_URL) {
  run("npx", ["prisma", "migrate", "deploy"]);
}
run("npx", ["next", "build"]);
