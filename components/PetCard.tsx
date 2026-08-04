"use client";

import { redirectIfSessionExpired } from "./sessionGuard";

import { useEffect, useState } from "react";
import { feedPetAction, getPetsAction, setActivePetAction } from "@/lib/actions/pets";
import type { PetItem } from "@/lib/types";

export default function PetCard() {
  const [active, setActive] = useState<PetItem | null>(null);
  const [all, setAll] = useState<PetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPetsAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error);
          setError(res.error);
          return;
        }
        setActive(res.active);
        setAll(res.all);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!loaded) return null;
  if (!active && all.length === 0) return null;

  const maxExp = active?.stage === 1 ? 100 : active?.stage === 2 ? 300 : active?.stage === 3 ? 1000 : 1;
  const expPercent = active && active.stage < 4 ? Math.min(100, (active.exp / maxExp) * 100) : 100;

  async function feed() {
    if (!active) return;
    setStatus(null);
    setError(null);
    const res = await feedPetAction(active.id).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal memberi makan." }));
    if ("error" in res) { redirectIfSessionExpired(res.error);
      setError(res.error);
      return;
    }
    setStatus(res.message);
    setActive(res.pet);
    setAll((prev) => prev.map((p) => (p.id === res.pet.id ? res.pet : p)));
  }

  async function setActivePet(petId: number) {
    await setActivePetAction(petId).catch(() => {});
    setModalOpen(false);
    setReloadKey((k) => k + 1);
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
      <h2 className="text-lg font-extrabold mb-3">🐾 Peliharaan</h2>
      {active && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-32 h-32 rounded-full bg-teal-500/10 flex items-center justify-center text-6xl">
            {active.emoji}
          </div>
          <p className="font-bold">{active.label} (Lv. {active.stage})</p>
          <div className="w-full max-w-xs h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500" style={{ width: `${expPercent}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">{active.stage >= 4 ? "Max" : `${active.exp}/${maxExp} EXP`}</p>
          {status && <p className="text-xs font-bold text-teal-600 dark:text-teal-400 animate-pulse">{status}</p>}
          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
          <button type="button" onClick={feed} className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
            🍎 Beri Makan (50 Koin)
          </button>
          <button type="button" onClick={() => setModalOpen(true)} className="text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors">
            🔄 Ganti Peliharaan
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">🐾 Koleksi Peliharaan</h3>
            {all.length === 0 ? (
              <p className="text-sm text-slate-400">Anda belum memiliki peliharaan. Beli telur di Toko!</p>
            ) : (
              <div className="space-y-2">
                {all.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.is_active ? "border-amber-500/60 bg-amber-500/5" : "border-slate-200 dark:border-slate-700"}`}>
                    <span className="text-3xl">{p.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{p.label}</p>
                      <p className="text-[11px] text-slate-400">Lv. {p.stage} | {p.exp} EXP</p>
                    </div>
                    {p.is_active ? (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Sedang Dipakai</span>
                    ) : (
                      <button type="button" onClick={() => setActivePet(p.id)} className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
                        Jadikan Utama
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setModalOpen(false)} className="mt-5 w-full text-xs text-slate-400 hover:text-slate-600">Tutup</button>
          </div>
        </div>
      )}
    </section>
  );
}
