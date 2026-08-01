import sanitizeHtmlLib from "sanitize-html";

const ALLOWED_TAGS = ["br", "b", "i", "u", "strong", "em", "p", "ul", "ol", "li", "a", "blockquote", "code", "h3", "h4"];
const ALLOWED_ATTR = { a: ["href", "target", "rel"] };

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ["http", "https"],
  });
}
