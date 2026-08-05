"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { openSessionAction, sendPolyglotMessageAction } from "@/lib/actions/chat";
import { getChatHomeAction, getSessionMessagesAction, type ScenarioSummary, type SessionDto } from "@/lib/actions/scenario";
import { TTS_LANG_MAP } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageBadge } from "./chat-lists";
import { ScenarioCard } from "./chat-lists";
import { speak } from "./voice-tts";

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type Status = "idle" | "listening" | "processing";

export default function VoiceChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiTranslation, setAiTranslation] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const ttsLang = TTS_LANG_MAP[session?.language ?? ""] ?? "en-US";

  useEffect(() => {
    if (sessionId) {
      (async () => {
        setSession(null);
        setAiReply("");
        setAiTranslation("");
        setUserText("");
        const res = await getSessionMessagesAction(sessionId);
        if ("error" in res) {
          toast.error(res.error ?? "Percakapan tidak ditemukan.");
          router.replace("/voice-chat");
          return;
        }
        setSession(res.session);
        const lastAi = [...res.messages].reverse().find((m) => m.role === "ai");
        if (lastAi) {
          setAiReply(lastAi.content);
          const analysis = lastAi.analysisJson as { reply_translation_in_indonesian?: string } | null;
          setAiTranslation(analysis?.reply_translation_in_indonesian ?? "");
        }
      })();
    } else {
      (async () => {
        const res = await getChatHomeAction();
        if ("error" in res) { toast.error(res.error); return; }
        setScenarios(res.scenarios);
      })();
    }
  }, [sessionId, router]);

  async function openScenario(s: ScenarioSummary) {
    const res = await openSessionAction(s.id, s.language);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/voice-chat?session=${res.sessionId}`);
  }

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
    }
  }, [recognition]);

  const startListening = useCallback(() => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition tidak didukung browser ini.");
      return;
    }
    const rec = new SR();
    rec.lang = ttsLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = async (event) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("idle");
        toast.error("Tidak ada koneksi internet. Coba lagi.");
        return;
      }
      const text = event.results[0][0].transcript;
      setUserText(text);
      setStatus("processing");
      if (!sessionId) return;
      try {
        const res = await sendPolyglotMessageAction(sessionId, text);
        setStatus("idle");
        if ("error" in res) { toast.error(res.error); return; }
        setAiReply(res.analysis.reply_in_target_language);
        setAiTranslation(res.analysis.reply_translation_in_indonesian);
        speak(res.analysis.reply_in_target_language, ttsLang);
      } catch (e) {
        setStatus("idle");
        toast.error(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      }
    };
    rec.onerror = () => {
      setStatus("idle");
      toast.error("Gagal mendengarkan. Coba lagi.");
    };
    rec.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
    setRecognition(rec);
    setStatus("listening");
    rec.start();
  }, [ttsLang, sessionId]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-2">Voice Chat</h1>
        <p className="text-sm text-muted-foreground mb-6">Pilih skenario untuk latihan bicara dengan AI.</p>
        {scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada skenario. Buat dulu di halaman Chat.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 self-start">
        <Button variant="ghost" size="icon" onClick={() => router.push("/voice-chat")} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-extrabold">{session.scenarioTitle}</h1>
        <LanguageBadge language={session.language} />
      </div>

      <div className="w-full rounded-2xl border border-border bg-card p-5 text-center space-y-2">
        {userText && <p className="text-sm text-muted-foreground">Anda: {userText}</p>}
        {aiReply && (
          <>
            <p className="text-lg font-semibold leading-relaxed">{aiReply}</p>
            {aiTranslation && <p className="text-xs text-muted-foreground italic">{aiTranslation}</p>}
          </>
        )}
        {!aiReply && !userText && <p className="text-sm text-muted-foreground">Tekan tombol mikrofon untuk mulai berbicara.</p>}
      </div>

      <Button
        size="lg"
        className="h-16 w-16 rounded-full"
        variant={status === "listening" ? "destructive" : "default"}
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "processing"}
        aria-label={status === "listening" ? "Berhenti" : "Mulai bicara"}
      >
        {status === "processing" ? <MicOff className="h-6 w-6 animate-pulse" /> : status === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>
      <p className="text-xs text-muted-foreground">
        {status === "listening" ? "Mendengarkan... (klik untuk berhenti)" : status === "processing" ? "AI merespons..." : "Klik mikrofon untuk berbicara"}
      </p>
    </div>
  );
}
