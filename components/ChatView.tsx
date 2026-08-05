"use client";

import { useEffect, useState } from "react";
import { Bookmark, Bot, ChevronDown, ChevronUp, FileCheck2, Loader2, LogOut, PencilLine, Send } from "lucide-react";
import {
  endChatSessionAction,
  openSessionAction,
  saveFlashcardAction,
  sendPolyglotMessageAction,
  type PolyglotAnalysis,
} from "@/lib/actions/chat";
import { toast } from "sonner";
import SpeakButton from "./SpeakButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  translation?: string;
  analysis?: PolyglotAnalysis;
  expanded?: boolean;
}

const LANGUAGES = [
  { id: "English", label: "🇬🇧 English" },
  { id: "Japanese", label: "🇯🇵 日本語" },
  { id: "Korean", label: "🇰🇷 한국어" },
  { id: "Mandarin", label: "🇨🇳 中文" },
  { id: "Spanish", label: "🇪🇸 Español" },
  { id: "French", label: "🇫🇷 Français" },
  { id: "German", label: "🇩🇪 Deutsch" },
  { id: "Indonesian", label: "🇮🇩 Indonesia" },
];

const SCENARIOS = [
  { id: "Daily Standup", title: "Daily Standup Meeting", desc: "Tech standup meeting" },
  { id: "Restaurant", title: "Restaurant Ordering", desc: "Order food & interact with waiter" },
  { id: "Hotel", title: "Hotel Check-in", desc: "Front desk conversation" },
  { id: "Shopping", title: "Shopping", desc: "Ask prices, sizes, negotiation" },
  { id: "Hospital", title: "Hospital Visit", desc: "Describe symptoms, consult doctor" },
  { id: "Office", title: "Office Meeting", desc: "Discuss project timelines" },
  { id: "Airport", title: "Airport Immigration", desc: "Answer officer questions" },
  { id: "Small Talk", title: "Small Talk", desc: "Casual conversation with strangers" },
];

