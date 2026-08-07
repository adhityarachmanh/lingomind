"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, ChevronUp, FileCheck2, Send, Square, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { analyzeChatMessageAction, saveFlashcardAction, saveStreamedMessageAction, sendGeneralMessageAction, sendPolyglotMessageAction, type PolyglotAnalysis } from "@/lib/actions/chat";
import MarkdownContent from "./MarkdownContent";
import { deleteSessionAction, getSessionMessagesAction, type SessionDto } from "@/lib/actions/scenario";
import { normalizeSuggestedReplies, type SuggestedReply } from "@/lib/chat-helpers";
import { TTS_LANG_MAP } from "@/lib/languages";
import { toast } from "sonner";
import SpeakButton from "./SpeakButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { LanguageBadge } from "./chat-lists";
import ChatSidebar from "./ChatSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  analysis?: PolyglotAnalysis;
  romanization?: string;
  translation?: string;
}

function RomanizationLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5">
      <span className="mt-px inline-flex items-center shrink-0 rounded bg-primary/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
        Baca
      </span>
      <span dir="auto" className="text-[11px] text-foreground/80">{text}</span>
    </p>
  );
}

function TranslationLine({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5">
      <span className="mt-px inline-flex items-center shrink-0 rounded bg-muted px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        Arti
      </span>
      <span dir="auto" className="text-[11px] text-muted-foreground italic">{text}</span>
    </p>
  );
}

