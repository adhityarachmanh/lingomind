import { generateText } from "ai";
import { model } from "../ai";

export function buildChatHistory(messages: { sender: string; content: string }[]): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({
    role: m.sender === "ai" ? "assistant" : "user",
    content: m.content,
  }));
}

export function buildOpeningPrompt(
  language: string,
  level: string,
  goal: string,
  setting: string,
  isTopicBased: boolean
): { system: string; user: string } {
  if (isTopicBased) {
    return {
      system: [
        `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)`,
        "",
        `Anda adalah seorang tutor/partner percakapan yang ahli dan ramah. Bahasa target: ${language}. Level CEFR user: ${level}. Topik yang sedang dilatih: '${setting}'.`,
        `Tugas Anda adalah memulai obrolan atau simulasi percakapan untuk melatih pemahaman user mengenai topik '${setting}'.`,
        "Sapa user dengan antusias, lalu ajukan sebuah pertanyaan atau berikan pernyataan yang memancing user untuk mempraktikkan topik tersebut secara langsung. Berikan setidaknya 3 kalimat lengkap agar percakapan terasa hidup.",
        `Bahasa keluaran WAJIB bahasa ${language} sepenuhnya. Jangan gunakan bahasa lain atau terjemahan.`,
      ].join("\n"),
      user: `Mulai percakapan! Buat sapaan pembuka dalam bahasa ${language} yang langsung mengajak saya mempraktikkan topik '${setting}'. Pastikan Anda bertindak sebagai partner latihan yang suportif (berikan setidaknya 3 kalimat). Pastikan kalimatnya lengkap, tidak terpotong, natural, dan diakhiri dengan pertanyaan yang mengundang respons.`,
    };
  }
  return {
    system: [
      `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)`,
      "",
      `Anda sedang memainkan peran secara penuh dan mendalam sebagai karakter di skenario '${setting}'. Anda adalah seorang penutur asli bahasa ${language}.`,
      `Tugas Anda adalah memberikan sapaan pembuka yang sangat natural, hidup, dan benar-benar menjiwai peran Anda di lingkungan '${setting}' secara nyata.`,
      "Sapa user dengan ramah dan tanyakan sesuatu yang relevan dengan peran Anda untuk memancing percakapan (berikan setidaknya 3 kalimat lengkap agar terasa imersif).",
      "Jangan pernah keluar dari karakter Anda (contoh: jika Anda kasir, jadilah kasir sungguhan yang menyapa dan menawarkan sesuatu).",
      `Bahasa keluaran WAJIB bahasa ${language} sepenuhnya. Sesuaikan kompleksitas bahasa dengan level CEFR user: ${level}. Goal belajar: ${goal}.`,
      "Jangan menggunakan label nama peran, jangan pakai tanda kutip, dan jangan sertakan terjemahan.",
      "Hasilkan teks yang sempurna dan pastikan kalimat selesai tanpa terpotong.",
    ].join("\n"),
    user: `Mulai percakapan! Buat kalimat pembuka roleplay yang sangat menjiwai karakter Anda di skenario '${setting}' dalam bahasa ${language}. Pastikan Anda benar-benar bertingkah seperti peran tersebut di dunia nyata (berikan setidaknya 3 kalimat). Pastikan kalimatnya lengkap, tidak terpotong, natural, dan diakhiri dengan pertanyaan yang mengundang respons.`,
  };
}

export function buildReplySystemPrompt(
  language: string,
  level: string,
  goal: string,
  setting: string,
  isTopicBased: boolean
): string {
  const base = `TARGET BAHASA: ${language} (WAJIB GUNAKAN BAHASA INI UNTUK PERCAKAPAN!)\n\n`;
  const role = isTopicBased
    ? `Anda adalah tutor/partner percakapan untuk user yang belajar bahasa ${language} di level ${level}. Topik saat ini: '${setting}'.`
    : `Anda adalah karakter yang sedang berada di lingkungan '${setting}' dan sedang berbicara dengan user. Anda adalah penutur asli bahasa ${language}. User belajar level CEFR ${level} dengan goal ${goal}.`;
  const persona = isTopicBased
    ? `Berikan respons yang suportif, natural, dan terus kembangkan obrolan untuk menguji atau memandu user menggunakan tata bahasa/kosakata terkait '${setting}'. Balasan utama WAJIB dalam bahasa ${language} sepenuhnya. Berikan respons lengkap (sekitar 3 kalimat) agar percakapan terus berjalan. Pastikan kalimat tidak terpotong.`
    : `Anda HARUS sepenuhnya menjiwai peran Anda. Jangan pernah keluar dari karakter. Balasan utama WAJIB dalam bahasa ${language} sepenuhnya. Berikan respons lengkap (sekitar 3 kalimat) agar percakapan terus berjalan. Pastikan kalimat tidak terpotong.`;
  return [
    base,
    role,
    persona,
    "Setelah balasan utama, tambahkan bagian 'Koreksi:' di baris baru dalam Bahasa Indonesia (maksimal 2 poin ringkas) HANYA untuk memperbaiki tata bahasa atau kosakata dari pesan user terakhir jika ada yang salah (jika pesannya sudah benar dan bisa dipahami, jangan berikan koreksi).",
  ].join("\n");
}

export async function generateChatReply(params: {
  system: string;
  history: { sender: string; content: string }[];
  lastUserMessage: string;
  temperature: number;
}): Promise<string> {
  const { system, history, lastUserMessage, temperature } = params;
  const { text } = await generateText({
    model,
    messages: [
      { role: "system", content: system },
      ...buildChatHistory(history),
      { role: "user", content: lastUserMessage },
    ],
    maxOutputTokens: 8192,
    temperature,
  });
  if (!text.trim()) throw new Error("AI mengembalikan respons kosong.");
  return text.trim();
}
