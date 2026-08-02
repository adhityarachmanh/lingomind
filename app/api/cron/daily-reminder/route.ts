import { NextRequest, NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/reminder";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const secretOk = !!(secret && auth === `Bearer ${secret}`);
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "").trim();
  // anti-spoof: header x-vercel-cron bisa dipalsukan — wajib dari IP Vercel (76.76.21.x) atau Bearer benar
  const isVercelIp = ip.startsWith("76.76.21.");
  const authed = secretOk || (isVercelCron && isVercelIp);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyReminders();
  return NextResponse.json(result);
}
