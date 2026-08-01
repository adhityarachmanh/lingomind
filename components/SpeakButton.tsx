"use client";

import { useEffect, useRef, useState } from "react";

export default function SpeakButton({
  text,
  lang,
  rate = 0.95,
}: {
  text: string;
  lang: string;
  rate?: number;
}) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  function toggle() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Putar suara"
      className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
    >
      {speaking ? "⏹" : "🔊"}
    </button>
  );
}
