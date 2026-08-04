"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPolyglotMessageAction, saveFlashcardAction } from "@/lib/actions/chat";
import { useSpeechRecognition } from "./useSpeechRecognition";

const SCENARIOS = [
  { id: "Daily Standup", title: "Daily Standup Meeting" },
  { id: "Restaurant", title: "Restaurant Ordering" },
  { id: "Hotel", title: "Hotel Check-in" },
  { id: "Shopping", title: "Shopping" },
  { id: "Hospital", title: "Hospital Visit" },
  { id: "Office", title: "Office Meeting" },
  { id: "Airport", title: "Airport Immigration" },
  { id: "Small Talk", title: "Small Talk" },
];

export default function VoiceChatView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"picker" | "chat">("picker");
  const [scenario, setScenario] = useState("");
  const [status, setStatus] = useState<"menghubungkan" | "mendengarkan" | "berpikir" | "berbicara">("menghubungkan");
  const [userCaption, setUserCaption] = useState<string | null>(null);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [aiTranslation, setAiTranslation] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMutedRef = useRef(false);
  const mountedRef = useRef(true);

  const { supported, transcript, error: sttError, start: startRec, stop: stopRec } = useSpeechRecognition(ttsLang);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLang;
    u.rate = 1.0;
    u.onend = () => { if (mountedRef.current) setStatus("mendengarkan"); };
    u.onerror = () => { if (mountedRef.current) setStatus("mendengarkan"); };
    window.speechSynthesis.speak(u);
  }

  function startChat(s: string) {
    setScenario(s);
    setPhase("chat");
    setStatus("mendengarkan");
  }

  useEffect(() => {
    if (phase !== "chat" || status !== "mendengarkan") return;
    startRec();
    const t = setTimeout(() => stopRec(), 8000);
    return () => { clearTimeout(t); stopRec(); };
  }, [phase, status, startRec, stopRec]);

  useEffect(() => {
    if (!transcript?.trim() || status !== "mendengarkan") return;
    const text = transcript.trim();
    setUserCaption(text);
    setStatus("berpikir");
    sendPolyglotMessageAction(scenario, language, text)
      .then((res) => {
        if (!mountedRef.current) return;
        if ("error" in res) { setError(res.error); setStatus("mendengarkan"); return; }
        setAiCaption(res.analysis.reply_in_target_language);
        setAiTranslation(res.analysis.reply_translation_in_indonesian ?? null);
        setAiScore(`Grammar: ${res.analysis.scores.grammar}/100 · ${res.analysis.scores.fluency}`);
        setStatus("berbicara");
        speak(res.analysis.reply_in_target_language);
      })
      .catch(() => { if (mountedRef.current) { setError("Gagal."); setStatus("mendengarkan"); } });
  }, [transcript]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopRec(); window.speechSynthesis?.cancel(); };
  }, []);

  if (phase === "picker") {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-xl font-extrabold mb-4">Voice Practice · {language}</h1>
        <div className="grid gap-3">
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => startChat(s.id)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-500/50 transition-colors">
              <p className="font-bold text-sm">{s.title}</p>
            </button>
          ))}
        </div>
        {!supported && <p className="text-xs text-rose-500 mt-4">Browser tidak mendukung speech recognition.</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-6">
      {(error || sttError) && <p className="text-xs text-rose-500">{error ?? sttError}</p>}
      <div className="text-center">
        <p className="text-lg font-extrabold">{scenario}</p>
        <p className="text-xs text-slate-400">{language}</p>
      </div>
      <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center
        ${status === "mendengarkan" ? "border-teal-500 animate-pulse" : status === "berpikir" ? "border-indigo-500" : "border-amber-500"}`}>
        <span className="text-3xl">{status === "mendengarkan" ? "🎙️" : status === "berpikir" ? "💭" : "🗣️"}</span>
      </div>
      <p className="text-xs font-bold text-slate-500">{status}</p>
      {userCaption && <p className="text-sm text-slate-500">"{userCaption}"</p>}
      {aiCaption && <p className="text-sm font-semibold text-slate-800">{aiCaption}</p>}
      {aiScore && <p className="text-[11px] text-amber-600">{aiScore}</p>}
      {aiTranslation && <p className="text-[11px] text-slate-400 italic">{aiTranslation}</p>}
      <button onClick={() => { setPhase("picker"); window.speechSynthesis?.cancel(); }}
        className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold">Hang Up</button>
    </div>
  );
}
