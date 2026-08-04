"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { redirectIfSessionExpired } from "./sessionGuard";
import { addVocabularyAction, deleteVocabularyAction, getVocabularyAction } from "@/lib/actions/vocabulary";
import SpeakButton from "./SpeakButton";
import type { FlashcardItem } from "@/lib/types";

export default function VocabularyView({ language, ttsLang }: { language: string; ttsLang: string }) {
  const [cards, setCards] = useState<FlashcardItem[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await getVocabularyAction().catch(() => ({ error: "Gagal memuat kosakata." }));
    if ("error" in res) {
      redirectIfSessionExpired(res.error);
      setError(res.error);
      return;
    }
    setCards(res.cards);
    setDueCount(res.dueCount);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getVocabularyAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error); setError(res.error); return; }
        setCards(res.cards);
        setDueCount(res.dueCount);
      })
      .catch(() => setError("Gagal memuat kosakata."));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) => c.front_text.toLowerCase().includes(q) || c.back_text.toLowerCase().includes(q)
    );
  }, [cards, query]);

  async function addCard() {
    if (adding || !word.trim() || !translation.trim()) return;
    setAdding(true);
    setMessage(null);
    setError(null);
    const res = await addVocabularyAction({ word, translation }).catch(() => ({ error: "Gagal menyimpan." }));
    setAdding(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    setWord("");
    setTranslation("");
    setMessage("Kosakata ditambahkan ke bank! Mulai review kapan saja.");
    load();
  }

  async function removeCard(id: number) {
    setError(null);
    const res = await deleteVocabularyAction(id).catch(() => ({ error: "Gagal menghapus." }));
    if ("error" in res && res.error) { setError(res.error); return; }
    load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Kosakata Bank 📖</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {dueCount > 0
              ? `${dueCount} kosakata menunggu review hari ini`
              : "Tidak ada kosakata yang perlu review — tambah kata baru atau cek lagi nanti."}
          </p>
        </div>
        <Link
          href={`/flashcard-review?kind=vocab`}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
            dueCount > 0 ? "bg-teal-500 hover:bg-teal-600" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed pointer-events-none"
          }`}
        >
          Mulai Review ({dueCount})
        </Link>
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card mb-6">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Tambah Kosakata Baru</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={`Kata dalam ${language} (contoh: apple)`}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <input
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="Arti dalam Bahasa Indonesia"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <button
            type="button"
            onClick={addCard}
            disabled={adding || !word.trim() || !translation.trim()}
            className="px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold"
          >
            {adding ? "..." : "Tambah"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold text-slate-400">{cards ? `${filtered.length} kata` : ""}</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari kata..."
          className="w-52 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {cards === null ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center shadow-card">
          <p className="text-sm text-slate-400">
            {cards.length === 0
              ? "Bank kosakata masih kosong. Tambahkan kata pertamamu di atas!"
              : "Tidak ada kata yang cocok dengan pencarian."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate">{c.front_text}</p>
                  <SpeakButton text={c.front_text} lang={ttsLang} rate={0.95} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.back_text}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {c.repetition > 0 ? `Diulang ${c.repetition}× · interval ${c.interval_days} hari` : "Baru"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeCard(c.id)}
                className="shrink-0 text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors"
                title="Hapus kosakata"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
