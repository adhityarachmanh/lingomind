"use client";

import { Fragment, useEffect, useState } from "react";
import {
  generateNextLessonAction,
  generateQuizVariantAction,
  getContentGenerationStatusAction,
  getLanguagesAdminAction,
  getLevelsAdminAction,
  resetFailedContentUnitsAction,
} from "@/lib/actions/admin";
import type { ContentLevelStatus, LanguageContentStatus } from "@/lib/admin";

const LESSON_PARTS = 5;

function levelBadge(level: ContentLevelStatus): { label: string; cls: string } {
  if (level.done >= level.total) return { label: "Selesai", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (level.done > 0) return { label: "Parsial", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Belum", cls: "bg-slate-50 text-slate-500 border-slate-200" };
}

function goalBadge(goal: { done: number; total: number }): { label: string; cls: string } {
  if (goal.total === 0) return { label: "-", cls: "bg-slate-50 text-slate-400 border-slate-200" };
  if (goal.done >= goal.total) return { label: "Selesai", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (goal.done > 0) return { label: "Parsial", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Belum", cls: "bg-slate-50 text-slate-500 border-slate-200" };
}

export default function AdminContentPanel() {
  const [languages, setLanguages] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; title: string }[]>([]);
  const [languageId, setLanguageId] = useState("");
  const [status, setStatus] = useState<LanguageContentStatus | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Sinkronkan bahasa terpilih ke query param ?language= agar bertahan saat halaman direfresh.
  function readLanguageParam(): string | null {
    if (typeof window === "undefined") return null;
    const lang = new URLSearchParams(window.location.search).get("language");
    return lang && lang.trim() !== "" ? lang.trim() : null;
  }

  function writeLanguageParam(language: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("language", language);
    window.history.replaceState(null, "", url.toString());
  }

  async function refreshStatus() {
    if (!languageId) return;
    setError(null);
    setMessage(null);
    const res = await getContentGenerationStatusAction({ language: languageId }).catch(() => ({ error: "Gagal memeriksa status." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus(res.status);
    setFailedCount(res.failedCount);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getLanguagesAdminAction(), getLevelsAdminAction()])
      .then(([langs, lvls]) => {
        if (cancelled) return;
        if ("error" in langs) { setError(langs.error); return; }
        if ("error" in lvls) { setError(lvls.error); return; }
        const langsList = langs.languages.map((l) => ({ id: l.id, name: l.name }));
        const levelsList = lvls.levels.map((l) => ({ id: l.id, title: l.title }));
        setLanguages(langsList);
        setLevels(levelsList);
        const saved = readLanguageParam();
        const initial = saved && langsList.some((l) => l.id === saved) ? saved : langsList[0]?.id ?? "";
        setLanguageId(initial);
        if (initial && initial !== saved) writeLanguageParam(initial);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!languageId) return;
    let cancelled = false;
    getContentGenerationStatusAction({ language: languageId })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setStatus(res.status);
        setFailedCount(res.failedCount);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memeriksa status.");
      });
    return () => { cancelled = true; };
  }, [languageId]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; label: string } | { error: string }>) {
    if (busy) return;
    setError(null);
    setMessage(null);
    setBusy(key);
    const res = await fn().catch(() => ({ error: "Gagal generate konten." }));
    setBusy(null);
    if ("error" in res) { setError(res.error); return; }
    setMessage(`"${res.label}" berhasil digenerate!`);
    await refreshStatus();
  }

  function generateLesson(levelId: string, goal: string) {
    return run(`lesson:${levelId}:${goal}`, () =>
      generateNextLessonAction({ language: languageId, level: levelId, goal })
    );
  }

  function generateQuiz(levelId: string, goal: string) {
    return run(`quiz:${levelId}:${goal}`, () =>
      generateQuizVariantAction({ language: languageId, level: levelId, goal })
    );
  }

  async function resetFailedUnits() {
    setError(null);
    setMessage(null);
    const res = await resetFailedContentUnitsAction(languageId).catch(() => ({ error: "Gagal mereset." }));
    if ("error" in res) { setError(res.error); return; }
    setMessage("Unit yang gagal direset — klik generate lagi untuk mencoba ulang.");
    await refreshStatus();
  }

  const hasLevels = levels.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Status Konten</h2>
            <p className="text-xs text-slate-500 mt-1">
              Bahasa hanya muncul di aplikasi setelah semua level lengkap. Klik tombol di samping kiri tiap item untuk
              generate 1 konten (lesson 5 bagian/goal · quiz tanpa batas, anti-duplikat). Massal via{" "}
              <code className="text-[11px] font-mono">npm run content:generate &lt;Bahasa&gt;</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-56">
              <select
                value={languageId}
                onChange={(e) => { setLanguageId(e.target.value); writeLanguageParam(e.target.value); }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={!!busy || !languageId}
              className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              Perbarui Status
            </button>
            {failedCount > 0 && (
              <button
                type="button"
                onClick={resetFailedUnits}
                disabled={!!busy}
                className="px-4 py-2 rounded-md bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
              >
                Reset Unit Gagal ({failedCount})
              </button>
            )}
          </div>
        </div>

        {error && <p className="mt-4 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">{error}</p>}
        {message && <p className="mt-4 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">{message}</p>}
      </div>

      {status && status.levels.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {status.done}/{status.total} unit
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-bold">Generate</th>
                <th className="px-4 py-2.5 font-bold">Item</th>
                <th className="px-4 py-2.5 font-bold">Lesson</th>
                <th className="px-4 py-2.5 font-bold">Quiz</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {status.levels.map((lvl) => {
                const badge = levelBadge(lvl);
                const isOpen = expanded === lvl.levelId;
                const isSpecial = (goal: string) => goal === "exam" || goal === "general_practice";
                return (
                  <Fragment key={lvl.levelId}>
                    <tr className="border-t border-slate-200 bg-slate-50/60">
                      <td colSpan={6} className="px-4 py-2 font-bold text-slate-800">{lvl.title} · {badge.label}</td>
                    </tr>
                    {lvl.goals.map((g) => {
                      const gb = goalBadge(g);
                      const lessonBusy = busy === `lesson:${lvl.levelId}:${g.goal}`;
                      const quizBusy = busy === `quiz:${lvl.levelId}:${g.goal}`;
                      return (
                        <tr key={g.goal} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div className="flex gap-1.5">
                              {!isSpecial(g.goal) && (
                                <button
                                  type="button"
                                  onClick={() => generateLesson(lvl.levelId, g.goal)}
                                  disabled={!!busy}
                                  className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold"
                                >
                                  {lessonBusy ? "..." : "Lesson"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => generateQuiz(lvl.levelId, g.goal)}
                                disabled={!!busy}
                                className="px-2.5 py-1 rounded-md bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold"
                              >
                                {quizBusy ? "..." : "Quiz"}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2 font-semibold text-slate-900">{g.goal}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {isSpecial(g.goal) ? "—" : `${g.lessonDone}/${g.lessonTotal}`}
                          </td>
                          <td className="px-4 py-2 text-slate-600">{g.quizDone}/{g.quizTotal}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${gb.cls}`}>{gb.label}</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isOpen && (
                              <span className="text-[11px] text-slate-400">
                                Lesson {g.lessonDone}/{isSpecial(g.goal) ? 0 : LESSON_PARTS} · Quiz {g.quizDone}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-slate-100">
                      <td colSpan={6} className="px-4 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : lvl.levelId)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {isOpen ? "Tutup Detail" : "Lihat Detail"}
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {status && status.levels.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 text-xs text-slate-400">
          Belum ada level untuk bahasa ini.
        </div>
      )}
      {!hasLevels && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 text-xs text-slate-400">
          Memuat data...
        </div>
      )}
    </div>
  );
}
