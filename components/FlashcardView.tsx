"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirectIfSessionExpired } from "./sessionGuard";
import { getDueFlashcardsAction, reviewFlashcardAction } from "@/lib/actions/flashcard";
import SpeakButton from "./SpeakButton";
import type { FlashcardItem } from "@/lib/types";

export default function FlashcardView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const [cards, setCards] = useState<FlashcardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDueFlashcardsAction(20)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error); setError(res.error); }
        else setCards(res.cards);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat flashcard."));
    return () => {
      cancelled = true;
    };
  }, []);

  function grade(quality: number) {
    const card = cards?.[idx];
    if (!card) return;
    reviewFlashcardAction(card.id, quality).catch(() => {});
    const next = idx + 1;
    if (next >= (cards?.length ?? 0)) setFinished(true);
    else {
      setIdx(next);
      setShowBack(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Flashcard</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (cards === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🏆</p>
        <p className="text-2xl font-black">Semua Kartu Bersih!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Tidak ada kartu yang harus diulas untuk bahasa {language} saat ini. Kembali lagi nanti, atau tambahkan kartu baru melalui menu kuis!
        </p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-4xl">🎉</p>
        <p className="text-2xl font-black">Sesi Selesai!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Hebat! Semua kartu di sesi ini telah selesai diulas secara optimal.</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const card = cards[idx];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">Flashcard Review</h1>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold">
          Kartu {idx + 1}/{cards.length}
        </span>
      </div>

      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-8 shadow-card min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <SpeakButton text={card.front_text} lang={ttsLang} rate={0.9} />
        </div>
        <p className="text-lg font-bold">{card.front_text}</p>
        {showBack ? (
          <>
            <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{card.back_text}</p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowBack(true)}
            className="mt-2 px-4 py-2 rounded-xl border border-teal-500/60 text-teal-600 dark:text-teal-400 text-xs font-bold"
          >
            Tampilkan Terjemahan 👀
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <button type="button" onClick={() => grade(2)} className="px-2 sm:px-4 py-3 rounded-xl text-xs sm:text-sm bg-rose-500 hover:bg-rose-600 text-white font-bold">
          🔴 Ulangi
        </button>
        <button type="button" onClick={() => grade(4)} className="px-2 sm:px-4 py-3 rounded-xl text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold">
          🟡 Bagus
        </button>
        <button type="button" onClick={() => grade(5)} className="px-2 sm:px-4 py-3 rounded-xl text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
          🟢 Mudah
        </button>
      </div>
    </div>
  );
}
