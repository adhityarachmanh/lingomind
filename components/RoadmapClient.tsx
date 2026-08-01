"use client";

import { useState } from "react";
import Link from "next/link";

export default function RoadmapClient({
  topic,
  unlocked,
  current,
}: {
  topic: string;
  unlocked: boolean;
  current: boolean;
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
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">Mulai Topik</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{topic}</p>
            <div className="space-y-2">
              <Link href={`/lesson/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold text-center">
                📚 Pelajari Materi
              </Link>
              <Link href={`/quiz/${encodeURIComponent(topic)}`} className="block w-full px-4 py-3 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-sm font-bold text-center">
                📝 Latihan Kuis
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
