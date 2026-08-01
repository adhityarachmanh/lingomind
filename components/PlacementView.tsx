"use client";

import { useState } from "react";
import Link from "next/link";
import { evaluatePlacementAction } from "@/lib/actions/placement";

interface ChatMessage {
  role: "AI" | "User";
  text: string;
}

const SCRIPTED = [
  "Bagus sekali! Bisakah Anda menceritakan kegiatan rutin Anda di akhir pekan?",
  "Menarik! Apa pengalaman paling berkesan dalam hidup Anda sejauh ini?",
  "Terima kasih! Percakapan ini sudah cukup. Silakan klik tombol 'Evaluasi Level Saya' di bawah.",
];

export default function PlacementView({ language }: { language: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "AI",
      text: `Halo! Saya akan melakukan tes penempatan bahasa ${language} singkat untuk Anda. Mari kita mulai: Tolong perkenalkan diri Anda dan ceritakan sedikit tentang hobi Anda dalam bahasa ${language}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userMessages = messages.filter((m) => m.role === "User").length;

  function send() {
    const text = input.trim();
    if (!text || evaluating || result) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "User", text }];
    const userCount = nextMessages.filter((m) => m.role === "User").length;
    if (userCount <= 3) {
      nextMessages.push({ role: "AI", text: SCRIPTED[userCount - 1] });
    }
    setMessages(nextMessages);
    setInput("");
  }

  async function evaluate() {
    if (evaluating) return;
    setEvaluating(true);
    setError(null);
    const res = await evaluatePlacementAction(messages);
    if ("error" in res) {
      setError(res.error);
      setEvaluating(false);
      return;
    }
    setResult(res.level);
    setEvaluating(false);
  }

  if (result) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-2xl font-black">Evaluasi Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Level bahasa Anda saat ini adalah:</p>
        <div className="w-24 h-24 rounded-full bg-teal-500/10 border-4 border-teal-500 flex items-center justify-center">
          <span className="text-3xl font-black text-teal-600 dark:text-teal-400">{result}</span>
        </div>
        <p className="text-xs text-slate-400 max-w-sm">Level ini telah disimpan ke profil Anda. Materi pembelajaran Anda selanjutnya akan disesuaikan dengan level ini.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold mb-1">Tes Penempatan</h1>
      <p className="text-xs font-bold text-slate-400 mb-6">{language}</p>

      <div className="space-y-3 mb-6">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "User" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
              m.role === "User"
                ? "bg-teal-500 text-white rounded-br-sm"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-rose-500 mb-3 text-center">{error}</p>}

      {userMessages >= 3 ? (
        <button
          type="button"
          disabled={evaluating}
          onClick={evaluate}
          className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
        >
          {evaluating ? "Mengevaluasi Level..." : "Selesai & Evaluasi Level Saya"}
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ketik jawaban Anda di sini..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
          <button type="button" onClick={send} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kirim
          </button>
        </div>
      )}
    </div>
  );
}
