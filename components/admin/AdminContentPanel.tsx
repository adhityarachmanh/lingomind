"use client";

import { useEffect, useRef, useState } from "react";
import {
  generateContentChunkAction,
  getContentGenerationStatusAction,
  getLanguagesAdminAction,
  getLevelsAdminAction,
  getTopicsAdminAction,
} from "@/lib/actions/admin";

const MODIFIER_LABELS: Record<string, string> = {
  normal: "Normal",
  hard: "Sulit",
  easy: "Mudah",
};

export default function AdminContentPanel() {
  const [languages, setLanguages] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; title: string }[]>([]);
  const [languageId, setLanguageId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [topics, setTopics] = useState<{ id: number; title: string }[]>([]);
  const [parts, setParts] = useState("3");
  const [lessonModifiers, setLessonModifiers] = useState<string[]>(["normal"]);
  const [quizVariants, setQuizVariants] = useState("5");
  const [progress, setProgress] = useState<{ done: number; total: number; label: string | null } | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getLanguagesAdminAction(), getLevelsAdminAction()])
      .then(([langs, lvls]) => {
        if (cancelled) return;
        if ("error" in langs) { setError(langs.error); return; }
        if ("error" in lvls) { setError(lvls.error); return; }
        setLanguages(langs.languages.map((l) => ({ id: l.id, name: l.name })));
        setLevels(lvls.levels.map((l) => ({ id: l.id, title: l.title })));
        if (langs.languages.length > 0) setLanguageId(langs.languages[0]?.id ?? "");
        if (lvls.levels.length > 0) setLevelId(lvls.levels[0]?.id ?? "");
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
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat topik.");
      });
    return () => { cancelled = true; };
  }, [levelId]);

  function toggleModifier(m: string) {
    setLessonModifiers((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  async function checkStatus() {
    setError(null);
    setMessage(null);
    const res = await getContentGenerationStatusAction({
      language: languageId,
      level: levelId,
      parts: parseInt(parts, 10),
      lessonModifiers,
      quizVariants: parseInt(quizVariants, 10),
    }).catch(() => ({ error: "Gagal memeriksa status." }));
    if ("error" in res) { setError(res.error); return; }
    setProgress({ done: res.done, total: res.total, label: res.label });
  }

  async function startGeneration() {
    if (runningRef.current) return;
    setError(null);
    setMessage(null);
    const status = await getContentGenerationStatusAction({
      language: languageId,
      level: levelId,
      parts: parseInt(parts, 10),
      lessonModifiers,
      quizVariants: parseInt(quizVariants, 10),
    }).catch(() => ({ error: "Gagal memeriksa status." }));
    if ("error" in status) { setError(status.error); return; }
    setProgress({ done: status.done, total: status.total, label: status.label });

    runningRef.current = true;
    setRunning(true);
    let done = status.done;
    const total = status.total;
    while (runningRef.current && done < total) {
      const res = await generateContentChunkAction({
        language: languageId,
        level: levelId,
        parts: parseInt(parts, 10),
        lessonModifiers,
        quizVariants: parseInt(quizVariants, 10),
      }).catch(() => ({ error: "Gagal generate konten." }));
      if ("error" in res) {
        setError(res.error);
        runningRef.current = false;
        setRunning(false);
        return;
      }
      done = res.done;
      setProgress({ done: res.done, total: res.total, label: res.label });
      await new Promise((r) => setTimeout(r, 250));
    }
    runningRef.current = false;
    setRunning(false);
    if (done >= total) setMessage("Semua konten untuk kombinasi ini selesai digenerate!");
  }

  function stopGeneration() {
    runningRef.current = false;
    setRunning(false);
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900">Bulk Pre-Generation Konten</h2>
        <p className="text-xs text-slate-500 mt-1">
          Generate lesson &amp; quiz untuk kombinasi bahasa + level sekaligus. Konten disimpan di cache dan langsung
          dipakai user (tanpa tunggu generate). Proses idempotent — bisa dihentikan kapan saja dan dilanjutkan nanti.
        </p>

        {error && <p className="mt-4 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">{error}</p>}
        {message && <p className="mt-4 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">{message}</p>}

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <div>
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
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Level</label>
            <select
              value={levelId}
              onChange={(e) => { setLevelId(e.target.value); setTopics([]); }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bagian Lesson per Goal</label>
            <select
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Varian Quiz per Goal</label>
            <select
              value={quizVariants}
              onChange={(e) => setQuizVariants(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Modifier Lesson</label>
            <div className="flex gap-2">
              {["normal", "hard", "easy"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModifier(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    lessonModifiers.includes(m)
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {MODIFIER_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={startGeneration}
            disabled={running || !languageId || !levelId || lessonModifiers.length === 0}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
          >
            {running ? "Mengenerate..." : "Mulai Generate"}
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
            onClick={checkStatus}
            disabled={running || !levelId}
            className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            Cek Status
          </button>
        </div>

        {progress && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
              <span>{progress.done} / {progress.total} unit</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {progress.label && !running && (
              <p className="text-[11px] text-slate-400 mt-1.5">Berikutnya: {progress.label}</p>
            )}
            {running && progress.label && (
              <p className="text-[11px] text-slate-400 mt-1.5">Sedang: {progress.label}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-base font-bold text-slate-900">Topik Level Ini</h3>
        {topics.length === 0 ? (
          <p className="text-xs text-slate-400 mt-2">Belum ada topik untuk level ini.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((t) => (
              <span key={t.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                {t.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
