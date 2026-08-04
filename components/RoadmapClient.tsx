"use client";

import { useState } from "react";
import Link from "next/link";

export default function RoadmapClient({
  topic,
  unlocked,
  current,
  masteryLevel = 0,
  reviewDue = false,
}: {
  topic: string;
  unlocked: boolean;
  current: boolean;
  masteryLevel?: number;
  reviewDue?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!unlocked) {
    return (
      <button
        type="button"
        disabled
        className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm opacity-60 cursor-not-allowed"
      >
        🔒 {topic}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
          current
            ? "border-teal-500/60 bg-teal-500/10 text-teal-600 dark:text-teal-400"
            : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
        }`}
      >
        {current && "▶ "}
        {topic}
        {masteryLevel > 0 && (
          <span className="ml-2 text-[11px] tracking-tight" title={`Mastery ${masteryLevel}/5`}>
            {"●".repeat(masteryLevel)}
            <span className="opacity-30">{"●".repeat(5 - masteryLevel)}</span>
          </span>
        )}
        {reviewDue && (
          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black" title="Jadwal re-review sudah tiba">
            🔄
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">Mulai Topik</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{topic}</p>
            {masteryLevel > 0 && (
              <p className="text-[11px] text-slate-400 mb-4">
                Mastery {masteryLevel}/5
                {reviewDue && <span className="text-amber-600 dark:text-amber-400 font-bold"> · jadwal re-review tiba — ulangi materi agar tidak lupa</span>}
              </p>
            )}
            <div className="space-y-2">
              <Link href={`/lesson/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold text-center">
                {reviewDue ? "🔄 Re-review Materi" : "📚 Pelajari Materi"}
              </Link>
              <Link href={`/quiz/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-sm font-bold text-center">
                📝 Latihan Kuis
              </Link>
              <Link href={`/chat/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-all hover:shadow-card-hover">
                💬 Chat Percakapan
                <span className="block text-[11px] font-normal text-slate-400 mt-1">Simulasi chat interaktif berbasis teks dengan AI</span>
              </Link>
              <Link href={`/voice-chat/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-all hover:shadow-card-hover">
                🎙️ Roleplay Suara
                <span className="block text-[11px] font-normal text-slate-400 mt-1">Praktik berbicara langsung dengan AI</span>
              </Link>
              <Link href={`/story/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold text-center hover:border-teal-500/50 transition-all hover:shadow-card-hover">
                🎧 Mode Story
                <span className="block text-[11px] font-normal text-slate-400 mt-1">Cerita interaktif & mendengarkan</span>
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
