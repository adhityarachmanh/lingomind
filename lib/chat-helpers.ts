export interface AiHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export function mapHistoryToAiMessages(
  history: { role: string; content: string | null; analysisJson: unknown }[]
): AiHistoryEntry[] {
  return history
    .map((m): AiHistoryEntry => ({
      role: m.role === "ai" ? "assistant" : "user",
      content:
        m.role === "ai"
          ? (m.analysisJson
              ? (m.analysisJson as unknown as { reply_in_target_language?: string }).reply_in_target_language
              : m.content) ?? ""
          : m.content ?? "",
    }))
    .filter((m) => m.content.trim() !== "");
}

export interface SuggestedReply {
  text: string;
  romanization?: string;
  translation_in_indonesian?: string;
}

export function normalizeSuggestedReplies(raw: unknown): SuggestedReply[] {
  if (!Array.isArray(raw)) return [];
  const out: SuggestedReply[] = [];
  for (const s of raw) {
    if (typeof s === "string" && s.trim()) {
      out.push({ text: s });
    } else if (s && typeof s === "object") {
      const o = s as { text?: unknown; romanization?: unknown; translation_in_indonesian?: unknown };
      if (typeof o.text === "string" && o.text.trim()) {
        out.push({
          text: o.text,
          romanization: typeof o.romanization === "string" && o.romanization.trim() ? o.romanization : undefined,
          translation_in_indonesian:
            typeof o.translation_in_indonesian === "string" && o.translation_in_indonesian.trim()
              ? o.translation_in_indonesian
              : undefined,
        });
      }
    }
  }
  return out;
}
