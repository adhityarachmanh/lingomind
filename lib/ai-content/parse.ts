export function parseAiJson<T>(text: string): T | null {
  let t = text.trim();
  if (!t) return null;
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as T;
  } catch {
    // repair: output mungkin terpotong oleh batas token — coba mundur dari penutup `}` terakhir
    const last = t.lastIndexOf("}");
    for (let i = last; i > Math.max(0, last - 800) && i > start; i--) {
      if (t[i] !== "}") continue;
      try {
        return JSON.parse(t.slice(start, i + 1)) as T;
      } catch {
        // lanjut mundur
      }
    }
    return null;
  }
}

export function parseAiArray<T>(text: string): T[] | null {
  let t = text.trim();
  if (!t) return null;
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}
