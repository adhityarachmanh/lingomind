"use client";

import { useState } from "react";
import { claimMissionRewardAction } from "@/lib/actions/mission";

export default function ChestCard({
  icon, title, desc, progress, locked, claimed, buttonLabel, tier, highlight,
}: {
  icon: string; title: string; desc: string; progress: string; locked: boolean;
  claimed: boolean; buttonLabel: string; tier: number; highlight?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await claimMissionRewardAction(tier).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal klaim." }));
    setPending(false);
    if ("error" in res) {
      setError(res.error ?? null);
      return;
    }
    setMessage(res.message ?? "Berhasil!");
    window.setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-yellow-500/50 bg-yellow-500/5" : "border-slate-200 dark:border-slate-700"}`}>
      <p className="text-2xl">{icon}</p>
      <p className="font-extrabold mt-1">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      <p className="text-[11px] font-bold text-slate-400 mt-2">{progress}</p>
      {message && <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 mt-2">{message}</p>}
      {error && <p className="text-[11px] font-bold text-rose-500 mt-2">{error}</p>}
      {claimed ? (
        <button type="button" disabled className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
          Diklaim
        </button>
      ) : locked ? (
        <button type="button" disabled className="mt-3 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
          Terkunci
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={claim}
          className={`mt-3 w-full px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 ${highlight ? "bg-gradient-to-r from-yellow-500 to-amber-500 animate-pulse" : "bg-amber-500 hover:bg-amber-600"}`}
        >
          {pending ? "Memproses..." : buttonLabel}
        </button>
      )}
    </div>
  );
}
