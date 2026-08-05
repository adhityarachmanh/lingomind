"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearChatHistoryAction,
  deleteSessionAction,
  getChatHomeAction,
  resumeSessionAction,
  type ScenarioSummary,
  type SessionSummary,
} from "@/lib/actions/scenario";
import { openSessionAction } from "@/lib/actions/chat";
import ScenarioCreateDialog from "./ScenarioCreateDialog";
import { HistoryRow, ScenarioCard } from "./chat-lists";

export default function ChatHomeView() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function load() {
    const res = await getChatHomeAction();
    if ("error" in res) { toast.error(res.error); return; }
    setScenarios(res.scenarios);
    setHistory(res.history);
    setLoading(false);
  }

  useEffect(() => {
    getChatHomeAction().then((res) => {
      if ("error" in res) { toast.error(res.error); return; }
      setScenarios(res.scenarios);
      setHistory(res.history);
      setLoading(false);
    });
  }, []);

  async function openScenario(s: ScenarioSummary) {
    const res = await openSessionAction(s.id, s.language);
    if ("error" in res) { toast.error(res.error); return; }
    router.push(`/chat?session=${res.sessionId}`);
  }

  async function openHistory(id: string) {
    const item = history.find((h) => h.id === id);
    if (item && !item.active) {
      const r = await resumeSessionAction(id);
      if ("error" in r) { toast.error(r.error); return; }
    }
    router.push(`/chat?session=${id}`);
  }

  async function removeSession(id: string) {
    if (!confirm("Hapus percakapan ini?")) return;
    const res = await deleteSessionAction(id);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Percakapan dihapus.");
    load();
  }

  async function clearAll() {
    if (!confirm("Hapus semua riwayat percakapan?")) return;
    setClearing(true);
    const res = await clearChatHistoryAction();
    setClearing(false);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Semua riwayat dihapus.");
    load();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Skenario Saya</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">Belum ada skenario. Buat skenario pertamamu untuk mulai belajar!</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Riwayat Percakapan
        </h2>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearAll} disabled={clearing}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {clearing ? "Menghapus..." : "Hapus Semua"}
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada riwayat percakapan.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <HistoryRow key={h.id} item={h} onOpen={openHistory} onDelete={removeSession} />
          ))}
        </div>
      )}

      <ScenarioCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
}