function ScenarioGrid({ onPick }: { onPick: (id: string, title: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SCENARIOS.map((s) => (
        <Card
          key={s.id}
          className="cursor-pointer p-4 hover:border-teal-500/60 hover:shadow-md transition-all"
          onClick={() => onPick(s.id, s.title)}
        >
          <p className="font-bold text-sm">{s.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
        </Card>
      ))}
    </div>
  );
}

export default function ChatView() {
  const [phase, setPhase] = useState<"picker" | "chat">("picker");
  const [language, setLanguage] = useState("English");
  const [scenarioId, setScenarioId] = useState("");
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [ttsLang, setTtsLang] = useState("en-US");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);

  const ttsMap: Record<string, string> = {
    English: "en-US", Japanese: "ja-JP", Korean: "ko-KR", Mandarin: "zh-CN",
    Spanish: "es-ES", French: "fr-FR", German: "de-DE", Indonesian: "id-ID",
  };

  async function startChat(sId: string, sTitle: string) {
    setScenarioId(sId);
    setScenarioTitle(sTitle);
    setTtsLang(ttsMap[language] ?? "en-US");
    setMessages([]);
    setSuggestions([]);
    setSessionId(null);
    setPhase("chat");
    setError(null);
    setSwitchOpen(false);
    setOpening(true);
    try {
      const res = await openSessionAction(sId, language);
      if ("error" in res) { toast.error(res.error); return; }
      setSessionId(res.sessionId);
      if ("alreadyStarted" in res) return;
      setMessages([{ id: res.messageId, role: "ai", content: res.reply, translation: res.translation }]);
      setSuggestions(res.suggestedReplies);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memulai percakapan.");
    } finally {
      setOpening(false);
    }
  }

  async function endSession() {
    if (sessionId) {
      try {
        const res = await endChatSessionAction(sessionId);
        if ("error" in res) { toast.error(res.error); return; }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal mengakhiri sesi.");
        return;
      }
    }
    toast.success("Sesi diakhiri. Percakapan baru dimulai saat memilih skenario.");
    setPhase("picker");
    setMessages([]);
    setSuggestions([]);
    setSessionId(null);
    setScenarioId("");
    setScenarioTitle("");
  }

  function toggleExpanded(id: string) {
    setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || sending || opening) return;
    setInput("");
    setSuggestions([]);
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
    try {
      const res = await sendPolyglotMessageAction(sessionId ?? "", text);
      if ("error" in res) { setError(res.error ?? null); return; }
      setSessionId(res.sessionId);
      setSuggestions(res.analysis.suggested_replies ?? []);
      setMessages((m) => [...m, { id: res.messageId, role: "ai", content: res.analysis.reply_in_target_language, analysis: res.analysis }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
    } finally {
      setSending(false);
    }
  }

  async function saveVocab(word: string, meaning: string) {
    const res = await saveFlashcardAction(word, meaning, language);
    if ("error" in res) { setError(res.error ?? null); return; }
    toast.success(`${word} disimpan ke flashcard!`);
  }

  if (phase === "picker") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-extrabold mb-2">Polyglot Tutor</h1>
          <p className="text-sm text-muted-foreground mb-6">AI Language Practice with Deep Feedback</p>
          <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full mb-6">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Scenario</Label>
          <ScenarioGrid onPick={startChat} />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-3.5rem)]">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h1 className="text-base font-extrabold truncate">{scenarioTitle}</h1>
            <Badge variant="secondary" className="mt-0.5 text-[11px]">{language}</Badge>
          </div>
          <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <PencilLine className="h-3.5 w-3.5 mr-1.5" />
                Ganti Skenario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pilih Skenario Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ScenarioGrid onPick={startChat} />
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={endSession} disabled={opening || sending}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Akhiri Sesi
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                {m.analysis && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground -ml-2"
                      onClick={() => toggleExpanded(m.id)}
                    >
                      {m.expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                      {m.expanded ? "Tutup Penjelasan" : "Lihat Penjelasan"}
                    </Button>
                    {m.expanded && (
                    <Card className="border-border bg-card overflow-hidden shadow-none">
                      <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Analisis Bahasa
                        </span>
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Grammar {m.analysis.scores.grammar} · {m.analysis.scores.fluency}
                        </Badge>
                      </div>
                      {m.analysis.detailed_analysis.length > 0 ? (
                        <div className="px-4 py-3 space-y-2">
                          {m.analysis.detailed_analysis.map((d, i) => (
                            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                              <p className="text-sm">
                                <span className="text-destructive line-through decoration-destructive/60">{d.original_segment}</span>
                                <span className="mx-1.5 text-muted-foreground">→</span>
                                <span className="text-emerald-400 font-semibold">{d.corrected_segment}</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                <span className="font-semibold text-foreground">{d.rule}</span> — {d.explanation_in_indonesian}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-emerald-400 font-medium">Tidak ada kesalahan — kalimat Anda sudah tepat.</div>
                      )}
                      {m.analysis.native_rephrasing && (
                        <div className="px-4 py-3 border-t border-border space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ungkapan Alternatif</p>
                          <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Formal</span> — {m.analysis.native_rephrasing.formal}</p>
                          <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Casual</span> — {m.analysis.native_rephrasing.casual}</p>
                        </div>
                      )}
                      {m.analysis.vocab_highlight && (
                        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 bg-muted/20">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{m.analysis.vocab_highlight.word_target}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{m.analysis.vocab_highlight.meaning_in_indonesian}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => saveVocab(m.analysis!.vocab_highlight.word_target, m.analysis!.vocab_highlight.meaning_in_indonesian)} className="shrink-0">
                            <Bookmark className="h-3.5 w-3.5 mr-1" /> Simpan
                          </Button>
                        </div>
                      )}
                    </Card>
                    )}
                  </div>
                )}
                <div className="flex justify-start gap-2.5">
                  <Avatar className="h-8 w-8 shrink-0 border border-border bg-secondary text-primary">
                    <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%] space-y-1.5">
                    <div className="flex items-start gap-2">
                      <SpeakButton text={m.content} lang={ttsLang} rate={1.0} />
                      <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border text-sm whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                    {(m.analysis?.reply_translation_in_indonesian ?? m.translation) && (
                      <p className="text-[11px] text-muted-foreground italic pl-10">
                        {m.analysis?.reply_translation_in_indonesian ?? m.translation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
          {opening && (
            <div className="flex justify-start gap-2">
              <Avatar className="h-8 w-8 shrink-0 border border-border bg-muted">
                <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="max-w-[85%] space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <p className="text-[11px] text-muted-foreground pt-1">AI Tutor membuka percakapan...</p>
              </div>
            </div>
          )}
          {sending && (
            <div className="flex justify-start gap-2">
              <Avatar className="h-8 w-8 shrink-0 border border-border bg-muted">
                <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="max-w-[85%] space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <p className="text-[11px] text-muted-foreground pt-1">AI Tutor menganalisis...</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        {suggestions.length > 0 && !sending && !opening && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saran jawaban:</span>
            {suggestions.map((s, i) => (
              <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            disabled={sending || opening}
            placeholder={`Ketik dalam bahasa ${language}...`}
            className="flex-1"
          />
          <Button type="button" onClick={() => send()} disabled={!input.trim() || sending || opening}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {sending ? "" : "Kirim"}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
