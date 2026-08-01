"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOrCreateChatSessionAction, sendChatMessageAction } from "@/lib/actions/chat";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { splitKoreksi } from "@/lib/chat";
import type { ChatMessageItem } from "@/lib/types";

const PRESETS = [
  { key: "Cafe", title: "Kasir Kedai Kopi", desc: "Latihan memesan minuman secara verbal." },
  { key: "Hotel", title: "Resepsionis Hotel", desc: "Latihan check-in dan tanya fasilitas hotel." },
  { key: "Airport", title: "Imigrasi Bandara", desc: "Latihan menjawab pertanyaan petugas imigrasi." },
  { key: "Restaurant", title: "Pelayan Restoran", desc: "Latihan verbal memesan menu utama." },
  { key: "Office", title: "Meeting Kantor", desc: "Latihan presentasi singkat dan diskusi kerja." },
  { key: "Shopping", title: "Pusat Belanja", desc: "Latihan tanya harga, ukuran, dan negosiasi." },
  { key: "Hospital", title: "Rumah Sakit", desc: "Latihan menjelaskan gejala dan konsultasi dokter." },
  { key: "Taxi", title: "Taksi / Ride-Hailing", desc: "Latihan arah tujuan dan percakapan perjalanan." },
];

const STATUS_LABEL: Record<string, string> = {
  menghubungkan: "Menghubungkan asisten AI...",
  mendengarkan: "Silakan berbicara... (AI Mendengarkan)",
  berpikir: "AI sedang berpikir...",
  berbicara: "AI sedang berbicara...",
  muted: "Mikrofon Dinonaktifkan (Muted)",
};

