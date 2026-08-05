import { NextRequest } from "next/server";
import { generateSpeech } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { getSession } from "@/lib/auth";
import {
  AI_GATEWAY_MAX_TEXT,
  AI_GATEWAY_MODEL,
  AI_GATEWAY_VOICE,
  GOOGLE_TTS_MAX_TEXT,
  GOOGLE_TTS_TL,
} from "@/lib/tts";

export const maxDuration = 60;

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "public, max-age=86400, s-maxage=604800",
};

const AI_GATEWAY_HEADERS = {
  ...AUDIO_HEADERS,
  "X-TTS-Provider": "ai-gateway",
};

const GOOGLE_HEADERS = {
  ...AUDIO_HEADERS,
  "X-TTS-Provider": "google",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Sesi berakhir.", { status: 401 });
  }
  const text = (req.nextUrl.searchParams.get("text") ?? "").trim();
  const language = req.nextUrl.searchParams.get("lang") ?? "English";
  if (!text) {
    return new Response("Teks kosong.", { status: 400 });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (apiKey && text.length <= AI_GATEWAY_MAX_TEXT) {
    try {
      const result = await generateSpeech({
        model: gateway.speechModel(AI_GATEWAY_MODEL),
        text,
        voice: AI_GATEWAY_VOICE,
        outputFormat: "mp3",
        language: GOOGLE_TTS_TL[language] ?? "en",
      });
      const audio = result.audio.uint8Array;
      if (audio.length > 0) {
        return new Response(Buffer.from(audio), { headers: AI_GATEWAY_HEADERS });
      }
    } catch {
      // lanjut ke fallback Google
    }
  }

  if (text.length > GOOGLE_TTS_MAX_TEXT) {
    return new Response("Teks terlalu panjang.", { status: 400 });
  }

  const tl = GOOGLE_TTS_TL[language] ?? "en";
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(text)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://translate.google.com/",
      },
      cache: "no-store",
    });
  } catch {
    return new Response("TTS tidak tersedia.", { status: 502 });
  }
  if (!res.ok || !res.body) {
    return new Response("TTS tidak tersedia.", { status: 502 });
  }

  return new Response(res.body, { headers: GOOGLE_HEADERS });
}
