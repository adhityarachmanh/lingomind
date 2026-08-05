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
