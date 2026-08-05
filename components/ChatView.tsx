"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Bot, ChevronDown, ChevronUp, FileCheck2, Loader2, LogOut, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { endChatSessionAction, saveFlashcardAction, sendPolyglotMessageAction, type PolyglotAnalysis } from "@/lib/actions/chat";
import { getSessionMessagesAction, type SessionDto } from "@/lib/actions/scenario";
import { TTS_LANG_MAP } from "@/lib/languages";
import { toast } from "sonner";
import SpeakButton from "./SpeakButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LanguageBadge } from "./chat-lists";
import ChatSidebar from "./ChatSidebar";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  analysis?: PolyglotAnalysis;
  translation?: string;
  expanded?: boolean;
}

export default function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<SessionDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const ttsLang = TTS_LANG_MAP[session?.language ?? ""] ?? "en-US";

  useEffect(() => {
    if (!sessionId) {
      router.replace("/chat");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getSessionMessagesAction(sessionId);
      if (cancelled) return;
      if ("error" in res) {
        toast.error(res.error ?? "Percakapan tidak ditemukan.");
        router.replace("/chat");
        return;
      }
      setSession(res.session);
      setMessages(res.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        analysis: (m.analysisJson as PolyglotAnalysis | null) ?? undefined,
        translation: m.role === "ai" ? ((m.analysisJson as PolyglotAnalysis | null)?.reply_translation_in_indonesian ?? undefined) : undefined,
        expanded: false,
      })));
      const lastAi = [...res.messages].reverse().find((m) => m.role === "ai");
      const sugg = (lastAi?.analysisJson as PolyglotAnalysis | null)?.suggested_replies;
      setSuggestions(Array.isArray(sugg) ? sugg : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  async function send(textOverride?: string) {
    if (!sessionId || sending) return;
    const text = (textOverride ?? input).trim();
    if (!text) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Tidak ada koneksi internet. Coba lagi.");
      return;
    }
    setInput("");
    setSuggestions([]);
    setSending(true);
    setError(null);
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
    try {
      const res = await sendPolyglotMessageAction(sessionId, text);
      if ("error" in res) { setError(res.error ?? null); return; }
      setSuggestions(res.analysis.suggested_replies ?? []);
      setMessages((m) => [...m, { id: res.messageId, role: "ai", content: res.analysis.reply_in_target_language, analysis: res.analysis, translation: res.analysis.reply_translation_in_indonesian, expanded: false }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
    } finally {
      setSending(false);
    }
  }

  async function saveVocab(word: string, meaning: string) {
    const res = await saveFlashcardAction(word, meaning, session?.language ?? "English");
    if ("error" in res) { setError(res.error ?? null); return; }
    toast.success(`${word} disimpan ke flashcard!`);
  }

  async function endSession() {
    if (!sessionId) { router.push("/chat"); return; }
    try {
      const res = await endChatSessionAction(sessionId);
      if ("error" in res) { toast.error(res.error); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengakhiri sesi.");
      return;
    }
    toast.success("Sesi diakhiri. Percakapan baru dimulai saat memilih skenario.");
    router.push("/chat");
  }

  function toggleExpanded(id: string) {
    setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Skeleton className="h-6 w-40 mb-6" />
        <Skeleton className="h-16 w-2/3 mb-3" />
        <Skeleton className="h-16 w-1/2" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <div className="hidden lg:flex w-80 shrink-0 border-r border-border">
        <ChatSidebar activeSessionId={sessionId} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col max-w-3xl mx-auto w-full px-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push("/chat")} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold truncate">{session?.scenarioTitle}</h1>
              <LanguageBadge language={session?.language ?? ""} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={endSession} disabled={sending}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Akhiri Sesi
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-[env(safe-area-inset-bottom)]">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                {m.analysis && m.analysis.scores && (
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
                    {(m.translation ?? m.analysis?.reply_translation_in_indonesian) && (
                      <p className="text-[11px] text-muted-foreground italic pl-10">{m.translation ?? m.analysis?.reply_translation_in_indonesian}</p>
                    )}
                  </div>
                </div>
              </div>
            )
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

        {suggestions.length > 0 && !sending && (
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
            disabled={sending}
            placeholder={`Ketik dalam bahasa ${session?.language ?? "..."}...`}
            className="flex-1"
          />
          <Button type="button" onClick={() => send()} disabled={!input.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {sending ? "" : "Kirim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
