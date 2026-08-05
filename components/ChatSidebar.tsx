"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteSessionAction,
  getChatHomeAction,
  resumeSessionAction,
  type ScenarioSummary,
  type SessionSummary,
} from "@/lib/actions/scenario";
import { openSessionAction } from "@/lib/actions/chat";
import { HistoryRow, ScenarioCard } from "./chat-lists";
import ScenarioCreateDialog from "./ScenarioCreateDialog";

export default function ChatSidebar({ activeSessionId }: { activeSessionId: string | null }) {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    const res = await getChatHomeAction();
    if ("error" in res) { toast.error(res.error); return; }
    setScenarios(res.scenarios);
    setHistory(res.history);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [activeSessionId]);

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

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-3 space-y-4">
      <Button variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" /> Buat Skenario
      </Button>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Skenario</p>
        <div className="space-y-2">
          {scenarios.length === 0 && <p className="text-xs text-muted-foreground">Belum ada skenario.</p>}
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onOpen={openScenario} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Riwayat
        </p>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>}
          {history.map((h) => (
            <HistoryRow key={h.id} item={h} onOpen={openHistory} onDelete={removeSession} />
          ))}
        </div>
      </div>

      <ScenarioCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
}
