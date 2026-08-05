import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function runWithRetry(cmd, attempts = 3, delayMs = 15000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      run(cmd);
      return;
    } catch (e) {
      if (i === attempts) throw e;
      console.log(`Attempt ${i} failed, retrying in ${delayMs / 1000}s...`);
      execSync(`sleep ${delayMs / 1000}`, { stdio: "inherit" });
    }
  }
}

runWithRetry("npx prisma migrate deploy");
run("npx next build");
