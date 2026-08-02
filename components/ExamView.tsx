"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkExamCooldownAction, consumeRetakeTicketAction, deductExamHeartAction, getExamAction, submitExamResultAction } from "@/lib/actions/exam";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { QuizContainer } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D"];

type Phase =
  | { name: "checking" }
  | { name: "gates"; onCooldown: boolean; cooldownMessage: string; tickets: number }
  | { name: "ready" }
  | { name: "loading" }
  | { name: "answering" }
  | { name: "result"; passed: boolean; correct: number; total: number; passingScore: number; score: number; submitting: boolean };

export default function ExamView({
  level,
  language,
  ttsLang,
  initialHearts,
}: {
  level: string;
  language: string;
  ttsLang: string;
  initialHearts: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const [gateError, setGateError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizContainer | null>(null);
  const [ptsPerQuestion, setPtsPerQuestion] = useState(10);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [hearts, setHearts] = useState(initialHearts);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketPending, setTicketPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadExam = useCallback(async () => {
    setPhase({ name: "loading" });
    const res = await getExamAction(level);
    if ("error" in res) {
      setLoadingError(res.error);
      setPhase({ name: "ready" }); // error dirender di branch error bawah
      return;
    }
    setQuiz(res.quiz);
    setPtsPerQuestion(res.ptsPerQuestion);
    setPhase({ name: "answering" });
  }, [level]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cooldownRes = await checkExamCooldownAction(level);
      if (cancelled) return;
      if ("error" in cooldownRes) {
        setGateError(cooldownRes.error);
        return;
      }
      if (initialHearts <= 0) {
        setPhase({ name: "gates", onCooldown: false, cooldownMessage: "", tickets: 0 });
        return; // hearts screen dirender berdasarkan initialHearts <= 0
      }
      setPhase({ name: "gates", onCooldown: cooldownRes.onCooldown, cooldownMessage: cooldownRes.message, tickets: cooldownRes.tickets });
    })().catch((e: unknown) => {
      if (cancelled) return;
      setGateError(e instanceof Error ? e.message : "Gagal memeriksa ujian.");
    });
    return () => {
      cancelled = true;
    };
  }, [level, reloadKey]);

  async function useTicket() {
    if (ticketPending) return;
    setTicketPending(true);
    try {
      const res = await consumeRetakeTicketAction(level);
      if ("error" in res) {
        setGateError(res.error ?? "Gagal menggunakan tiket.");
        return;
      }
      setReloadKey((k) => k + 1);
    } finally {
      setTicketPending(false);
    }
  }

  function checkAnswer() {
    if (!question || !selected) return;
    const isCorrect = selected === question.correct_answer;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else {
      setHearts((h) => Math.max(0, h - 1));
      deductExamHeartAction().catch(() => {});
    }
    setShowExplanation(true);
  }

  async function submitResult() {
    const total = quiz?.questions.length ?? 0;
    const passingScore = Math.ceil(total * 0.75);
    const passed = correctCount >= passingScore;
    const score = correctCount * ptsPerQuestion;
    setPhase({ name: "result", passed, correct: correctCount, total, passingScore, score, submitting: true });
    setSubmitError(null);
    try {
      const res = await submitExamResultAction({ passed, score });
      if ("error" in res) {
        setSubmitError(res.error);
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Gagal menyimpan hasil ujian.");
    } finally {
      setPhase({ name: "result", passed, correct: correctCount, total, passingScore, score, submitting: false });
    }
  }

  const question = quiz?.questions[idx];

  // ---- gates / error screens ----
  if (gateError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Ujian Belum Terbuka</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{gateError}</p>
        <Link href="/roadmap" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (initialHearts <= 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">💔</p>
        <p className="text-2xl font-black">Nyawa Kamu Habis!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">Kamu butuh minimal 1 Nyawa untuk mengikuti ujian ini.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Isi Ulang di Beranda</Link>
      </div>
    );
  }

  if (phase.name === "checking") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Memeriksa Status Ujian...</p>
      </div>
    );
  }

  if (phase.name === "gates" && phase.onCooldown) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">⏳</p>
        <p className="text-2xl font-black">Ujian Terkunci</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Anda baru saja gagal dalam ujian ini. Silakan istirahat dan pelajari kembali materi.</p>
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Bisa diulang dalam: {phase.cooldownMessage}</p>
        {phase.tickets > 0 ? (
          <button type="button" disabled={ticketPending} onClick={useTicket} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
            Gunakan 1 Tiket
          </button>
        ) : (
          <>
            <p className="text-xs text-slate-400">Tidak punya Tiket Ujian Ulang.</p>
            <Link href="/shop" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">Beli Tiket di Toko 🏪</Link>
          </>
        )}
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (phase.name === "gates" || phase.name === "ready") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🎓</p>
        <p className="text-2xl font-black">Siap Ujian?</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Ujian ini akan menguji pemahaman Anda di level {level}. Jika gagal, Anda harus menunggu 24 jam untuk mengulang.</p>
        {loadingError && <p className="text-xs text-rose-500 max-w-md">{loadingError}</p>}
        <button type="button" onClick={() => { setLoadingError(null); loadExam(); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Mulai Ujian 🚀
        </button>
        <Link href="/roadmap" className="text-xs text-slate-400 hover:underline">Kembali ke Roadmap</Link>
      </div>
    );
  }

  if (phase.name === "loading" || !question) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyusun Soal Ujian...</p>
        <p className="text-sm text-slate-400">Mempersiapkan materi ujian sesuai kurikulum. Proses ini mungkin memakan waktu hingga 30 detik untuk memastikan kualitas soal.</p>
      </div>
    );
  }

  if (phase.name === "result") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-4xl">{phase.passed ? "🎉" : "💪"}</p>
        <p className="text-2xl font-black">{phase.passed ? "LULUS UJIAN!" : "BELUM LULUS"}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          {phase.passed
            ? `Selamat! Anda telah menguasai materi level ${level} dan siap untuk melangkah lebih jauh.`
            : "Jangan menyerah! Pelajari lagi bagian yang kurang dan coba kembali ujian ini nanti."}
        </p>
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span>Skor Anda</span>
            <span>{phase.correct} / {phase.total}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(phase.correct / phase.total) * 100}%` }} />
          </div>
        </div>
        <p className="text-xs text-slate-400">Batas kelulusan minimal {phase.passingScore} benar (75%).</p>
        {submitError && <p className="text-xs text-rose-500 max-w-md">{submitError}</p>}
        {phase.submitting ? (
          <p className="text-sm font-bold text-slate-400">Menyimpan...</p>
        ) : (
          <button type="button" onClick={() => router.push("/roadmap")} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kembali ke Roadmap
          </button>
        )}
      </div>
    );
  }

  const isLast = idx === (quiz?.questions.length ?? 0) - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href="/roadmap" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">Ujian {level}</span>
          {question.question_type === "listening" && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">Listening Test</span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">❤️ {hearts}</span>
        </div>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${((idx + 1) / (quiz?.questions.length ?? 8)) * 100}%` }} />
      </div>
      <p className="text-xs font-bold text-slate-400 mb-3">Soal {idx + 1}/{quiz?.questions.length}</p>

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
                : isSelected ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-slate-200 dark:border-slate-700 hover:border-amber-500/50"
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
        <div className={`mt-4 p-4 rounded-2xl border text-sm ${selected === question.correct_answer ? "bg-emerald-500/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
          <p className="font-black mb-1">{selected === question.correct_answer ? "✓ Tepat Sekali" : "✗ Jawaban Salah"}</p>
          {selected !== question.correct_answer && <p className="font-bold mb-1">Kunci Jawaban: {question.correct_answer}</p>}
          <p className="text-slate-600 dark:text-slate-300">{question.explanation}</p>
        </div>
      )}

      <div className="mt-6">
        {!showExplanation ? (
          <button type="button" disabled={!selected} onClick={checkAnswer} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold">
            Kunci Jawaban
          </button>
        ) : isLast ? (
          <button type="button" onClick={submitResult} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
            Selesai & Lihat Hasil Ujian
          </button>
        ) : (
          <button type="button" onClick={() => { setIdx((i) => i + 1); setSelected(null); setShowExplanation(false); }} className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">
            Pertanyaan Berikutnya
          </button>
        )}
      </div>
    </div>
  );
}
