import { db } from "./db";
import { sendMail } from "./mail";

export function buildReminderBody(input: {
  fullName: string;
  currentStreak: number;
  dueFlashcards: number;
  appUrl: string;
}): string {
  const { fullName, currentStreak, dueFlashcards, appUrl } = input;
  let body = `Hai ${fullName},\n\n`;
  if (currentStreak > 0) {
    body += `Hebat! Pertahankan streak ${currentStreak} harimu! Mari luangkan waktu beberapa menit hari ini untuk belajar dan menjaga streak-mu agar tidak kembali ke nol.\n\n`;
  } else {
    body += "Mari mulai belajar hari ini dan bangun streak-mu di LingoMind! Konsistensi adalah kunci dalam mempelajari bahasa baru.\n\n";
  }
  if (dueFlashcards > 0) {
    body += `🧠 Smart Reminder: Ada ${dueFlashcards} kosakata yang hampir terlupakan dan sudah waktunya untuk di-review hari ini!\n\n`;
  }
  body += `Klik di sini untuk mulai belajar: ${appUrl}\n\nSalam hangat,\nLingoMind Team`;
  return body;
}

export async function sendDailyReminders(): Promise<{ sent: number; skipped: boolean }> {
  if (!process.env.SMTP_PASSWORD) {
    console.log("SMTP_PASSWORD tidak diatur. Pengingat tidak akan dikirimkan.");
    return { sent: 0, skipped: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = await db.user.findMany({ where: { isVerified: true } });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));

  const dueCounts = await db.flashcard.groupBy({
    by: ["email"],
    where: { dueAt: { lte: new Date() } },
    _count: { _all: true },
  });
  const dueMap = new Map(dueCounts.map((d) => [d.email, d._count._all]));

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const subject = "Saatnya Belajar Bahasa di LingoMind! 🚀";

  const CHUNK = 8;
  let sent = 0;
  for (let i = 0; i < users.length; i += CHUNK) {
    const chunk = users.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((u) =>
        (async () => {
          const stats = statsMap.get(u.email);
          if (!stats) return { sent: false };
          const lastActive = stats.lastActiveDate;
          if (lastActive && lastActive >= today) return { sent: false }; // sudah aktif hari ini

          const body = buildReminderBody({
            fullName: u.fullName ?? "",
            currentStreak: stats.currentStreak,
            dueFlashcards: dueMap.get(u.email) ?? 0,
            appUrl,
          });

          try {
            await sendMail(u.email, subject, body);
            console.log(`Pengingat harian dikirim ke: ${u.email}`);
            return { sent: true };
          } catch (err) {
            console.error(`Gagal mengirim pengingat ke user: ${err}`);
            return { sent: false };
          }
        })(),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.sent) sent += 1;
      else if (r.status === "rejected") console.error(`Gagal mengirim pengingat ke user: ${r.reason}`);
    }
  }
  return { sent, skipped: false };
}
