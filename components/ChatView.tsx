"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateChatSessionAction } from "@/lib/actions/chat";
import { splitKoreksi } from "@/lib/chat";
import type { ChatMessageItem } from "@/lib/types";

const PRESETS = [
  { key: "Cafe", title: "Kasir Kedai Kopi", desc: "Latihan memesan minuman dan membayar." },
  { key: "Hotel", title: "Resepsionis Hotel", desc: "Latihan check-in dan tanya fasilitas hotel." },
  { key: "Airport", title: "Bandara", desc: "Latihan check-in penerbangan dan imigrasi." },
  { key: "Restaurant", title: "Restoran", desc: "Latihan pesan makanan dan komplain pesanan." },
  { key: "Office", title: "Meeting Kantor", desc: "Latihan presentasi singkat dan diskusi kerja." },
  { key: "Shopping", title: "Pusat Belanja", desc: "Latihan tanya harga, ukuran, dan negosiasi." },
  { key: "Hospital", title: "Rumah Sakit", desc: "Latihan menjelaskan gejala dan konsultasi dokter." },
  { key: "Taxi", title: "Taksi / Ride-Hailing", desc: "Latihan arah tujuan dan percakapan perjalanan." },
];

export default function ChatView({ goal, language }: { goal: string; language: string }) {
  const [phase, setPhase] = useState<"picker" | "loading" | "chat">(goal !== "Bebas" ? "loading" : "picker");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [settingTitle, setSettingTitle] = useState<string | null>(null);
  const [level, setLevel] = useState("A1");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const start = useCallback(async (setting: string, title: string) => {
    setPhase("loading");
    setError(null);
    const res = await getOrCreateChatSessionAction(goal, setting);
    if ("error" in res) {
      setError(res.error);
      setPhase(goal === "Bebas" ? "picker" : "chat");
      return;
    }
    setSessionId(res.sessionId);
    setMessages(res.messages);
    setLevel(res.level);
    setSettingTitle(title);
    setPhase("chat");
  }, [goal]);

  useEffect(() => {
    if (goal !== "Bebas") {
      let cancelled = false;
      getOrCreateChatSessionAction(goal)
        .then((res) => {
          if (cancelled) return;
          if ("error" in res) {
            setError(res.error);
            setPhase("chat");
            return;
          }
          setSessionId(res.sessionId);
          setMessages(res.messages);
          setLevel(res.level);
          setSettingTitle(goal);
          setPhase("chat");
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Gagal memuat sesi obrolan.");
          setPhase("chat");
        });
      return () => {
        cancelled = true;
      };
    }
  }, [goal, reloadKey]);

  async function send() {
    const text = input.trim();
    if (!text || sending || sessionId === null) return;
    setInput("");
    setSending(true);
    setError(null);
    setStreamingText("");
    setMessages((m) => [...m, { id: 0, sender: "user", content: text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Gagal mengirim pesan.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamingText(full);
      }
      full += decoder.decode();
      const final = full.trim();
      if (final) {
        setMessages((m) => [...m, { id: 0, sender: "ai", content: final }]);
      }
    } catch (e) {
      setMessages((m) => m.filter((msg) => !(msg.id === 0 && msg.content === text)));
      setInput(text);
      setError(`Gagal mengirim pesan: ${e instanceof Error ? e.message : "Terjadi kesalahan."}`);
    } finally {
      setStreamingText("");
      setSending(false);
    }
  }

  // ---- picker ----
  if (phase === "picker") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <span className="inline-block px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">Mode Roleplay - {language}</span>
        <h1 className="text-2xl font-extrabold mb-6">Pilih Skenario Obrolan</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => start(p.key, p.title)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all hover:shadow-card-hover"
            >
              <p className="font-bold text-sm">{p.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-8">
          <p className="text-sm font-bold mb-2">Buat skenario custom</p>
          <div className="flex gap-2">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              maxLength={50}
              placeholder="Tulis nama skenario custom..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              type="button"
              onClick={() => {
                const v = customInput.trim();
                if (!v) return;
                setCustoms((c) => (c.some((x) => x.toLowerCase() === v.toLowerCase()) ? c : [...c, v]));
                setCustomInput("");
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            >
              Tambah
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Contoh: Interview Kerja, Imigrasi, Dokter Gigi, Presentasi Kampus</p>
          {customs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Skenario custom Anda:</p>
              <div className="space-y-2">
                {customs.map((c) => (
                  <button key={c} type="button" onClick={() => start(c, c)} className="w-full text-left px-4 py-2.5 rounded-xl border border-teal-500/50 text-sm font-semibold">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-500 mt-4">{error}</p>}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan sesi roleplay...</p>
      </div>
    );
  }

  // ---- chat ----
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col h-[calc(100dvh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-extrabold">Simulasi Peran: {settingTitle}</h1>
          <p className="text-xs text-slate-400">{language} - {level}</p>
        </div>
        <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">Keluar Sesi</Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => {
          if (m.sender === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-xl rounded-tr-none bg-teal-500 text-white text-sm whitespace-pre-wrap">{m.content}</div>
              </div>
            );
          }
          const { main, koreksi } = splitKoreksi(m.content);
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-1.5">
                <div className="px-4 py-2.5 rounded-xl rounded-tl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm whitespace-pre-wrap">
                  {main}
                </div>
                {koreksi && (
                  <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-bold mb-0.5">💡 Koreksi AI</p>
                    <p className="whitespace-pre-wrap">{koreksi}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {(sending && streamingText) && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-xl rounded-tl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-1.5 h-4 bg-teal-500 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}
        {sending && !streamingText && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-xl rounded-tl-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-400">
              Partner AI sedang mengetik...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3">
          <p className="text-xs text-rose-500 flex-1">{error}</p>
          {goal !== "Bebas" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold hover:border-teal-500/50 transition-all hover:shadow-card-hover"
            >
              Coba Lagi
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={sending}
          placeholder={`Ketik balasan dalam bahasa ${language}...`}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"
        />
        <button type="button" onClick={send} disabled={!input.trim() || sending} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
          Kirim
        </button>
      </div>
    </div>
  );
}
