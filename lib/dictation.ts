// Normalisasi teks dikte: lowercase, buang tanda baca, rapikan spasi — pertahankan huruf semua aksara.
export function normalizeDictation(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDictationCorrect(userInput: string, target: string): boolean {
  return normalizeDictation(userInput) === normalizeDictation(target);
}
