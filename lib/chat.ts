export function normalizeSetting(setting: string): string {
  const normalized = setting.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("Nama skenario tidak boleh kosong.");
  if (normalized.length > 50) throw new Error("Nama skenario maksimal 50 karakter.");
  return normalized;
}

export function splitKoreksi(content: string): { main: string; koreksi: string | null } {
  const idx = content.indexOf("Koreksi:");
  if (idx < 0) return { main: content, koreksi: null };
  return {
    main: content.slice(0, idx).trim(),
    koreksi: content.slice(idx + "Koreksi:".length).trim() || null,
  };
}
