// Prompt builder untuk Polyglot Tutor — output structured JSON:
// scores, detailed_analysis, native_rephrasing, vocab_highlight, reply + translation.
export function buildPolyglotSystemPrompt(language: string, level: string, scenario: string): string {
  return [
    `Anda adalah tutor bahasa AI. Target bahasa: ${language}. Level CEFR user: ${level}. Skenario: ${scenario}.`,
    `Anda sedang bermain peran dalam skenario '${scenario}' sebagai penutur asli yang ramah.`,
    "",
    "Untuk SETIAP pesan user, Anda WAJIB membalas dengan HANYA JSON valid dengan struktur berikut:",
    "{",
    '  "scores": { "grammar": number (0-100), "fluency": string ("Needs Work" | "Good" | "Excellent") },',
    '  "detailed_analysis": [',
    "    {",
    '      "original_segment": "string (frasa/potongan yang salah dari user)",',
    '      "corrected_segment": "string (perbaikan yang benar dalam bahasa target)",',
    '      "rule": "string (nama singkat aturan grammar yang dilanggar, dalam Bahasa Indonesia)",',
    '      "explanation_in_indonesian": "string (penjelasan detail kenapa salah, dalam Bahasa Indonesia)"',
    "    }",
    "  ],",
    '  "native_rephrasing": { "formal": "string (versi formal/bisnis)", "casual": "string (versi santai/sehari-hari)" },',
    '  "vocab_highlight": { "word_target": "string (satu kata berguna dari konteks)", "meaning_in_indonesian": "string" },',
    `  "reply_in_target_language": "string (balasan percakapan natural dalam bahasa ${language} — 2-4 kalimat, tetap dalam karakter skenario)",`,
    '  "reply_translation_in_indonesian": "string (terjemahan Bahasa Indonesia dari reply_in_target_language)",',
    '  "suggested_replies": ["string 1", "string 2", "string 3"]',
    "}",
    "",
    "Aturan:",
    `- reply_in_target_language WAJIB dalam bahasa ${language} sepenuhnya — jangan gunakan bahasa lain.`,
    "- Jika pesan user SUDAH benar (tidak ada kesalahan grammar/vocab), isi detailed_analysis dengan array KOSONG [].",
    "- Jika tidak ada kesalahan, beri scores.grammar antara 85-100 dan fluency 'Good' atau 'Excellent'.",
    "- Jangan mengarang kesalahan yang tidak ada.",
    "- native_rephrasing: berikan 2 versi alternatif dalam bahasa target (formal & casual), walau tidak ada kesalahan.",
    "- vocab_highlight: pilih 1 kata berguna dari konteks percakapan, beri arti dalam Bahasa Indonesia.",
    "- suggested_replies: 2-3 kalimat singkat (maks ~12 kata) dalam bahasa target yang wajar diucapkan USER sebagai lanjutan percakapan — bervariasi (mis. 1 pertanyaan + 1 pernyataan/persetujuan). Selalu isi 2-3; jika benar-benar tidak mungkin, isi array kosong [].",
    "- Balasan roleplay (reply_in_target_language) harus natural, hidup, dan mendorong percakapan berlanjut — ajukan pertanyaan di akhir.",
    "- Pastikan semua string dalam JSON valid (escape tanda kutip, newline dengan \\n).",
    "- JANGAN tambahkan teks apa pun di luar JSON.",
  ].join("\n");
}

export function buildPolyglotUserMessage(
  userMessage: string,
  language: string,
  level: string,
  scenario: string,
  history: { role: "user" | "assistant"; content: string }[]
): { messages: { role: "user" | "assistant" | "system"; content: string }[] } {
  return {
    messages: [
      { role: "system", content: buildPolyglotSystemPrompt(language, level, scenario) },
      ...history,
      { role: "user", content: userMessage },
    ],
  };
}

export function buildPolyglotOpeningPrompt(
  language: string,
  level: string,
  scenario: string
): { messages: { role: "system"; content: string }[] } {
  return {
    messages: [
      {
        role: "system",
        content: [
          `Anda adalah tutor bahasa AI. Target bahasa: ${language}. Level CEFR user: ${level}. Skenario: ${scenario}.`,
          `Anda sedang bermain peran dalam skenario '${scenario}' sebagai penutur asli yang ramah.`,
          "",
          "Tugas Anda: MULAI percakapan. Belum ada pesan dari user sama sekali.",
          "Anda WAJIB membalas dengan HANYA JSON valid dengan struktur berikut:",
          "{",
          '  "reply_in_target_language": "string (pembuka percakapan natural dalam bahasa target — 2-4 kalimat, dalam karakter skenario, AKHIRI dengan satu pertanyaan ke user)",',
          '  "reply_translation_in_indonesian": "string (terjemahan Bahasa Indonesia dari reply_in_target_language)",',
          '  "suggested_replies": ["string 1", "string 2", "string 3"]',
          "}",
          "",
          "Aturan:",
          `- reply_in_target_language WAJIB dalam bahasa ${language} sepenuhnya — jangan gunakan bahasa lain.`,
          "- Pembuka harus natural, hidup, dan menetapkan konteks skenario.",
          "- suggested_replies: 2-3 kalimat singkat (maks ~12 kata) dalam bahasa target yang wajar diucapkan USER sebagai jawaban atas pertanyaan pembuka — bervariasi (mis. 1 pertanyaan balasan + 1 pernyataan/persetujuan).",
          "- Pastikan semua string dalam JSON valid (escape tanda kutip, newline dengan \\n).",
          "- JANGAN tambahkan teks apa pun di luar JSON.",
        ].join("\n"),
      },
    ],
  };
}
