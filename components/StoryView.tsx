"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { completeStoryAction, getStoryAction } from "@/lib/actions/story";
import SpeakButton from "./SpeakButton";
import type { StoryData } from "@/lib/types";

export default function StoryView({ goal, language, ttsLang }: { goal: string; language: string; ttsLang: string }) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null); // null = belum
  const [completed, setCompleted] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStoryAction(goal)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setStory(res.story);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat cerita.");
      });
    return () => {
      cancelled = true;
    };
  }, [goal, reloadKey]);

  function checkAnswer(opt: string) {
    if (answered !== null) return;
    setSelected(opt);
    const seg = story?.segments[idx];
    if (!seg?.question) return;
    setAnswered(opt.toLowerCase() === seg.question.correct_answer.toLowerCase());
  }

  async function next() {
    if (!story) return;
    if (idx + 1 >= story.segments.length) {
      setCompleted(true);
      const res = await completeStoryAction(goal).catch(() => ({ message: "Cerita selesai. (Gagal menyimpan skor)" }));
      setReward("message" in res && res.message === "ok" ? "Selamat! Anda mendapat 20 XP & Koin!" : res.message ?? "Cerita selesai.");
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setAnswered(null);
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">⚠️ Gagal Memuat Cerita</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Peta</Link>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan Cerita Interaktif...</p>
        <p className="text-sm text-slate-400">AI sedang menulis cerita pendek bahasa {language} yang sesuai dengan level Anda. Mohon tunggu sebentar.</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Cerita Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Anda telah menyelesaikan cerita &quot;{story.title}&quot;. Sangat bagus untuk melatih pendengaran Anda!</p>
        {reward && (
          <div className="bg-teal-500/10 border border-teal-500/40 rounded-xl p-4">
            <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{reward}</p>
          </div>
        )}
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Selesai & Kembali
        </Link>
      </div>
    );
  }

  const segment = story.segments[idx];
  const total = story.segments.length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(idx / total) * 100}%` }} />
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">{story.title}</h1>
          <p className="text-sm italic text-slate-400">{story.title_translation}</p>
        </div>
        <SpeakButton text={segment.text} lang={ttsLang} rate={0.9} />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
        {segment.speaker && (
          <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold mb-3">
            {segment.speaker}
          </span>
        )}
        <p className="text-base leading-relaxed whitespace-pre-wrap">{segment.text}</p>
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">{segment.translation}</p>
        </div>
      </div>

      {segment.question && (
        <div className="mt-6">
          <p className="font-bold mb-3">{segment.question.question_text}</p>
          <div className="space-y-2">
            {segment.question.options.map((opt, i) => {
              const isCorrect = answered !== null && opt.toLowerCase() === segment.question!.correct_answer.toLowerCase();
              const isWrong = answered !== null && selected === opt && !isCorrect;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered !== null}
                  onClick={() => checkAnswer(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    isCorrect ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : isWrong ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : answered !== null ? "border-slate-200 dark:border-slate-700 opacity-60"
                    : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered !== null && (
            <div className={`mt-4 p-4 rounded-xl border text-sm ${answered ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
              <p className="font-black mb-1">{answered ? "✨ Benar!" : "❌ Salah"}</p>
              <p className="text-slate-600 dark:text-slate-300">{segment.question.explanation}</p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={next}
        disabled={segment.question !== null && answered === null}
        className="mt-6 w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
      >
        Lanjut
      </button>
    </div>
  );
}
