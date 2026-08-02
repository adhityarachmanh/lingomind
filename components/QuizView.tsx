"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getQuizAction, recordAnswerAction, submitQuizResultAction } from "@/lib/actions/quiz";
import { submitBattleScoreAction } from "@/lib/actions/battle";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import { playSfx } from "./playSfx";
import type { QuizContainer } from "@/lib/types";

type Phase =
  | { name: "loading" }
  | { name: "hearts"; hearts: number }
  | { name: "answering" }
  | { name: "finished"; passed: boolean; score: number };

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function QuizView({
  goal,
  language,
  ttsLang,
  initialHearts,
  ptsPerQuestion,
  battleId,
}: {
  goal: string;
  language: string;
  ttsLang: string;
  initialHearts: number;
  ptsPerQuestion: number;
  battleId?: number;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(initialHearts);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battleMessage, setBattleMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (initialHearts <= 0) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setPhase({ name: "hearts", hearts: 0 });
      });
    } else {
      getQuizAction(goal)
        .then((res) => {
          if (cancelled) return;
          if ("error" in res) {
            setError(res.error);
            setPhase({ name: "hearts", hearts: initialHearts });
            return;
          }
          setQuiz(res.quiz);
          setPhase({ name: "answering" });
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Gagal memuat kuis.");
          setPhase({ name: "hearts", hearts: initialHearts });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [goal, initialHearts, reloadKey]);

  const question = quiz?.questions[idx];

  async function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    const pts = isCorrect ? ptsPerQuestion : 0;

    recordAnswerAction({
      language,
      question: question.question,
      selected,
      correct: question.correct_answer,
      explanation: question.explanation,
      questionType: question.question_type,
    })
      .then((res) => {
        if ("hearts" in res) setHearts(res.hearts);
      })
      .catch(() => {});

    if (isCorrect) {
      playSfx("correct");
      setScore((s) => s + pts);
      setCorrectCount((c) => c + 1);
    } else {
      playSfx("wrong");
      setHearts((h) => Math.max(0, h - 1));
    }
    setShowExplanation(true);
  }

  async function finishQuiz() {
    if (submitting) return;
    setSubmitting(true);
    let res;
    try {
      res = await submitQuizResultAction({ goal, language, score, correctCount });
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : "Gagal menyimpan skor.");
      return;
    }
    if ("error" in res) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    playSfx("winner");
    if (battleId) {
      const bres = await submitBattleScoreAction(battleId, score).catch(() => null);
      if (bres?.message) setBattleMessage(bres.message);
    }
    const required = ptsPerQuestion * 5;
    setPhase({ name: "finished", passed: score >= required, score });
  }

  if (phase.name === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Merancang Kuis Kustom...</p>
        <p className="text-sm text-slate-400">Sedang menyusun soal yang disesuaikan dengan level bahasa Anda. Siap-siap belajar hal baru!</p>
      </div>
    );
  }

  if (phase.name === "hearts") {
    if (error) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-2xl font-black">Gagal Memuat Kuis</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase({ name: "loading" });
              setReloadKey((k) => k + 1);
            }}
            className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
          >
            Coba Lagi
          </button>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Beranda</Link>
        </div>
      );
    }
    if (hearts <= 0) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-4xl">💔</p>
          <p className="text-2xl font-black">Nyawa Kamu Habis!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Kamu butuh minimal 1 Nyawa untuk mengikuti kuis ini. Silakan kembali ke Beranda untuk mengisi ulang nyawa kamu.
          </p>
          <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kembali ke Beranda
          </Link>
        </div>
      );
    }
  }

  if (phase.name === "finished") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Kuis Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Skor Anda berhasil dikirim ke database Neon.</p>
        {battleMessage && <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-2">{battleMessage}</p>}
        <p className="text-3xl font-black text-teal-600 dark:text-teal-400">+{phase.score} Poin</p>
        {phase.passed ? (
          <div className="max-w-md bg-teal-500/10 border border-teal-500/40 rounded-2xl p-4">
            <p className="font-bold text-teal-700 dark:text-teal-400">🌟 Luar Biasa! Nilai Sempurna!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Anda telah menguasai materi ini. Tahap selanjutnya telah terbuka!</p>
          </div>
        ) : (
          <div className="max-w-md bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
            <p className="font-bold text-amber-700 dark:text-amber-400">🔒 Topik Berikutnya Masih Terkunci</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sistem LingoMind mensyaratkan Anda untuk mendapatkan nilai sempurna (semua benar) untuk membuktikan penguasaan materi.
              Anda butuh {ptsPerQuestion * 5} Poin. Ayo coba lagi!
            </p>
          </div>
        )}
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Roadmap
        </Link>
      </div>
    );
  }

  if (!question) return null;

  const isLast = idx === (quiz?.questions.length ?? 0) - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
            Latihan {language}
          </span>
          {question.question_type === "listening" && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">
              Listening Test
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">
            ❤️ {hearts}
          </span>
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${((idx + 1) / (quiz?.questions.length ?? 5)) * 100}%` }}
        />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz?.questions.length}</p>

      {question.question_type === "listening" && (
        <div className="flex items-center gap-3 mb-4">
          <SpeakButton text={question.listen_text} lang={ttsLang} rate={0.95} />
          <span className="text-xs text-slate-400">Dengarkan audio, lalu pilih jawaban</span>
        </div>
      )}

      <div
        className="text-lg font-bold mb-6 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.question) }}
      />

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
                isCorrectOpt
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : isWrongOpt
                    ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : isSelected
                      ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400"
                      : "border-slate-200 dark:border-slate-700 hover:border-teal-500/50"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">
                {OPTION_LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
              <SpeakButton text={opt} lang={ttsLang} rate={0.9} />
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className={`mt-4 p-4 rounded-2xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">
            {selected === question.correct_answer ? "✓ Jawaban Benar!" : "✗ Jawaban Salah!"}
          </p>
          {selected !== question.correct_answer && (
            <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>
          )}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button
            type="button"
            disabled={!selected}
            onClick={checkAnswer}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
          >
            Cek Jawaban
          </button>
        ) : isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={finishQuiz}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
          >
            {submitting ? "Menyimpan..." : "Selesai & Simpan Skor"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIdx((i) => i + 1);
              setSelected(null);
              setShowExplanation(false);
            }}
            className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
          >
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 mt-3 text-center">{error}</p>}
    </div>
  );
}
