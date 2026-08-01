"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluatePronunciationAction, getSentencesAction } from "@/lib/actions/pronunciation";
import { useSpeechRecognition } from "./useSpeechRecognition";
import SpeakButton from "./SpeakButton";
import type { PronunciationEvaluation } from "@/lib/types";

const SCORE_COLOR = (score: number) => (score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e");

export default function PronunciationView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const [sentences, setSentences] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PronunciationEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { supported, listening, transcript, error: sttError, timedOut, start: startRec, stop: stopRec, setError: setSttError } = useSpeechRecognition(ttsLang);

  useEffect(() => {
    let cancelled = false;
    getSentencesAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setSentences(res.sentences);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal menyiapkan kalimat latihan.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const sentence = sentences?.[idx];

  // transcript → evaluasi
  useEffect(() => {
    if (transcript === null || !sentence || evaluation) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvaluating(true);
    setSttError(null);
    evaluatePronunciationAction({ sentence, transcript })
      .then((res) => {
        if ("error" in res) {
          setError(res.error);
        } else {
          setEvaluation(res.evaluation);
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Gagal mengevaluasi pronunciation.");
      })
      .finally(() => setEvaluating(false));
  }, [transcript]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sttError) setError(sttError);
  }, [sttError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (timedOut) setError("Suara tidak terdengar.");
  }, [timedOut]);

  function nextSentence() {
    setEvaluation(null);
    setError(null);
    if (sentences && idx + 1 >= sentences.length) {
      setIdx(0);
      setSentences(null);
      setReloadKey((k) => k + 1);
    } else {
      setIdx((i) => i + 1);
    }
  }

  if (error && !sentence) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Latihan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (!sentences || !sentence) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">Menyiapkan kalimat latihan...</p>
      </div>
    );
  }

  const micBusy = listening || evaluating;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center">
      <h1 className="text-2xl font-extrabold mb-1">Speech Scoring</h1>
      <p className="text-xs font-bold text-slate-400 mb-6">{language}</p>

      {error && <p className="text-xs text-rose-500 mb-4">{error}</p>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ucapkan Kalimat Ini:</p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <SpeakButton text={sentence} lang={ttsLang} rate={0.9} />
        </div>
        {evaluation ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {evaluation.word_results.map((w, i) => (
              <span
                key={i}
                className={`text-base font-bold ${
                  w.status === "correct" ? "text-emerald-500" :
                  w.status === "incorrect" ? "text-rose-500 underline decoration-wavy" :
                  "text-slate-400 line-through"
                }`}
              >
                {w.word}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-lg font-bold leading-relaxed">{sentence}</p>
        )}
      </div>

      {evaluation && (
        <div className="mt-6 space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={SCORE_COLOR(evaluation.score)}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(evaluation.score / 100) * 339.3} 339.3`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span className="absolute text-2xl font-black">{evaluation.score}</span>
          </div>
          {transcript && (
            <p className="text-sm text-slate-500 dark:text-slate-400">&quot;{transcript}&quot;</p>
          )}
          <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/40 text-blue-700 dark:text-blue-400 text-sm text-left">
            💡 {evaluation.feedback}
          </div>
          <button type="button" onClick={nextSentence} className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
            Kalimat Selanjutnya
          </button>
        </div>
      )}

      {!evaluation && (
        <button
          type="button"
          disabled={!supported || micBusy}
          onClick={() => { setError(null); setEvaluation(null); startRec(); }}
          className={`mt-6 w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-colors ${
            listening
              ? "bg-rose-500 text-white animate-pulse"
              : evaluating
                ? "bg-amber-500 text-white"
                : "bg-teal-500 hover:bg-teal-600 text-white"
          } disabled:opacity-50`}
        >
          {evaluating ? "⏳" : "🎙️"}
        </button>
      )}
      <p className="text-xs text-slate-400 mt-3">
        {listening ? "Sedang mendengarkan..." : evaluating ? "Mengevaluasi..." : "Tekan mic dan mulai bicara"}
      </p>
    </div>
  );
}
