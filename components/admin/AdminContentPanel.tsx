"use client";

import { Fragment, useEffect, useState } from "react";
import {
  generateSpecificUnitAction,
  getContentGenerationStatusAction,
  getLanguagesAdminAction,
  getLevelsAdminAction,
  getTopicsAdminAction,
  resetFailedContentUnitsAction,
} from "@/lib/actions/admin";
import type { ContentLevelStatus, LanguageContentStatus } from "@/lib/admin";

const KIND_OPTIONS = [
  { value: "lesson", label: "Lesson" },
  { value: "quiz", label: "Quiz (1 varian)" },
  { value: "exam", label: "Exam (1 varian)" },
  { value: "general_practice", label: "General Practice (1 varian)" },
] as const;

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
  const [levelId, setLevelId] = useState("");
  const [topics, setTopics] = useState<{ id: number; title: string }[]>([]);
  const [goalId, setGoalId] = useState("");
  const [kind, setKind] = useState<"lesson" | "quiz" | "exam" | "general_practice">("lesson");
  const [lessonPart, setLessonPart] = useState("1");
  const [lessonModifier, setLessonModifier] = useState("normal");
  const [status, setStatus] = useState<LanguageContentStatus | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [generating, setGenerating] = useState(false);
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
        if (levelsList.length > 0) setLevelId(levelsList[0]?.id ?? "");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!levelId) return;
    let cancelled = false;
    getTopicsAdminAction(levelId)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setTopics(res.topics.map((t) => ({ id: t.id, title: t.title })));
        setGoalId("");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat topik.");
      });
    return () => { cancelled = true; };
  }, [levelId]);

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

  async function generateOne() {
    if (generating || !languageId || !levelId) return;
    setError(null);
    setMessage(null);
    setGenerating(true);
    const res = await generateSpecificUnitAction({
      language: languageId,
      level: levelId,
      kind,
      goal: kind === "lesson" || kind === "quiz" ? goalId : undefined,
      part: kind === "lesson" ? parseInt(lessonPart, 10) : undefined,
      modifier: kind === "lesson" ? lessonModifier : undefined,
    }).catch(() => ({ error: "Gagal generate konten." }));
    setGenerating(false);
    if ("error" in res) { setError(res.error); return; }
    setMessage(`"${res.label}" berhasil digenerate!`);
    await refreshStatus();
  }

  async function resetFailedUnits() {
    setError(null);
    setMessage(null);
    const res = await resetFailedContentUnitsAction(languageId).catch(() => ({ error: "Gagal mereset." }));
    if ("error" in res) { setError(res.error); return; }
    setMessage("Unit yang gagal direset — klik generate lagi untuk mencoba ulang.");
    await refreshStatus();
  }

  const needsGoal = kind === "lesson" || kind === "quiz";
  const goalOptions = topics.map((t) => t.title);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900">Generate Konten Spesifik</h2>
        <p className="text-xs text-slate-500 mt-1">
          Generate 1 konten per waktu (incremental). Bahasa hanya muncul di aplikasi setelah SEMUA level lengkap.
          Untuk generate massal: <code className="text-[11px] font-mono">npm run content:generate &lt;Bahasa&gt;</code> di terminal.
        </p>

        {error && <p className="mt-4 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">{error}</p>}
        {message && <p className="mt-4 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">{message}</p>}

        <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bahasa</label>
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
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Level</label>
            <select
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipe Konten</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          {needsGoal ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Goal (Topik)</label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">— pilih topik —</option>
                {goalOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
          {kind === "lesson" && (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bagian</label>
                <select
                  value={lessonPart}
                  onChange={(e) => setLessonPart(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>Bagian {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Modifier</label>
                <select
                  value={lessonModifier}
                  onChange={(e) => setLessonModifier(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="normal">Normal</option>
                  <option value="hard">Sulit</option>
                  <option value="easy">Mudah</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={generateOne}
            disabled={generating || !languageId || !levelId || (needsGoal && !goalId)}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
          >
            {generating ? "Mengenerate..." : "Generate 1 Konten"}
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={generating || !languageId}
            className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            Perbarui Status
          </button>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={resetFailedUnits}
              disabled={generating}
              className="px-4 py-2 rounded-md bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              Reset Unit Gagal ({failedCount})
            </button>
          )}
        </div>
      </div>

      {status && status.levels.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Status Konten — {status.done}/{status.total} unit</h3>
          </div>
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
