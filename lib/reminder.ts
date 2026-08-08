import { sendMail } from "./mail";

export function buildReminderBody(userName: string, appUrl: string): string {
  const name = userName ? `Halo ${userName},` : "Halo,";
  return [
    name,
    "",
    "Sudah waktunya berlatih bahasa lagi! Percakapan singkat 5 menit sehari bisa membuat perbedaan besar.",
    "",
    `Mulai latihan sekarang: ${appUrl}/chat`,
    "",
    "Sampai jumpa di sesi latihan!",
    "LingoMind",
  ].join("\n");
}

export async function sendDailyReminder(to: string, userName: string, appUrl: string): Promise<void> {
  const body = buildReminderBody(userName, appUrl);
  await sendMail(to, "Ayo berlatih hari ini! 🚀", body);
}
