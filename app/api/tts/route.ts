import { NextRequest } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getSession } from "@/lib/auth";
import {
  ELEVENLABS_MAX_TEXT,
  ELEVENLABS_MODEL,
  ELEVENLABS_VOICE_ID,
  GOOGLE_TTS_MAX_TEXT,
  GOOGLE_TTS_TL,
} from "@/lib/tts";

export const maxDuration = 60;

const AUDIO_HEADERS = {
  "Content-Type": "audio/mpeg",
  "Cache-Control": "public, max-age=86400, s-maxage=604800",
};

const ELEVENLABS_HEADERS = {
  ...AUDIO_HEADERS,
  "X-TTS-Provider": "elevenlabs",
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

  const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenlabsKey && text.length <= ELEVENLABS_MAX_TEXT) {
    try {
      const client = new ElevenLabsClient({ apiKey: elevenlabsKey });
      const audio = await client.textToSpeech.convert(ELEVENLABS_VOICE_ID, {
        text,
        modelId: ELEVENLABS_MODEL,
        outputFormat: "mp3_44100_128",
      });
      const buf = Buffer.from(await new Response(audio).arrayBuffer());
      if (buf.length > 0) {
        return new Response(buf, { headers: ELEVENLABS_HEADERS });
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