export default function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<SessionDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingRomanization, setStreamingRomanization] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [analysisTarget, setAnalysisTarget] = useState<Message | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const tempIdRef = useRef(0);

  const ttsLang = TTS_LANG_MAP[session?.language ?? ""] ?? "en-US";
  const isGeneral = session?.type === "general";

  function applySuggestions(next: SuggestedReply[]) {
    setSuggestions(next);
    if (next.length > 0) setSuggestionsOpen(true);
  }

  useEffect(() => {
    if (!sessionId) {
      router.replace("/chat");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getSessionMessagesAction(sessionId);
        if (cancelled) return;
        if ("error" in res) {
          toast.error(res.error ?? "Percakapan tidak ditemukan.");
          if (res.error === "Sesi berakhir. Silakan login kembali.") {
            router.replace("/login");
          } else {
            router.replace("/chat");
          }
          return;
        }
        setSession(res.session);
        setMessages(res.messages.map((m) => {
          const aj = m.analysisJson as (PolyglotAnalysis & { translation_in_indonesian?: string; romanization?: string }) | null;
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            analysis: aj ?? undefined,
            romanization: m.role === "ai"
              ? (aj?.reply_romanization ?? undefined)
              : (aj?.romanization ?? undefined),
            translation: m.role === "ai"
              ? (aj?.reply_translation_in_indonesian ?? undefined)
              : (aj?.translation_in_indonesian ?? undefined),
          };
        }));
        const lastAi = [...res.messages].reverse().find((m) => m.role === "ai");
        applySuggestions(normalizeSuggestedReplies((lastAi?.analysisJson as PolyglotAnalysis | null)?.suggested_replies));
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Gagal memuat percakapan.");
        router.replace("/chat");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, analyzing, loading]);

  async function send(textOverride?: string, chipRomanization?: string, chipTranslation?: string) {
    if (!sessionId || streaming || analyzing) return;
    const text = (textOverride ?? input).trim();
    if (!text) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Tidak ada koneksi internet. Coba lagi.");
      return;
    }
    setInput("");
    setSuggestions([]);
    setError(null);
    const userMsgId = `user-${++tempIdRef.current}`;
    setMessages((m) => [...m, { id: userMsgId, role: "user", content: text, romanization: chipRomanization, translation: chipTranslation }]);

    async function fetchStream(): Promise<string> {
      const controller = new AbortController();
      abortRef.current = controller;
      let acc = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, text }),
          signal: controller.signal,
        });
        if (!res.ok) {
          let msg = "Gagal mengirim pesan.";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) msg = data.error;
          } catch {}
          if (msg === "Sesi berakhir. Silakan login kembali.") {
            router.replace("/login");
            return "";
          }
          throw new Error(msg);
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            setStreamingText(acc);
          }
        }
        return acc;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return acc;
        throw e;
      }
    }

    let acc = "";
    setStreaming(true);
    setStreamingText("");
    try {
      acc = await fetchStream();
      if (!acc.trim()) {
        acc = await fetchStream();
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      setStreaming(false);
      setStreamingText("");
      abortRef.current = null;
      return;
    } finally {
      setStreaming(false);
    }

    const parts = acc.split("||ROM||");
    const replyText = (parts[0] ?? "").trim();
    const romanization = (parts[1] ?? "").trim();
    setStreamingRomanization(romanization);

    if (isGeneral) {
      if (!replyText) {
        if (!mountedRef.current) return;
        setAnalyzing(true);
        try {
          const res = await sendGeneralMessageAction(sessionId, text);
          if (!mountedRef.current) return;
          if ("error" in res) {
            setError(res.error);
            return;
          }
          setMessages((m) => [...m, { id: res.messageId, role: "ai", content: res.reply }]);
        } catch (e) {
          if (!mountedRef.current) return;
          setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
        } finally {
          setAnalyzing(false);
          setStreamingText("");
          setStreamingRomanization("");
          abortRef.current = null;
        }
        return;
      }
      if (!mountedRef.current) return;
      setAnalyzing(true);
      try {
        const res = await saveStreamedMessageAction(sessionId, replyText);
        if (!mountedRef.current) return;
        if ("error" in res) {
          toast.error(res.error);
          setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText }]);
          return;
        }
        setMessages((m) => [...m, { id: res.messageId, role: "ai", content: replyText }]);
      } catch (e) {
        if (!mountedRef.current) return;
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan balasan.");
        setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText }]);
      } finally {
        setAnalyzing(false);
        setStreamingText("");
        setStreamingRomanization("");
        abortRef.current = null;
      }
      return;
    }

    if (!replyText) {
      if (!mountedRef.current) return;
      setAnalyzing(true);
      try {
        const res = await sendPolyglotMessageAction(sessionId, text);
        if (!mountedRef.current) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        applySuggestions(normalizeSuggestedReplies(res.analysis.suggested_replies));
        setMessages((m) => m.map((msg) =>
          msg.id === userMsgId
            ? { ...msg, romanization: res.analysis.user_message_romanization || msg.romanization, translation: res.analysis.user_message_translation_in_indonesian || msg.translation }
            : msg
        ));
        setMessages((m) => [
          ...m,
          {
            id: res.messageId,
            role: "ai",
            content: res.analysis.reply_in_target_language,
            analysis: res.analysis,
            romanization: res.analysis.reply_romanization,
            translation: res.analysis.reply_translation_in_indonesian,
          },
        ]);
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : "Gagal mengirim pesan.");
      } finally {
        setAnalyzing(false);
        setStreamingText("");
        setStreamingRomanization("");
        abortRef.current = null;
      }
      return;
    }

    if (!mountedRef.current) return;
    setAnalyzing(true);
    try {
      const res = await analyzeChatMessageAction(sessionId, text, replyText, romanization || undefined);
      if (!mountedRef.current) return;
      if ("error" in res) {
        toast.error(res.error);
        setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText, romanization: romanization || undefined }]);
        return;
      }
      applySuggestions(normalizeSuggestedReplies(res.analysis.suggested_replies));
      setMessages((m) => m.map((msg) =>
        msg.id === userMsgId
          ? { ...msg, romanization: res.analysis.user_message_romanization || msg.romanization, translation: res.analysis.user_message_translation_in_indonesian || msg.translation }
          : msg
      ));
      setMessages((m) => [
        ...m,
        {
          id: res.messageId,
          role: "ai",
          content: replyText,
          analysis: res.analysis,
          romanization: res.analysis.reply_romanization ?? (romanization || undefined),
          translation: res.analysis.reply_translation_in_indonesian,
        },
      ]);
    } catch (e) {
      if (!mountedRef.current) return;
      toast.error(e instanceof Error ? e.message : "Gagal menganalisis.");
      setMessages((m) => [...m, { id: String(Date.now()), role: "ai", content: replyText, romanization: romanization || undefined }]);
    } finally {
      setAnalyzing(false);
      setStreamingText("");
      setStreamingRomanization("");
      abortRef.current = null;
    }
  }

  async function saveVocab(word: string, meaning: string) {
    const res = await saveFlashcardAction(word, meaning, session?.language ?? "English");
    if ("error" in res) { setError(res.error ?? null); return; }
    toast.success(`${word} disimpan ke flashcard!`);
  }

  async function deleteSession() {
    if (!sessionId) { router.push("/chat"); return; }
    if (!confirm("Hapus percakapan ini?")) return;
    try {
      const res = await deleteSessionAction(sessionId);
      if ("error" in res) { toast.error(res.error); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus percakapan.");
      return;
    }
    toast.success("Percakapan dihapus.");
    router.push("/chat");
  }

  useEffect(() => {
    mountedRef.current = true;
    router.prefetch("/chat");
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [router]);

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
    <TooltipProvider delayDuration={200}>
      <div className="fixed inset-x-0 bottom-0 top-[calc(3.5rem_+_env(safe-area-inset-top))] flex">
      <div className="hidden lg:flex w-80 shrink-0 border-r border-border">
        <ChatSidebar activeSessionId={sessionId} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col max-w-3xl mx-auto w-full px-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 -ml-1.5" onClick={() => router.push("/chat")} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold truncate">{session?.scenarioTitle}</h1>
              <LanguageBadge language={session?.language ?? ""} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={deleteSession} disabled={streaming || analyzing} className="hidden sm:inline-flex text-destructive hover:text-destructive shrink-0">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Hapus Percakapan
          </Button>
          <Button variant="ghost" size="icon" onClick={deleteSession} disabled={streaming || analyzing} className="sm:hidden text-destructive hover:text-destructive shrink-0" aria-label="Hapus percakapan">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex flex-col items-end gap-1">
                <div dir="auto" className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                  {m.content}
                </div>
                {m.romanization && (
                  <div className="max-w-[80%]"><RomanizationLine text={m.romanization} /></div>
                )}
                {m.translation && (
                  <div className="max-w-[80%]"><TranslationLine text={m.translation} /></div>
                )}
              </div>
            ) : (
              <div key={m.id} className="space-y-3">
                {m.analysis && m.analysis.scores && !isGeneral && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground -ml-2"
                    onClick={() => setAnalysisTarget(m)}
                  >
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Lihat Penjelasan
                  </Button>
                )}
                <div className="flex justify-start gap-2.5">
                  <Avatar className="h-8 w-8 shrink-0 border border-border bg-secondary text-primary">
                    <AvatarImage src="/logo.png" alt="LingoMind" />
                  </Avatar>
                  <div className="max-w-[85%] space-y-1.5">
                    <div className="flex items-start gap-2">
                      <SpeakButton text={m.content} lang={ttsLang} />
                      <div dir="auto" className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border text-sm whitespace-pre-wrap">
                        {isGeneral ? <MarkdownContent content={m.content} /> : m.content}
                      </div>
                    </div>
                    <div className="pl-10 space-y-1">
                      {!isGeneral && (m.romanization ?? m.analysis?.reply_romanization) && (
                        <RomanizationLine text={m.romanization ?? m.analysis?.reply_romanization ?? ""} />
                      )}
                      {!isGeneral && (m.translation ?? m.analysis?.reply_translation_in_indonesian) && (
                        <TranslationLine text={m.translation ?? m.analysis?.reply_translation_in_indonesian ?? ""} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
          {(streaming || analyzing) && (
            <div className="flex justify-start gap-2.5">
              <Avatar className="h-8 w-8 shrink-0 border border-border bg-secondary text-primary">
                <AvatarImage src="/logo.png" alt="LingoMind" />
              </Avatar>
              <div className="max-w-[85%] space-y-1.5">
                <div dir="auto" className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border text-sm whitespace-pre-wrap">
                  {isGeneral ? <MarkdownContent content={streamingText.includes("||ROM||") ? streamingText.split("||ROM||")[0] : streamingText} /> : streamingText.includes("||ROM||") ? streamingText.split("||ROM||")[0] : streamingText}
                  {streaming && <span className="animate-pulse">▌</span>}
                </div>
                {analyzing && (
                  <div className="pl-10 space-y-1">
                    {!isGeneral && streamingRomanization && <RomanizationLine text={streamingRomanization} />}
                    <Skeleton className="h-3 w-44" />
                    <p className="text-[11px] text-muted-foreground">{isGeneral ? "Memproses balasan..." : "Menerjemahkan & menganalisis..."}</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="pt-3 space-y-3">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {suggestions.length > 0 && !streaming && !analyzing && !isGeneral && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saran jawaban:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  aria-label={suggestionsOpen ? "Sembunyikan saran" : "Tampilkan saran"}
                >
                  {suggestionsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {suggestionsOpen && (
                <div className="flex flex-wrap items-center gap-2">
                  {suggestions.map((s, i) => (
                    <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => send(s.text, s.romanization, s.translation_in_indonesian)}>
                      {s.text}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              disabled={streaming || analyzing}
              dir="auto"
              placeholder={isGeneral ? "Ketik pesan..." : `Ketik dalam bahasa ${session?.language ?? "..."}...`}
              className="flex-1 min-w-0"
            />
            {streaming ? (
              <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                <Square className="h-4 w-4 mr-1" /> Stop
              </Button>
            ) : (
              <Button type="button" onClick={() => send()} disabled={!input.trim() || analyzing}>
                <Send className="h-4 w-4 mr-1" />
                Kirim
              </Button>
            )}
          </div>
        </div>
      </div>
      <Dialog open={analysisTarget !== null} onOpenChange={(open: boolean) => { if (!open) setAnalysisTarget(null); }}>
          <DialogContent className="sm:max-w-xl max-h-[80dvh] flex flex-col">
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-1.5 text-base">
                <FileCheck2 className="h-4 w-4 text-primary" /> Analisis Bahasa
              </DialogTitle>
            </DialogHeader>
            {analysisTarget?.analysis && (
              <div className="overflow-y-auto pr-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground">Skor &amp; Detail</p>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground shrink-0">
                    Grammar {analysisTarget.analysis.scores.grammar} · {analysisTarget.analysis.scores.fluency}
                  </Badge>
                </div>
                {analysisTarget.analysis.detailed_analysis.length > 0 ? (
                  <div className="space-y-2">
                    {analysisTarget.analysis.detailed_analysis.map((d, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-sm">
                          <span className="text-destructive line-through decoration-destructive/60">{d.original_segment}</span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="text-emerald-400 font-semibold">{d.corrected_segment}</span>
                        </p>
                        {d.corrected_romanization && (
                          <p className="text-[11px] text-muted-foreground italic mt-0.5">({d.corrected_romanization})</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          <span className="font-semibold text-foreground">{d.rule}</span> — {d.explanation_in_indonesian}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400 font-medium">Tidak ada kesalahan — kalimat Anda sudah tepat.</div>
                )}
                {analysisTarget.analysis.native_rephrasing && (
                  <div className="space-y-1.5 pt-3 border-t border-border">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ungkapan Alternatif</p>
                    <div>
                      <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Formal</span> — {analysisTarget.analysis.native_rephrasing.formal}</p>
                      {analysisTarget.analysis.native_rephrasing.formal_meaning_in_indonesian && (
                        <p className="text-[11px] text-muted-foreground italic">{analysisTarget.analysis.native_rephrasing.formal_meaning_in_indonesian}</p>
                      )}
                      {analysisTarget.analysis.native_rephrasing.formal_romanization && (
                        <p className="text-[11px] text-muted-foreground">({analysisTarget.analysis.native_rephrasing.formal_romanization})</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-foreground/90"><span className="text-muted-foreground font-medium">Casual</span> — {analysisTarget.analysis.native_rephrasing.casual}</p>
                      {analysisTarget.analysis.native_rephrasing.casual_meaning_in_indonesian && (
                        <p className="text-[11px] text-muted-foreground italic">{analysisTarget.analysis.native_rephrasing.casual_meaning_in_indonesian}</p>
                      )}
                      {analysisTarget.analysis.native_rephrasing.casual_romanization && (
                        <p className="text-[11px] text-muted-foreground">({analysisTarget.analysis.native_rephrasing.casual_romanization})</p>
                      )}
                    </div>
                  </div>
                )}
                {analysisTarget.analysis.vocab_highlight && (
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border bg-muted/20 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{analysisTarget.analysis.vocab_highlight.word_target}</p>
                      {analysisTarget.analysis.vocab_highlight.romanization && (
                        <p className="text-[10px] text-muted-foreground">{analysisTarget.analysis.vocab_highlight.romanization}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate">{analysisTarget.analysis.vocab_highlight.meaning_in_indonesian}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveVocab(analysisTarget!.analysis!.vocab_highlight.word_target, analysisTarget!.analysis!.vocab_highlight.meaning_in_indonesian)}
                      className="shrink-0"
                    >
                      <Bookmark className="h-3.5 w-3.5 mr-1" /> Simpan
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