export default function VoiceChatView({ goal, language, ttsLang }: { goal: string; language: string; ttsLang: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"picker" | "chat">(goal !== "Bebas" ? "chat" : "picker");
  const [status, setStatus] = useState<"menghubungkan" | "mendengarkan" | "berpikir" | "berbicara" | "muted">("menghubungkan");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [settingTitle, setSettingTitle] = useState<string | null>(null);
  const [userCaption, setUserCaption] = useState<string | null>(null);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [aiKoreksi, setAiKoreksi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const statusRef = useRef(status);
  // eslint-disable-next-line react-hooks/refs
  statusRef.current = status;
  const sessionIdRef = useRef(sessionId);
  // eslint-disable-next-line react-hooks/refs
  sessionIdRef.current = sessionId;
  const messagesRef = useRef(messages);
  // eslint-disable-next-line react-hooks/refs
  messagesRef.current = messages;

  const { supported, listening, transcript, error: sttError, timedOut, start: startRec, stop: stopRec, setError: setSttError } = useSpeechRecognition(ttsLang);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLang;
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  const startSession = useCallback(async (setting: string, title: string) => {
    setPhase("chat");
    setStatus("menghubungkan");
    setError(null);
    const res = await getOrCreateChatSessionAction(goal, setting);
    if ("error" in res) {
      setError(`Gagal memuat sesi panggilan: ${res.error}`);
      setStatus("muted");
      return;
    }
    setSessionId(res.sessionId);
    setMessages(res.messages);
    setSettingTitle(title);
    const lastAi = [...res.messages].reverse().find((m) => m.sender === "ai");
    if (lastAi) {
      const { main, koreksi } = splitKoreksi(lastAi.content);
      setAiCaption(main);
      setAiKoreksi(koreksi);
      setStatus("berbicara");
      speak(main);
      window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 3500);
    } else {
      setStatus(isMutedRef.current ? "muted" : "mendengarkan");
    }
  }, [goal]);

  const isMutedRef = useRef(isMuted);
  // eslint-disable-next-line react-hooks/refs, react-hooks/immutability
  isMutedRef.current = isMuted;

  useEffect(() => {
    if (goal !== "Bebas") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startSession(goal, goal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, reloadKey]);

  // transcript dari STT → kirim
  useEffect(() => {
    if (transcript === null || transcript.trim() === "") return;
    if (statusRef.current !== "mendengarkan" && statusRef.current !== "berpikir") return;
    const sid = sessionIdRef.current;
    if (sid === null) return;
    const text = transcript.trim();
    setUserCaption(text);
    setStatus("berpikir");
    stopSpeaking();
    setSttError(null);
    sendChatMessageAction(sid, text)
      .then((res) => {
        if ("error" in res) {
          setError(`Gagal mengirim pesan suara: ${res.error}`);
          setStatus(isMutedRef.current ? "muted" : "mendengarkan");
          return;
        }
        setMessages(res.messages);
        const lastAi = [...res.messages].reverse().find((m) => m.sender === "ai");
        if (lastAi) {
          const { main, koreksi } = splitKoreksi(lastAi.content);
          setAiCaption(main);
          setAiKoreksi(koreksi);
          setStatus("berbicara");
          speak(main);
          window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 4000);
        } else {
          setStatus(isMutedRef.current ? "muted" : "mendengarkan");
        }
      })
      .catch((e: unknown) => {
        setError(`Gagal mengirim pesan suara: ${e instanceof Error ? e.message : "Terjadi kesalahan."}`);
        setStatus(isMutedRef.current ? "muted" : "mendengarkan");
      });
  }, [transcript]);

  // loop: saat mendengarkan → mulai STT; timeout → restart
  useEffect(() => {
    if (status !== "mendengarkan" || isMuted) return;
    startRec();
    const t = window.setTimeout(() => stopRec(), 8000);
    return () => {
      window.clearTimeout(t);
      stopRec();
    };
  }, [status, isMuted, startRec, stopRec]);

  useEffect(() => {
    if (timedOut) {
      const t = window.setTimeout(() => setStatus(isMutedRef.current ? "muted" : "mendengarkan"), 1000);
      return () => window.clearTimeout(t);
    }
  }, [timedOut]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sttError) setError(sttError);
  }, [sttError]);

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    if (next) {
      stopRec();
      stopSpeaking();
      setStatus("muted");
    } else {
      setStatus("mendengarkan");
    }
  }

  function hangUp() {
    stopRec();
    stopSpeaking();
    if (goal !== "Bebas") {
      router.push("/roadmap");
    } else {
      setSessionId(null);
      setMessages([]);
      setSettingTitle(null);
      setUserCaption(null);
      setAiCaption(null);
      setAiKoreksi(null);
      setPhase("picker");
      setStatus("menghubungkan");
    }
  }

  if (phase === "picker") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">Gemini Live Voice - {language}</span>
        <h1 className="text-2xl font-extrabold mb-6">Pilih Partner Panggilan Suara</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => startSession(p.key, p.title)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-colors">
              <p className="font-bold text-sm">{p.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-sm font-bold mb-2">Buat Skenario Telepon Kustom</p>
          <div className="flex gap-2">
            <input value={customInput} onChange={(e) => setCustomInput(e.target.value)} maxLength={50}
              placeholder="Contoh: Wawancara Visa, Telpon Customer Service..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            <button type="button" onClick={() => { const v = customInput.trim(); if (v) { setCustoms((c) => (c.some((x) => x.toLowerCase() === v.toLowerCase()) ? c : [...c, v])); setCustomInput(""); } }}
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Telepon Now</button>
          </div>
          {customs.length > 0 && (
            <div className="mt-4 space-y-2">
              {customs.map((c) => (
                <button key={c} type="button" onClick={() => startSession(c, c)} className="w-full text-left px-4 py-2.5 rounded-xl border border-teal-500/50 text-sm font-semibold">{c}</button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-500 mt-4">{error}</p>}
      </div>
    );
  }

  const borderColor =
    status === "mendengarkan" ? "border-teal-500" :
    status === "berbicara" ? "border-amber-500" :
    status === "berpikir" ? "border-indigo-500" : "border-slate-400";

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 flex flex-col items-center gap-6">
      {error && (
        <div className="w-full flex items-start justify-between gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-lg font-extrabold">Live Voice</p>
          <p className="text-xs text-slate-400">{settingTitle} · {language}</p>
        </div>
        <span className="text-xs font-bold text-slate-400">{status === "muted" ? "Muted" : status === "mendengarkan" ? "Mendengarkan" : status === "berbicara" ? "Berbicara" : "Memproses"}</span>
      </div>

      <div className="relative">
        <div className={`w-28 h-28 rounded-full border-4 ${borderColor} ${status === "mendengarkan" ? "animate-pulse" : ""} flex items-center justify-center overflow-hidden bg-white dark:bg-slate-900`}>
          <img
            src={status === "berbicara" ? "/avatar_male_talking.gif" : "/avatar_male_idle.png"}
            alt="Avatar AI"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {aiCaption && (
        <div className="w-full text-center px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm">
          {aiCaption}
        </div>
      )}

      <div className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-bold text-slate-500 dark:text-slate-300">
        {STATUS_LABEL[status]}
      </div>

      <div className="w-full space-y-3 text-xs">
        {userCaption && (
          <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <p className="font-bold text-slate-400 mb-1">Anda berkata</p>
            <p className="text-slate-600 dark:text-slate-300">&quot;{userCaption}&quot;</p>
          </div>
        )}
        {aiKoreksi && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-400">
            <p className="font-bold mb-0.5">💡 Koreksi AI</p>
            <p className="whitespace-pre-wrap">{aiKoreksi}</p>
          </div>
        )}
        {!userCaption && !aiKoreksi && (
          <p className="text-center text-slate-400">Transkrip ucapan akan muncul di sini...</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!supported}
          className="w-14 h-14 rounded-full border border-slate-300 dark:border-slate-700 text-xl flex items-center justify-center disabled:opacity-40"
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>
        <button
          type="button"
          onClick={hangUp}
          className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-2xl flex items-center justify-center shadow-lg"
        >
          📞
        </button>
      </div>
    </div>
  );
}
