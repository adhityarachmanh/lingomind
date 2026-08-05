export function trimPreview(content: string | null | undefined, maxLen = 60): string {
  const text = (content ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= maxLen ? text : `${text.slice(0, maxLen).trimEnd()}...`;
}
