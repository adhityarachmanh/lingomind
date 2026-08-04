"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalyticsAction } from "@/lib/actions/analytics";
import type { SkillProgressPoint, WeaknessAnalyticsItem } from "@/lib/types";

type Tab = "topik" | "tren";

const SERIES = [
  { key: "grammar", label: "Tata Bahasa (Grammar)", color: "#6366f1" },
  { key: "vocabulary", label: "Kosakata (Vocabulary)", color: "#ec4899" },
  { key: "listening", label: "Pendengaran (Listening)", color: "#f59e0b" },
] as const;

function maxOf(points: SkillProgressPoint[], key: "grammar" | "vocabulary" | "listening"): number {
  return Math.max(1, ...points.map((p) => p[key]));
}

export default function AnalyticsView() {
  const [tab, setTab] = useState<Tab>("topik");
  const [weakness, setWeakness] = useState<WeaknessAnalyticsItem[] | null>(null);
  const [skills, setSkills] = useState<SkillProgressPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setWeakness(res.weakness);
        setSkills(res.skills);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat analisis.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error && !weakness && !skills) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Analisis</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Coba Lagi</button>
      </div>
    );
  }

  if (!weakness || !skills) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const max30d = Math.max(1, ...weakness.map((w) => w.count_30d));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold">Analisis Kelemahan</h1>
      <Link href="/dashboard" className="text-xs text-slate-400 hover:underline">Kembali ke Dashboard</Link>

      <div className="flex gap-2 my-6">
        {(["topik", "tren"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === t ? "bg-teal-500 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
            }`}
          >
            {t === "topik" ? "📋 Peta Topik Kelemahan" : "📊 Tren 7 Hari Terakhir"}
          </button>
        ))}
      </div>

      {tab === "topik" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {weakness.length === 0 ? (
            <div className="sm:col-span-2 text-center py-8">
              <p className="text-sm text-slate-400">Belum ada data kelemahan untuk bahasa ini.</p>
              <p className="text-xs text-slate-400 mt-1">Lakukan kuis atau latihan agar AI dapat memetakan fokus kelemahan Anda.</p>
            </div>
          ) : (
            weakness.map((w) => (
              <div key={w.topic} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card">
                <p className="font-bold text-sm">{w.topic}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Akurasi kesalahan terdistribusi secara berkala.</p>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>7 Hari Terakhir</span>
                    <span>{w.count_7d}x salah</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (w.count_7d / max30d) * 100)}%` }} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>30 Hari Terakhir</span>
                    <span>{w.count_30d}x salah</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${Math.min(100, (w.count_30d / max30d) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "tren" && (
        <div>
          {skills.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Belum ada data tren keterampilan.</p>
              <p className="text-xs text-slate-400 mt-1">Selesaikan materi pelajaran &amp; kuis harian untuk melihat grafik tren keterampilan Anda.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card">
              <svg viewBox="0 0 560 220" className="w-full h-auto">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <line key={f} x1={50} x2={530} y1={20 + f * 160} y2={20 + f * 160} stroke="#e2e8f0" strokeWidth="1" />
                ))}
                {SERIES.map((s) => {
                  const max = maxOf(skills, s.key);
                  const xs = skills.map((_, i) => 50 + (i / Math.max(1, skills.length - 1)) * 480);
                  const ys = skills.map((p) => 180 - (p[s.key] / max) * 160);
                  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
                  const area = `${line} L${xs[xs.length - 1]?.toFixed(1)},180 L${xs[0]?.toFixed(1)},180 Z`;
                  return (
                    <g key={s.key}>
                      <path d={area} fill={s.color} opacity="0.12" />
                      <path d={line} fill="none" stroke={s.color} strokeWidth="2" />
                      {xs.map((x, i) => (
                        <circle key={i} cx={x} cy={ys[i]} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />
                      ))}
                    </g>
                  );
                })}
                {skills.map((p, i) => {
                  const x = 50 + (i / Math.max(1, skills.length - 1)) * 480;
                  return (
                    <text key={i} x={x} y={205} textAnchor="middle" fontSize="10" fill="#94a3b8">
                      {p.day.slice(5)}
                    </text>
                  );
                })}
              </svg>
              <div className="flex flex-wrap gap-4 mt-3">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
