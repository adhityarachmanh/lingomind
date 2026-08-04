export function normalizeSetting(setting: string): string {
  const normalized = setting.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("Nama skenario tidak boleh kosong.");
  if (normalized.length > 50) throw new Error("Nama skenario maksimal 50 karakter.");
  return normalized;
}

export function splitKoreksi(content: string): { main: string; koreksi: string | null } {
  const match = content.match(/\n*\s*koreksi\s*:\s*/i);
  if (!match || match.index === undefined) return { main: content, koreksi: null };
  return {
    main: content.slice(0, match.index).trim(),
    koreksi: content.slice(match.index + match[0].length).trim() || null,
  };
}
