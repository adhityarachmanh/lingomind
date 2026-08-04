"use client";

import { useEffect, useState } from "react";
import { refillHeartsAction } from "@/lib/actions/shop";

export default function HeartsRefillModal({ hearts, coins }: { hearts: number; coins: number }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const missing = Math.max(0, 5 - hearts);
  const cost = missing * 60;

  async function refill() {
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await refillHeartsAction().catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal isi ulang nyawa." }));
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setMessage(`Nyawa terisi penuh! ❤️ x${res.hearts}`);
    window.setTimeout(() => window.location.reload(), 800);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full px-3 py-2 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-xs font-bold hover:bg-teal-500/10 transition-colors"
      >
        Isi Ulang Nyawa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Isi Ulang Nyawa"
            className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold mb-1">Isi Ulang Nyawa</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Nyawa saat ini: ❤️ {hearts}/5
            </p>
            {missing === 0 ? (
              <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mb-4">Nyawa sudah penuh!</p>
            ) : (
              <p className="text-sm mb-4">
                Isi {missing} nyawa seharga <span className="font-bold">🪙 {cost} Koin</span> (60/nyawa).
                <span className="block text-xs text-slate-400 mt-1">Saldo: 🪙 {coins}</span>
              </p>
            )}
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            {message && <p className="text-xs text-teal-600 dark:text-teal-400 mb-3">{message}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || missing === 0}
                onClick={refill}
                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold"
              >
                {pending ? "Memproses..." : "Isi Ulang Sekarang"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
