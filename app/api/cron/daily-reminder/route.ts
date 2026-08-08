import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDailyReminder } from "@/lib/reminder";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const authHeader = req.headers.get("authorization");
  const isCronSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isCronSecret) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const activeMessages = await db.message.findMany({
    where: { createdAt: { gte: todayStart } },
    select: { session: { select: { userId: true } } },
  });
  const activeUserIds = new Set(
    activeMessages.map((m) => m.session?.userId).filter((id): id is string => typeof id === "string")
  );

  const users = await db.user.findMany({ where: { isVerified: true } });
  const targets = users.filter((u) => !activeUserIds.has(u.id));

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  let sent = 0;
  for (const user of targets) {
    try {
      await sendDailyReminder(user.email, user.fullName ?? "", appUrl);
      sent += 1;
    } catch {
      // lanjut ke user berikutnya
    }
  }

  return NextResponse.json({ sent, skipped: targets.length - sent });
}
