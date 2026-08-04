"use client";

import { redirectIfSessionExpired } from "./sessionGuard";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLessonAction } from "@/lib/actions/lesson";
import { incrementMissionAction } from "@/lib/actions/mission";
import { sanitizeHtml } from "@/lib/sanitize";
import SpeakButton from "./SpeakButton";
import type { LessonContainer } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "retrying" }
  | { status: "error"; message: string }
  | { status: "ready"; lesson: LessonContainer; totalParts: number };

export default function LessonView({
  goal,
  language,
  ttsLang,
}: {
  goal: string;
  language: string;
  ttsLang: string;
}) {
  const [part, setPart] = useState(1);
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [part, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    getLessonAction(goal, part)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error);
          setState({ status: "error", message: res.error });
          return;
        }
        setState({ status: "ready", lesson: res.lesson, totalParts: res.totalParts ?? 3 });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: "error", message: e instanceof Error ? e.message : "Gagal memuat materi." });
      });
    return () => {
      cancelled = true;
    };
  }, [goal, part, reloadKey]);

  function retry() {
    setElapsed(0);
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }

  async function nextPart() {
    setElapsed(0);
    setState({ status: "loading" });
    setPart((p) => p + 1);
    await incrementMissionAction("lesson").catch(() => {});
  }

  if (state.status === "loading" || state.status === "retrying") {
    const stage = elapsed < 4 ? 0 : elapsed < 9 ? 1 : elapsed < 14 ? 2 : 3;
    const stageLabels = ["Menyusun materi…", "Menyiapkan kosakata…", "Menyusun contoh kalimat…", "Hampir selesai…"];
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        <p className="font-bold text-slate-700 dark:text-slate-300">{stageLabels[stage]}</p>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < stage ? "bg-teal-500" : i === stage ? "bg-teal-500/60 animate-pulse" : "bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-slate-400">Merancang materi pelajaran khusus untuk Anda. Mohon tunggu beberapa saat.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Materi</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{state.message}</p>
        <button type="button" onClick={retry} className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
        <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const { lesson } = state;
  const isLastPart = part >= state.totalParts;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</Link>
        <div className="flex flex-wrap gap-2 justify-end">
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-bold">Materi {language}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">Goal: {goal}</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">Bagian {part}</span>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6">{lesson.title}</h1>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card prose-sm">
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }} />
          </div>

          <h2 className="text-lg font-extrabold mt-8 mb-3">Contoh Penggunaan</h2>
          <div className="space-y-3">
            {lesson.example_sentences.map((ex, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
                <SpeakButton text={ex.target} lang={ttsLang} rate={0.95} />
                <div>
                  <p className="font-bold text-sm">{ex.target}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{ex.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <h2 className="text-lg font-extrabold mb-3">Kosa Kata Inti</h2>
          <div className="space-y-2">
            {lesson.vocabulary.map((v, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start gap-3">
                <SpeakButton text={v.word} lang={ttsLang} rate={0.9} />
                <div>
                  <p className="font-bold text-sm">{v.word}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{v.meaning}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-6">
            Jika sudah paham materinya, lanjutkan ke quiz untuk evaluasi.
          </p>
          <div className="mt-4 space-y-2">
            {isLastPart ? (
              <Link
                href={`/quiz/${encodeURIComponent(goal)}`}
                className="block w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold text-center"
              >
                Mulai Quiz
              </Link>
            ) : (
              <button
                type="button"
                onClick={nextPart}
                className="w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
              >
                Lesson Selanjutnya
              </button>
            )}
            <Link
              href={`/quiz/${encodeURIComponent(goal)}`}
              className="block w-full px-4 py-3 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-sm font-bold text-center"
            >
              Mulai Quiz
            </Link>
            <Link href="/dashboard" className="block w-full px-4 py-3 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm text-center">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
