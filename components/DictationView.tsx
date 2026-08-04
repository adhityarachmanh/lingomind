"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { redirectIfSessionExpired } from "./sessionGuard";
import { getSentencesAction } from "@/lib/actions/pronunciation";
import { isDictationCorrect } from "@/lib/dictation";
import SpeakButton from "./SpeakButton";

export default function DictationView({ ttsLang }: { ttsLang: string }) {
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSentencesAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error); setError(res.error); }
        else setSentences(res.sentences);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat kalimat."));
    return () => {
      cancelled = true;
    };
  }, []);

  const sentence = sentences?.[idx];
  const result = useMemo(() => {
    if (!checked || !sentence) return null;
    return { correct: isDictationCorrect(input, sentence) };
  }, [checked, input, sentence]);

  function check() {
    if (!sentence || checked) return;
    setChecked(true);
    if (isDictationCorrect(input, sentence)) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (!sentences) return;
    if (idx + 1 >= sentences.length) setFinished(true);
    else {
      setIdx(idx + 1);
      setInput("");
      setChecked(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Dikte</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Dikte Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Benar {correctCount}/{sentences?.length ?? 0} kalimat.
        </p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (!sentence) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Latihan Dikte ✍️</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dengarkan kalimat, lalu ketik apa yang kamu dengar.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
          {idx + 1}/{sentences?.length ?? 0}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-5">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kalimat {idx + 1}</p>
          <SpeakButton text={sentence} lang={ttsLang} rate={0.85} />
        </div>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") check(); }}
          placeholder="Ketik yang kamu dengar..."
          disabled={checked}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-base focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
        />

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold ${
            result.correct
              ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400"
          }`}>
            {result.correct ? "✅ Benar!" : `❌ Belum tepat. Kalimat aslinya: "${sentence}"`}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {!checked ? (
            <button
              type="button"
              onClick={check}
              disabled={!input.trim()}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold"
            >
              Cek
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
            >
              {idx + 1 >= (sentences?.length ?? 0) ? "Selesai" : "Lanjut"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
