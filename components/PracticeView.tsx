"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGeneralPracticeAction, getWeaknessPracticeAction, logPracticeAnswerAction, submitGeneralPracticeResultAction } from "@/lib/actions/practice";
import { incrementMissionAction } from "@/lib/actions/mission";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import { playSfx } from "./playSfx";
import type { QuizContainer } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"];

type Mode = "general" | "weakness";

function hasTopic(res: { quiz: QuizContainer; language: string; topic?: string } | { error: string }): res is { quiz: QuizContainer; language: string; topic: string } {
  return typeof (res as { topic?: unknown }).topic === "string";
}

const STRINGS: Record<Mode, { loading: string; loadingSub: string; badge: string; finished: string; finishedSub: string }> = {
  general: {
    loading: "Menyiapkan Latihan...",
    loadingSub: "Sedang merancang soal latihan umum untuk Anda. Mohon tunggu sebentar.",
    badge: "Latihan Acak",
    finished: "Latihan Selesai!",
    finishedSub: "Kamu berhasil menuntaskan latihan acak ini.",
  },
  weakness: {
    loading: "Menyiapkan Latihan Kelemahan...",
    loadingSub: "Soal disusun AI secara langsung, butuh 20-60 detik. Jangan tutup halaman ini.",
    badge: "Fokus Kelemahan",
    finished: "Latihan Selesai!",
    finishedSub: "Kamu berhasil menuntaskan latihan fokus kelemahan.",
  },
};

export default function PracticeView({
  mode,
  goal,
  ttsLang,
}: {
  mode: Mode;
  goal?: string;
  language: string;
  ttsLang: string;
}) {
  const [phase, setPhase] = useState<"loading" | "answering" | "finished">("loading");
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = mode === "general"
      ? getGeneralPracticeAction()
      : getWeaknessPracticeAction(goal ?? "General");
    load
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          setPhase("answering"); // layar error dirender lewat branch error di bawah
          return;
        }
        setQuiz(res.quiz);
        if (hasTopic(res)) setTopic(res.topic);
        setPhase("answering");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat latihan.");
        setPhase("answering");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, goal, reloadKey]);

  const question = quiz?.questions[idx];
  const strings = STRINGS[mode];

  function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    if (isCorrect) {
      playSfx("correct");
    } else {
      playSfx("wrong");
      setMistakes((m) => m + 1);
      if (mode === "weakness" && topic) {
        logPracticeAnswerAction({
          topic,
          question: question.question,
          selected,
          correct: question.correct_answer,
        }).catch(() => {});
      }
    }
    setShowExplanation(true);
  }

  async function finish() {
    if (submitting) return;
    setSubmitting(true);
    playSfx("winner"); // dalam jendela gesture klik — autoplay policy aman
    if (mode === "general") {
      const res = await submitGeneralPracticeResultAction({ perfect: mistakes === 0 });
      if (res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      setReward(mistakes === 0 ? "1 Nyawa ❤️ & 15 Poin + Koin 🪙" : "10 Poin + Koin 🪙");
    } else {
      await incrementMissionAction("weakness").catch(() => {});
    }
    setSubmitting(false);
    setPhase("finished");
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Latihan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setPhase("loading"); setIdx(0); setMistakes(0); setSelected(null); setShowExplanation(false); setSubmitting(false); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (phase === "loading" || !quiz) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">{strings.loading}</p>
        <p className="text-sm text-slate-400">{strings.loadingSub}</p>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">{strings.finished}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{strings.finishedSub}</p>
        {mode === "general" && reward && (
          <div className="bg-teal-500/10 border border-teal-500/40 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hadiah Didapatkan</p>
            <p className="font-bold text-teal-700 dark:text-teal-400 mt-1">{reward}</p>
          </div>
        )}
        {mode === "weakness" && topic && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topik Fokus</p>
            <p className="font-bold text-amber-700 dark:text-amber-400 mt-1">{topic}</p>
          </div>
        )}
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (!question) return null;

  const isLast = idx === quiz.questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">{strings.badge}</span>
          {mode === "weakness" && topic && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">Fokus Kelemahan: {topic}</span>
          )}
          {question.question_type === "listening" && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">Listening Test</span>
          )}
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${((idx + 1) / quiz.questions.length) * 100}%` }} />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz.questions.length}</p>

      {question.question_type === "listening" && (
        <div className="flex items-center gap-3 mb-4">
          <SpeakButton text={question.listen_text} lang={ttsLang} rate={0.95} />
          <span className="text-xs text-slate-400">Dengarkan audio, lalu pilih jawaban</span>
        </div>
      )}

      <div className="text-lg font-bold mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }} />

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrectOpt = showExplanation && opt === question.correct_answer;
          const isWrongOpt = showExplanation && isSelected && opt !== question.correct_answer;
          return (
            <button
              key={i}
              type="button"
              disabled={showExplanation}
              onClick={() => setSelected(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-colors ${
                isCorrectOpt ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : isWrongOpt ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                : isSelected ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400"
                : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{OPTION_LETTERS[i]}</span>
              <span className="flex-1">{opt}</span>
              <SpeakButton text={opt} lang={ttsLang} rate={0.9} />
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">{selected === question.correct_answer ? "✓ Jawaban Benar!" : "✗ Jawaban Salah!"}</p>
          {selected !== question.correct_answer && <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button type="button" disabled={!selected} onClick={checkAnswer} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
            Cek Jawaban
          </button>
        ) : isLast ? (
          <button type="button" disabled={submitting} onClick={finish} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
            {submitting ? "Menyimpan..." : "Selesai"}
          </button>
        ) : (
          <button type="button" onClick={() => { setIdx((i) => i + 1); setSelected(null); setShowExplanation(false); }} className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
    </div>
  );
}
