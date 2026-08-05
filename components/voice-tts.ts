let pendingSpeak: ReturnType<typeof setTimeout> | null = null;

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
  if (pendingSpeak) {
    clearTimeout(pendingSpeak);
    pendingSpeak = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speak(text: string, lang: string, rate = 1, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
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
  cancelSpeech();
  pendingSpeak = setTimeout(() => {
    pendingSpeak = null;
    synth.resume();
    synth.speak(utterance);
  }, 60);
}
