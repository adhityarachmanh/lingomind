"use client";

import { useEffect, useState } from "react";
import { sendPolyglotMessageAction, saveFlashcardAction, type PolyglotAnalysis } from "@/lib/actions/chat";
import { toast } from "sonner";
import SpeakButton from "./SpeakButton";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  analysis?: PolyglotAnalysis;
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
  

  const ttsMap: Record<string, string> = {
    English: "en-US", Japanese: "ja-JP", Korean: "ko-KR", Mandarin: "zh-CN",
    Spanish: "es-ES", French: "fr-FR", German: "de-DE", Indonesian: "id-ID",
  };

  function startChat(sId: string, sTitle: string) {
    setScenarioId(sId);
    setScenarioTitle(sTitle);
    setTtsLang(ttsMap[language] ?? "en-US");
    setMessages([]);
    setPhase("chat");
    setError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
    try {
      const res = await sendPolyglotMessageAction(scenarioId, language, text);
    if ("error" in res) { setError(res.error ?? null); return; }
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-2">Polyglot Tutor</h1>
        <p className="text-sm text-slate-500 mb-6">AI Language Practice with Deep Feedback</p>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm mb-6 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20">
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scenario</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => startChat(s.id, s.title)}
              className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-500/50 transition-colors">
              <p className="font-bold text-sm">{s.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-3.5rem)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-extrabold">{scenarioTitle}</h1>
          <p className="text-xs text-slate-400">{language}</p>
        </div>
        <button onClick={() => setPhase("picker")}
          className="text-xs font-semibold text-slate-400 hover:text-teal-600">Ganti Scenario</button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-none bg-teal-500 text-white text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="space-y-3">
              {/* Tutor Feedback Card */}
              {m.analysis && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">Tutor Feedback</span>
                    <span className="text-[11px] font-bold text-amber-600">
                      Grammar: {m.analysis.scores.grammar}/100 · Fluency: {m.analysis.scores.fluency}
                    </span>
                  </div>
                  {m.analysis.detailed_analysis.length > 0 ? (
                    <div className="px-4 py-3 space-y-2">
                      {m.analysis.detailed_analysis.map((d, i) => (
                        <div key={i} className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="text-rose-600 line-through">{d.original_segment}</span>
                                <span className="mx-1.5 text-slate-400">→</span>
                                <span className="text-emerald-600 font-semibold">{d.corrected_segment}</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                <span className="font-bold text-amber-700">{d.rule}</span>: {d.explanation_in_indonesian}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-emerald-600 font-semibold">✅ Tidak ada kesalahan — bagus!</div>
                  )}
                  {m.analysis.native_rephrasing && (
                    <div className="px-4 py-3 border-t border-amber-200 space-y-1.5">
                      <p className="text-xs font-bold text-slate-500">Native Rephrasing</p>
                      <p className="text-xs"><span className="font-bold text-slate-600">Formal:</span> {m.analysis.native_rephrasing.formal}</p>
                      <p className="text-xs"><span className="font-bold text-slate-600">Casual:</span> {m.analysis.native_rephrasing.casual}</p>
                    </div>
                  )}
                  {m.analysis.vocab_highlight && (
                    <div className="px-4 py-3 border-t border-amber-200 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-teal-700">{m.analysis.vocab_highlight.word_target}</p>
                        <p className="text-[10px] text-slate-500">{m.analysis.vocab_highlight.meaning_in_indonesian}</p>
                      </div>
                      <button onClick={() => saveVocab(m.analysis!.vocab_highlight.word_target, m.analysis!.vocab_highlight.meaning_in_indonesian)}
                        className="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold shrink-0">
                        💾 Simpan
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Roleplay Reply Bubble */}
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-1.5">
                  <div className="flex items-start gap-2">
                    <SpeakButton text={m.content} lang={ttsLang} rate={1.0} />
                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-white border border-slate-200 text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                  {m.analysis?.reply_translation_in_indonesian && (
                    <p className="text-[11px] text-slate-400 italic pl-10">{m.analysis.reply_translation_in_indonesian}</p>
                  )}
                </div>
              </div>
            </div>
          )
        )}
        {sending && <p className="text-xs text-slate-400 text-center py-3">AI Tutor menganalisis...</p>}
      </div>

      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={sending}
          placeholder={`Ketik dalam bahasa ${language}...`}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
        <button type="button" onClick={send} disabled={!input.trim() || sending}
          className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">Kirim</button>
      </div>
    </div>
  );
}
