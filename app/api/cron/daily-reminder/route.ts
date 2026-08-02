import { NextRequest, NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/reminder";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authed = (secret && auth === `Bearer ${secret}`) || isVercelCron;
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyReminders();
  return NextResponse.json(result);
}
