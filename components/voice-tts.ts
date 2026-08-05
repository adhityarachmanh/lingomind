let currentAudio: HTMLAudioElement | null = null;
let speechToken = 0;

const CHUNK_MAX = 180;

function splitChunks(text: string): string[] {
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const part of parts) {
    if (cur && (cur + part).length > CHUNK_MAX) {
      chunks.push(cur);
      cur = part;
    } else {
      cur += part;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.map((c) => c.trim()).filter(Boolean);
}

export function cancelSpeech() {
  speechToken += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

export type TtsProvider = "ai-gateway" | "google";

function playChunk(
  chunk: string,
  lang: string,
  token: number,
  onEnd?: () => void,
  rest?: string[],
  onProvider?: (p: TtsProvider) => void
) {
  fetch(`/api/tts?v=2&text=${encodeURIComponent(chunk)}&lang=${encodeURIComponent(lang)}`)
    .then((res) => {
      if (token !== speechToken) return null;
      const provider = res.headers.get("X-TTS-Provider");
      if (provider === "ai-gateway" || provider === "google") {
        onProvider?.(provider);
      } else {
        console.info("TTS provider: unknown (respons cache lama?)");
      }
      if (!res.ok) throw new Error("tts-api");
      return res.blob();
    })
    .then((blob) => {
      if (token !== speechToken || !blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      const finish = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (rest && rest.length > 0 && token === speechToken) {
          playChunk(rest[0], lang, token, onEnd, rest.slice(1), onProvider);
        } else {
          onEnd?.();
        }
      };
      const fail = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        onEnd?.();
      };
      audio.onended = finish;
      audio.onerror = fail;
      audio.play().catch(fail);
    })
    .catch(() => {
      if (token === speechToken) onEnd?.();
    });
}

export function speak(text: string, lang: string, onEnd?: () => void, onProvider?: (p: TtsProvider) => void) {
  if (typeof window === "undefined") return;
  cancelSpeech();
  const token = speechToken;
  const chunks = splitChunks(text);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }
  playChunk(chunks[0], lang, token, onEnd, chunks.slice(1), onProvider);
}
