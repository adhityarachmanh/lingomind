"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteFlashcardAction, getAllFlashcardsAction, type FlashcardDto } from "@/lib/actions/chat";
import { getLanguageFlag } from "@/lib/languages";

export default function FlashcardView() {
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAllFlashcardsAction();
        if (cancelled) return;
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setCards(res.cards);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus flashcard.");
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-4">
        <BookMarked className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-extrabold">Flashcard Saya</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {cards.length === 0
          ? "Belum ada flashcard. Simpan kosakata dari chat dengan tombol \"Simpan\" di kartu Analisis Bahasa."
          : `${cards.length} flashcard tersimpan.`}
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
