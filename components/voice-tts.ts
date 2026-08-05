let currentAudio: HTMLAudioElement | null = null;
let pendingWebSpeech: ReturnType<typeof setTimeout> | null = null;
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

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const normalized = (v: string) => v.toLowerCase().replace("_", "-");
  const langCode = normalized(lang);
  const exact = voices.find((v) => normalized(v.lang) === langCode);
  if (exact) return exact;
  const prefix = langCode.split("-")[0];
  return voices.find((v) => normalized(v.lang).startsWith(prefix)) ?? null;
}

export function cancelSpeech() {
  speechToken += 1;
  if (pendingWebSpeech) {
    clearTimeout(pendingWebSpeech);
    pendingWebSpeech = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function webSpeech(text: string, lang: string, rate: number, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.cancel();
  pendingWebSpeech = setTimeout(() => {
    pendingWebSpeech = null;
    synth.resume();
    synth.speak(utterance);
  }, 60);
}

function playChunk(
  chunk: string,
  lang: string,
  rate: number,
  token: number,
  onEnd?: () => void,
  rest?: string[]
) {
  fetch(`/api/tts?text=${encodeURIComponent(chunk)}&lang=${encodeURIComponent(lang)}`)
    .then((res) => {
      if (token !== speechToken) return null;
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
          playChunk(rest[0], lang, rate, token, onEnd, rest.slice(1));
        } else {
          onEnd?.();
        }
      };
      const fail = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        webSpeech(chunk, lang, rate, () => {
          if (rest && rest.length > 0 && token === speechToken) {
            playChunk(rest[0], lang, rate, token, onEnd, rest.slice(1));
          } else {
            onEnd?.();
          }
        });
      };
      audio.onended = finish;
      audio.onerror = fail;
      audio.play().catch(fail);
    })
    .catch(() => {
      if (token !== speechToken) return;
      webSpeech(chunk, lang, rate, () => {
        if (rest && rest.length > 0 && token === speechToken) {
          playChunk(rest[0], lang, rate, token, onEnd, rest.slice(1));
        } else {
          onEnd?.();
        }
      });
    });
}

export function speak(text: string, lang: string, rate = 1, onEnd?: () => void) {
  if (typeof window === "undefined") return;
  cancelSpeech();
  const token = speechToken;
  const chunks = splitChunks(text);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }
  playChunk(chunks[0], lang, rate, token, onEnd, chunks.slice(1));
}

