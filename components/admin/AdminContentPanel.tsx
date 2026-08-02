"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  generateContentChunkAction,
  getContentGenerationStatusAction,
  getLanguagesAdminAction,
} from "@/lib/actions/admin";
import type { ContentLevelStatus, LanguageContentStatus } from "@/lib/actions/admin";

const CONTENT_PARTS = 3;
const CONTENT_QUIZ_VARIANTS = 5;
const CONTENT_MODIFIERS = ["normal", "hard", "easy"];

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
  const [languageId, setLanguageId] = useState("");
  const [status, setStatus] = useState<LanguageContentStatus | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refreshStatus() {
    if (!languageId) return;
    setError(null);
    setMessage(null);
    const res = await getContentGenerationStatusAction({ language: languageId }).catch(() => ({ error: "Gagal memeriksa status." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus(res.status);
  }

  useEffect(() => {
    let cancelled = false;
    getLanguagesAdminAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setLanguages(res.languages.map((l) => ({ id: l.id, name: l.name })));
        if (res.languages.length > 0) setLanguageId(res.languages[0]?.id ?? "");
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
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memeriksa status.");
      });
    return () => { cancelled = true; };
  }, [languageId]);

  async function startGeneration() {
    if (runningRef.current || !languageId) return;
    setError(null);
    setMessage(null);

    const initial = await getContentGenerationStatusAction({ language: languageId }).catch(() => ({ error: "Gagal memeriksa status." }));
    if ("error" in initial) { setError(initial.error); return; }
    setStatus(initial.status);

    runningRef.current = true;
    setRunning(true);
    let done = initial.status.done;
    const total = initial.status.total;
    while (runningRef.current && done < total) {
      const res = await generateContentChunkAction({ language: languageId }).catch(() => ({ error: "Gagal generate konten." }));
      if ("error" in res) {
        setError(res.error);
        runningRef.current = false;
        setRunning(false);
        return;
      }
      done = res.done;
      setStatus((prev) => (prev ? { ...prev, done: res.done } : prev));
      await new Promise((r) => setTimeout(r, 250));
    }
    runningRef.current = false;
    setRunning(false);
    await refreshStatus();
    if (done >= total) setMessage("Semua konten untuk bahasa ini selesai digenerate!");
  }

  function stopGeneration() {
    runningRef.current = false;
    setRunning(false);
  }

  const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
  const runningLevel = status?.levels.find((l) => l.done < l.total);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900">Bulk Pre-Generation Konten</h2>
        <p className="text-xs text-slate-500 mt-1">
          Pilih bahasa lalu generate semua konten (semua level: bagian {CONTENT_PARTS}, modifier{" "}
          {CONTENT_MODIFIERS.join(", ")}, {CONTENT_QUIZ_VARIANTS} varian quiz). Bahasa baru hanya muncul di
          aplikasi setelah semua levelnya selesai. Proses idempotent — bisa dihentikan kapan saja dan dilanjutkan nanti.
        </p>

        {error && <p className="mt-4 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">{error}</p>}
        {message && <p className="mt-4 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">{message}</p>}

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bahasa</label>
            <select
              value={languageId}
              onChange={(e) => setLanguageId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {languages.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={startGeneration}
            disabled={running || !languageId}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
          >
            {running ? "Mengenerate..." : "Generate Semua Konten"}
          </button>
          <button
            type="button"
            onClick={stopGeneration}
            disabled={!running}
            className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            Hentikan
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={running || !languageId}
            className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            Perbarui Status
          </button>
        </div>

        {status && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
              <span>
                {status.done} / {status.total} unit
                {runningLevel && ` · ${runningLevel.title}: ${runningLevel.done}/${runningLevel.total}`}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {status.total > 0 && status.done < status.total && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Estimasi sisa: {status.total - status.done} unit AI — bisa berlangsung lama, silakan dibiarkan berjalan.
              </p>
            )}
          </div>
        )}
      </div>

      {status && status.levels.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-bold">Level</th>
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
                return (
                  <Fragment key={lvl.levelId}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{lvl.title}</td>
                      <td className="px-4 py-2.5 text-slate-600">{lvl.lessonDone}/{lvl.lessonTotal}</td>
                      <td className="px-4 py-2.5 text-slate-600">{lvl.quizDone}/{lvl.quizTotal}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : lvl.levelId)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          {isOpen ? "Tutup" : "Detail"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-slate-100 bg-slate-50/50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-1">
                            {lvl.goals.map((g) => {
                              const gb = goalBadge(g);
                              return (
                                <div key={g.goal} className="flex items-center justify-between rounded-md bg-white border border-slate-200 px-3 py-1.5">
                                  <span className="text-xs font-semibold text-slate-700">{g.goal}</span>
                                  <span className="text-[11px] text-slate-500">
                                    Lesson {g.lessonDone}/{g.lessonTotal} · Quiz {g.quizDone}/{g.quizTotal}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${gb.cls}`}>{gb.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
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
    </div>
  );
}
