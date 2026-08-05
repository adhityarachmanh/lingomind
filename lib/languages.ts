export interface LanguageOption {
  id: string;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: "English", label: "English", flag: "🇬🇧" },
  { id: "Japanese", label: "日本語", flag: "🇯🇵" },
  { id: "Korean", label: "한국어", flag: "🇰🇷" },
  { id: "Mandarin", label: "中文", flag: "🇨🇳" },
  { id: "Spanish", label: "Español", flag: "🇪🇸" },
  { id: "French", label: "Français", flag: "🇫🇷" },
  { id: "German", label: "Deutsch", flag: "🇩🇪" },
  { id: "Portuguese", label: "Português", flag: "🇵🇹" },
  { id: "Arabic", label: "العربية", flag: "🇸🇦" },
  { id: "Russian", label: "Русский", flag: "🇷🇺" },
  { id: "Hindi", label: "हिन्दी", flag: "🇮🇳" },
  { id: "Italian", label: "Italiano", flag: "🇮🇹" },
  { id: "Dutch", label: "Nederlands", flag: "🇳🇱" },
  { id: "Turkish", label: "Türkçe", flag: "🇹🇷" },
];

export const TTS_LANG_MAP: Record<string, string> = {
  English: "en-US",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Mandarin: "zh-CN",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Portuguese: "pt-BR",
  Arabic: "ar-SA",
  Russian: "ru-RU",
  Hindi: "hi-IN",
  Italian: "it-IT",
  Dutch: "nl-NL",
  Turkish: "tr-TR",
  Indonesian: "id-ID",
};

export const NON_LATIN_LANGUAGES = new Set([
  "Japanese",
  "Korean",
  "Mandarin",
  "Arabic",
  "Russian",
  "Hindi",
]);

export function getLanguageFlag(language: string): string {
  return LANGUAGES.find((l) => l.id === language)?.flag ?? "🌐";
}
