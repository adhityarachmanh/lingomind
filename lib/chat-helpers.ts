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

export interface ParsedStreamSections {
  userRomanization?: string;
  userTranslation?: string;
  replyText: string;
  replyRomanization?: string;
}

export function parseStreamedSections(acc: string): ParsedStreamSections {
  const lines = acc.split("\n");
  let userRomanization: string | undefined;
  let userTranslation: string | undefined;
  const replyLines: string[] = [];
  const romLines: string[] = [];
  let mode: "before" | "reply" | "rom" = "before";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (mode !== "rom" && line.startsWith("||ROM||")) {
      mode = "rom";
      const rest = line.slice("||ROM||".length);
      if (rest.trim()) {
        romLines.push(rest);
      } else if (lines[i + 1] !== undefined) {
        romLines.push(lines[i + 1]);
        i += 1;
      }
      continue;
    }

    if (mode === "before") {
      if (line.startsWith("||UROM||")) {
        const rest = line.slice("||UROM||".length);
        if (rest.trim()) {
          userRomanization = rest.trim();
        } else if (lines[i + 1] !== undefined) {
          userRomanization = lines[i + 1].trim() || undefined;
          i += 1;
        }
        continue;
      }
      if (line.startsWith("||UTRANS||")) {
        const rest = line.slice("||UTRANS||".length);
        if (rest.trim()) {
          userTranslation = rest.trim();
        } else if (lines[i + 1] !== undefined) {
          userTranslation = lines[i + 1].trim() || undefined;
          i += 1;
        }
        continue;
      }
      mode = "reply";
    }

    if (mode === "reply") {
      replyLines.push(line);
    } else if (mode === "rom") {
      romLines.push(line);
    }
  }

  return {
    ...(userRomanization ? { userRomanization } : {}),
    ...(userTranslation ? { userTranslation } : {}),
    replyText: replyLines.join("\n").trim(),
    ...(romLines.length > 0 ? { replyRomanization: romLines.join("\n").trim() } : {}),
  };
}
