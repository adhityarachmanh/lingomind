"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveBattlesAction } from "@/lib/actions/battle";
import type { BattleItem } from "@/lib/types";

export default function BattleArenaSection() {
  const [battles, setBattles] = useState<BattleItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveBattlesAction()
      .then((res) => {
        if (cancelled) return;
        if (!("error" in res)) setBattles(res.battles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (battles === null) return null;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
      <h2 className="text-lg font-extrabold mb-3">⚔️ Arena Pertarungan</h2>
      {battles.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada pertarungan aktif.</p>
      ) : (
        <div className="space-y-2">
          {battles.map((b) => {
            const pendingAndOpen = b.status === "pending" && b.my_score === null;
            const pendingWaiting = b.status === "pending" && b.my_score !== null;
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div>
                  <p className="text-sm font-bold">Vs {b.opponent_name}</p>
                  <p className="text-[11px] text-slate-400">Topik: {b.goal} ({b.language})</p>
                  {b.status === "completed" && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Skor: Kamu {b.my_score} - {b.opponent_score} {b.opponent_name}</p>
                  )}
                </div>
                {pendingAndOpen && (
                  <Link
                    href={`/quiz/${encodeURIComponent(b.goal)}?battle_id=${b.id}`}
                    className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shrink-0"
                  >
                    Terima Tantangan!
                  </Link>
                )}
                {pendingWaiting && <span className="text-[11px] font-bold text-slate-400 shrink-0">Menunggu Lawan</span>}
                {b.status !== "pending" && <span className="text-[11px] font-bold text-slate-400 shrink-0">Selesai</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
