"use client";

import { useEffect, useState } from "react";
import {
  getAppConfigsAdminAction, getMissionConfigsAdminAction,
  updateAppConfigAdminAction, updateMissionConfigAdminAction,
} from "@/lib/actions/admin";
import { Modal, ModalFooter } from "./ui";

interface AppConfigRow { key: string; value: string; description: string | null; }
interface MissionConfigRow {
  id: number; name: string; lesson_target: number; quiz_target: number;
  weakness_target: number; flashcard_target_min: number; flashcard_target_max: number;
}

export default function AdminConfigPanel() {
  const [appConfigs, setAppConfigs] = useState<AppConfigRow[] | null>(null);
  const [missionConfigs, setMissionConfigs] = useState<MissionConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingApp, setEditingApp] = useState<AppConfigRow | null>(null);
  const [editingMission, setEditingMission] = useState<MissionConfigRow | null>(null);
  const [appValue, setAppValue] = useState("");
  const [missionForm, setMissionForm] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAppConfigsAdminAction(), getMissionConfigsAdminAction()])
      .then(([a, m]) => {
        if (cancelled) return;
        if ("error" in a) { setError(a.error); return; }
        if ("error" in m) { setError(m.error); return; }
        setAppConfigs(a.configs);
        setMissionConfigs(m.configs);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat konfigurasi.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  async function saveApp() {
    if (!editingApp) return;
    setStatus(null);
    const res = await updateAppConfigAdminAction({ key: editingApp.key, value: appValue }).catch(() => ({ error: "Gagal menyimpan." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus("Konfigurasi diperbarui!");
    setEditingApp(null);
    setReloadKey((k) => k + 1);
  }

  async function saveMission() {
    if (!editingMission) return;
    const toNum = (v: string, fallback: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
    const input = {
      id: editingMission.id,
      lessonTarget: toNum(missionForm.lesson, editingMission.lesson_target),
      quizTarget: toNum(missionForm.quiz, editingMission.quiz_target),
      weaknessTarget: toNum(missionForm.weakness, editingMission.weakness_target),
      flashcardTargetMin: toNum(missionForm.fcMin, editingMission.flashcard_target_min),
      flashcardTargetMax: toNum(missionForm.fcMax, editingMission.flashcard_target_max),
    };
    setStatus(null);
    const res = await updateMissionConfigAdminAction(input).catch(() => ({ error: "Gagal menyimpan." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus("Misi harian diperbarui!");
    setEditingMission(null);
    setReloadKey((k) => k + 1);
  }

  if (error && (!appConfigs || !missionConfigs)) {
    return (
      <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">
        {error}
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="ml-2 text-xs font-bold underline">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!appConfigs || !missionConfigs) {
    return <div className="text-sm text-slate-400">Memuat konfigurasi...</div>;
  }

  return (
    <div className="space-y-6">
      {status && <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">{error}</div>}

      <section className="bg-white rounded-lg p-5 border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 mb-4">⚙️ Sistem Konfigurasi Utama</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50">
                <th className="text-left py-2 px-3">Key</th>
                <th className="text-left py-2 px-3">Value</th>
                <th className="text-left py-2 px-3">Deskripsi</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {appConfigs.map((c) => (
                <tr key={c.key} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="py-2 px-3 font-bold">{c.key}</td>
                  <td className="py-2 px-3">{c.value}</td>
                  <td className="py-2 px-3 text-xs text-slate-400">{c.description}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => { setEditingApp(c); setAppValue(c.value); }} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg p-5 border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 mb-4">🎯 Konfigurasi Misi Harian</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50">
                <th className="text-left py-2 px-3">Nama</th>
                <th className="text-left py-2 px-3">Lesson</th>
                <th className="text-left py-2 px-3">Quiz</th>
                <th className="text-left py-2 px-3">Weakness</th>
                <th className="text-left py-2 px-3">FC Min</th>
                <th className="text-left py-2 px-3">FC Max</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {missionConfigs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="py-2 px-3 font-bold">{c.name}</td>
                  <td className="py-2 px-3">{c.lesson_target}</td>
                  <td className="py-2 px-3">{c.quiz_target}</td>
                  <td className="py-2 px-3">{c.weakness_target}</td>
                  <td className="py-2 px-3">{c.flashcard_target_min}</td>
                  <td className="py-2 px-3">{c.flashcard_target_max}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => {
                      setEditingMission(c);
                      setMissionForm({
                        lesson: String(c.lesson_target), quiz: String(c.quiz_target),
                        weakness: String(c.weakness_target), fcMin: String(c.flashcard_target_min),
                        fcMax: String(c.flashcard_target_max),
                      });
                    }} className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-semibold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingApp && (
        <Modal title="Edit Konfigurasi" onClose={() => setEditingApp(null)}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Key</label>
          <input value={editingApp.key} disabled className="w-full bg-slate-100 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 disabled:opacity-60" />
          <p className="text-xs text-slate-400 mt-2">{editingApp.description}</p>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Value</label>
          <input value={appValue} onChange={(e) => setAppValue(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <ModalFooter onCancel={() => setEditingApp(null)} onSave={saveApp} />
        </Modal>
      )}

      {editingMission && (
        <Modal title="Edit Misi Harian" onClose={() => setEditingMission(null)}>
          <p className="text-xs font-bold text-slate-400 mb-3">{editingMission.name}</p>
          {([
            ["lesson", "Target Lesson"], ["quiz", "Target Quiz"], ["weakness", "Target Weakness"],
            ["fcMin", "Flashcard Target Min"], ["fcMax", "Flashcard Target Max"],
          ] as const).map(([key, label]) => (
            <div key={key} className="mb-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</label>
              <input type="number" value={missionForm[key] ?? ""} onChange={(e) => setMissionForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          ))}
          <ModalFooter onCancel={() => setEditingMission(null)} onSave={saveMission} />
        </Modal>
      )}
    </div>
  );
}
