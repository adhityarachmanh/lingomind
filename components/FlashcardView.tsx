"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, Download, RefreshCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteFlashcardAction, getAllFlashcardsAction, type FlashcardDto } from "@/lib/actions/chat";
import { exportFlashcardsAction, getDueFlashcardsAction, reviewFlashcardAction, type DueFlashcardDto } from "@/lib/actions/flashcards";
import { getLanguageFlag } from "@/lib/languages";

type Phase = "list" | "review";

export default function FlashcardView() {
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [dueCards, setDueCards] = useState<DueFlashcardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("list");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  async function loadAll() {
    const res = await getAllFlashcardsAction();
    if ("error" in res) { toast.error(res.error); return; }
    setCards(res.cards);
  }

  async function loadDue() {
    const res = await getDueFlashcardsAction();
    if ("error" in res) { toast.error(res.error); return; }
    setDueCards(res.cards);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllFlashcardsAction();
        if (cancelled) return;
        if ("error" in all) { toast.error(all.error); return; }
        setCards(all.cards);
        const due = await getDueFlashcardsAction();
        if (cancelled) return;
        if ("error" in due) { toast.error(due.error); return; }
        setDueCards(due.cards);
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Gagal memuat flashcard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function remove(id: string) {
    if (!confirm("Hapus flashcard ini?")) return;
    try {
      const res = await deleteFlashcardAction(id);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Flashcard dihapus.");
      setCards((prev) => prev.filter((c) => c.id !== id));
      setDueCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus flashcard.");
    }
  }

  async function startReview() {
    setReviewIndex(0);
    setFlipped(false);
    setPhase("review");
  }

  async function answer(remembered: boolean) {
    const card = dueCards[reviewIndex];
    if (!card || reviewing) return;
    setReviewing(true);
    try {
      const res = await reviewFlashcardAction(card.id, remembered);
      if ("error" in res) { toast.error(res.error); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan hasil review.");
      return;
    } finally {
      setReviewing(false);
    }
    if (reviewIndex + 1 >= dueCards.length) {
      setPhase("list");
      setFlipped(false);
      toast.success("Review selesai!");
      loadDue();
      return;
    }
    setReviewIndex((i) => i + 1);
    setFlipped(false);
  }

  async function exportCsv() {
    try {
      const res = await exportFlashcardsAction();
      if ("error" in res) { toast.error(res.error); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lingomind-flashcards.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Flashcard diekspor (CSV).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengekspor flashcard.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.frontText.toLowerCase().includes(q) || c.backText.toLowerCase().includes(q));
  }, [cards, query]);

  const byLanguage = useMemo(() => {
    const groups = new Map<string, FlashcardDto[]>();
    for (const c of filtered) {
      const list = groups.get(c.language) ?? [];
      list.push(c);
      groups.set(c.language, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (phase === "review") {
    const card = dueCards[reviewIndex];
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" /> Review
          </h1>
          <span className="text-sm text-muted-foreground">
            {reviewIndex + 1} / {dueCards.length}
          </span>
        </div>
        {card ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="w-full min-h-56 rounded-2xl border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-teal-500/60 transition-colors"
            >
              <p dir="auto" className="text-2xl font-bold break-words">{flipped ? card.backText : card.frontText}</p>
              <p className="text-xs text-muted-foreground">{flipped ? "Arti" : "Klik untuk lihat arti"}</p>
            </button>
            {flipped ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => answer(false)} disabled={reviewing}>
                  Lupa
                </Button>
                <Button className="flex-1" onClick={() => answer(true)} disabled={reviewing}>
                  Ingat
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Ingat artinya? Klik kartu, lalu jawab.</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Tidak ada kartu untuk di-review.</p>
            <Button className="mt-4" onClick={() => setPhase("list")}>Kembali</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-extrabold">Flashcard Saya</h1>
        </div>
        {cards.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
            <Button size="sm" onClick={startReview} disabled={dueCards.length === 0}>
              <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Ulangi ({dueCards.length})
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {cards.length === 0
          ? "Belum ada flashcard. Simpan kosakata dari chat dengan tombol \"Simpan\" di kartu Analisis Bahasa."
          : `${cards.length} flashcard tersimpan · ${dueCards.length} menunggu review.`}
      </p>

      {cards.length > 0 && (
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kata atau arti..."
            className="pl-9"
          />
        </div>
      )}

      {cards.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Tidak ada hasil untuk pencarian ini.</p>
      )}

      <div className="space-y-5">
        {byLanguage.map(([language, list]) => (
          <div key={language}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold">{getLanguageFlag(language)} {language}</span>
              <span className="text-[11px] text-muted-foreground">{list.length} kartu</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((c) => (
                <div key={c.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-sm font-semibold truncate">{c.frontText}</p>
                    <p dir="auto" className="text-xs text-muted-foreground truncate">{c.backText}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => remove(c.id)} aria-label="Hapus flashcard">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <BookMarked className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Kosakata yang Anda simpan dari chat akan tampil di sini.
          </p>
        </div>
      )}
    </div>
  );
}
