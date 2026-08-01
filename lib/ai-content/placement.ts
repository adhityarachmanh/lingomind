const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function formatPlacementHistory(messages: { role: string; text: string }[]): string {
  return messages.map((m) => `${m.role}: ${m.text}\n`).join("");
}

export function buildPlacementPrompt(language: string, historyStr: string): string {
  return [
    `Evaluasi kemampuan bahasa ${language} pengguna berdasarkan percakapan berikut:`,
    "",
    historyStr,
    "Tugas: Tentukan level CEFR yang paling tepat (A1, A2, B1, B2, C1, atau C2). Hanya kembalikan dua karakter, yaitu kode level CEFR-nya (misalnya 'A1' atau 'B2'). Tanpa spasi, tanpa teks tambahan.",
  ].join("\n");
}

export function parseCefrLevel(text: string): string {
  const t = text.trim();
  for (const level of CEFR_LEVELS) {
    if (t.includes(level)) return level;
  }
  return "A1";
}
