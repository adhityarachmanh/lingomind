"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ScenarioSummary, SessionSummary } from "@/lib/actions/scenario";
import { getLanguageFlag } from "@/lib/languages";

export function LanguageBadge({ language }: { language: string }) {
  return (
    <Badge variant="outline" className="text-[11px] text-muted-foreground">
      {getLanguageFlag(language)} {language}
    </Badge>
  );
}

export function ScenarioCard({ scenario, onOpen }: { scenario: ScenarioSummary; onOpen: (s: ScenarioSummary) => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer p-4 hover:border-teal-500/60 hover:shadow-md transition-all"
      onClick={() => onOpen(scenario)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(scenario); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-sm truncate">{scenario.title}</p>
        {scenario.hasActiveSession && <Badge variant="secondary" className="shrink-0 text-[10px]">Aktif</Badge>}
        {scenario.type === "general" && <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">Umum</Badge>}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{scenario.description}</p>
      {scenario.type !== "general" && <div className="mt-2"><LanguageBadge language={scenario.language} /></div>}
    </Card>
  );
}

export function HistoryRow({ item, onOpen, onDelete }: { item: SessionSummary; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item.id)}>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{item.scenarioTitle}</span>
          {item.active && <Badge variant="secondary" className="shrink-0 text-[10px]">Aktif</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.lastMessagePreview || "Belum ada pesan"}</p>
        <div className="flex items-center gap-2 mt-1">
          <LanguageBadge language={item.language} />
          <span className="text-[10px] text-muted-foreground">{item.messageCount} pesan</span>
        </div>
      </button>
      <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => onDelete(item.id)} aria-label="Hapus percakapan">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
