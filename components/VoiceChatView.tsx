"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, PhoneOff } from "lucide-react";
import { sendPolyglotMessageAction, openSessionAction } from "@/lib/actions/chat";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  const [phase, setPhase] = useState<"picker" | "chat">("picker");
  const [scenario, setScenario] = useState("");
  const [status, setStatus] = useState<"menghubungkan" | "mendengarkan" | "berpikir" | "berbicara">("menghubungkan");
  const [userCaption, setUserCaption] = useState<string | null>(null);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [aiTranslation, setAiTranslation] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const { supported, transcript, error: sttError, start: startRec, stop: stopRec } = useSpeechRecognition(ttsLang);

  const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    mendengarkan: { label: "Mendengarkan", variant: "default" },
    berpikir: { label: "Menganalisis", variant: "secondary" },
    berbicara: { label: "Berbicara", variant: "outline" },
    menghubungkan: { label: "Menghubungkan", variant: "secondary" },
  };

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

  function startChat(s: (typeof SCENARIOS)[number]) {
    setScenario(s.title);
    setPhase("chat");
    setStatus("mendengarkan");
    setSessionId(null);
    openSessionAction(s.id, language)
      .then((res) => {
        if (!mountedRef.current) return;
        if ("error" in res) { setError(res.error ?? null); return; }
        setSessionId(res.sessionId);
      })
      .catch(() => { if (mountedRef.current) setError("Gagal memulai percakapan."); });
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserCaption(text);
    setStatus("berpikir");
    sendPolyglotMessageAction(sessionId ?? "", text)
      .then((res) => {
        if (!mountedRef.current) return;
        if ("error" in res) { setError(res.error ?? null); setStatus("mendengarkan"); return; }
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
        <h1 className="text-xl font-extrabold mb-1">Voice Practice</h1>
        <p className="text-sm text-muted-foreground mb-4">{language}</p>
        <div className="grid gap-3">
          {SCENARIOS.map((s) => (
            <Card key={s.id} className="cursor-pointer p-4 hover:border-primary/60 hover:shadow-md transition-all" onClick={() => startChat(s)}>
              <p className="font-bold text-sm">{s.title}</p>
            </Card>
          ))}
        </div>
        {!supported && <p className="text-xs text-destructive mt-4">Browser tidak mendukung speech recognition.</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-5">
      {(error || sttError) && <p className="text-xs text-destructive">{error ?? sttError}</p>}
      <div className="text-center">
        <p className="text-lg font-extrabold">{scenario}</p>
        <p className="text-xs text-muted-foreground">{language}</p>
      </div>
      <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center bg-card shadow-md transition-colors ${
        status === "mendengarkan" ? "border-primary animate-pulse" : status === "berpikir" ? "border-ring" : "border-border"
      }`}>
        {status === "berpikir" ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Mic className="h-8 w-8 text-primary" />}
      </div>
      <Badge variant={statusBadge[status]?.variant ?? "secondary"}>{statusBadge[status]?.label ?? status}</Badge>
      {userCaption && <p className="text-sm text-muted-foreground text-center">&ldquo;{userCaption}&rdquo;</p>}
      {aiCaption && (
        <Card className="w-full p-4 space-y-2">
          <p className="text-sm font-semibold flex items-start gap-1.5">
            <AudioLines className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {aiCaption}
          </p>
          {aiScore && <p className="text-[11px] text-muted-foreground">{aiScore}</p>}
          {aiTranslation && <p className="text-[11px] text-muted-foreground italic">{aiTranslation}</p>}
        </Card>
      )}
      <Button variant="destructive" onClick={() => { setPhase("picker"); window.speechSynthesis?.cancel(); }}>
        <PhoneOff className="h-4 w-4 mr-1.5" /> Hang Up
      </Button>
    </div>
  );
}
