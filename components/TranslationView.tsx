"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirectIfSessionExpired } from "./sessionGuard";
import { getTranslationPracticeAction } from "@/lib/actions/translation";
import SpeakButton from "./SpeakButton";
import type { TranslationQuestion } from "@/lib/types";

export default function TranslationView({ ttsLang }: { ttsLang: string }) {
  const [questions, setQuestions] = useState<TranslationQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTranslationPracticeAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error); setError(res.error); }
        else setQuestions(res.questions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat latihan."));
    return () => {
      cancelled = true;
    };
  }, []);

  const question = questions?.[idx];

  function choose(opt: string) {
    if (!question || selected) return;
    setSelected(opt);
    if (opt === question.correct) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (!questions) return;
    if (idx + 1 >= questions.length) setFinished(true);
    else {
      setIdx(idx + 1);
      setSelected(null);
    }
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Terjemahan</p>
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
        <p className="text-2xl font-black">Latihan Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Benar {correctCount}/{questions?.length ?? 0}.
        </p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (!question) {
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
          <h1 className="text-2xl font-extrabold">Latihan Terjemahan 🌐</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pilih arti yang paling tepat untuk kalimat berikut.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
          {idx + 1}/{questions?.length ?? 0}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
        <div className="flex items-start justify-between gap-3 mb-5">
          <p className="text-lg font-bold leading-relaxed">{question.sentence}</p>
          <SpeakButton text={question.sentence} lang={ttsLang} rate={0.85} />
        </div>

        <div className="space-y-2">
          {question.options.map((opt) => {
            const isSelected = selected === opt;
            const isCorrect = selected !== null && opt === question.correct;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => choose(opt)}
                disabled={selected !== null}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  isCorrect
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : isSelected
                      ? "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold ${
            selected === question.correct
              ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400"
          }`}>
            {selected === question.correct
              ? "✅ Benar!"
              : `❌ Jawaban yang benar: "${question.correct}"`}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={next}
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
              >
                {idx + 1 >= (questions?.length ?? 0) ? "Selesai" : "Lanjut"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
