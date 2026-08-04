import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { model } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildReplySystemPrompt } from "@/lib/ai-content/chat";
import { extractVocabularyFromChat } from "@/lib/ai-content/vocab";
import { addFlashcards } from "@/lib/flashcards";

export const runtime = "nodejs";
export const maxDuration = 60;

// Chat streaming: balasan AI tampil token-per-token (persepsi jauh lebih cepat daripada menunggu penuh).
// Pesan disimpan ke DB di onFinish (user message disimpan sebelum stream, AI setelah stream selesai).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "number" ? body.sessionId : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!sessionId || !message) return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });

  const chatSession = await db.chatSession.findFirst({ where: { id: sessionId, email: session.email } });
  if (!chatSession) return NextResponse.json({ error: "Sesi chat tidak valid atau tidak lagi sinkron. Coba buka ulang sesi." }, { status: 400 });

  await db.chatMessage.create({ data: { sessionId, sender: "user", content: message } });

  // 11 terakhir = 10 riwayat + pesan user baru (dibuang dari history agar tidak duplikat dengan messages)
  const window = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 11,
  });
  const history = window
    .reverse()
    .slice(0, -1)
    .map((m) => ({ role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant", content: m.content }));

  const isTopicBased = chatSession.roleplaySetting === chatSession.goal && chatSession.goal !== "Bebas";
  const system = buildReplySystemPrompt(
    chatSession.language,
    chatSession.level,
    chatSession.goal,
    chatSession.roleplaySetting,
    isTopicBased
  );

  try {
    const result = streamText({
      model,
      instructions: system,
      messages: [...history, { role: "user", content: message }],
      maxOutputTokens: 4096,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        const reply = text.trim();
        if (reply) {
          await db.chatMessage.create({ data: { sessionId, sender: "ai", content: reply } }).catch(() => {});
          // Ekstraksi kosakata latar belakang (fire-and-forget — tidak menahan stream):
          // kata baru dari percakapan masuk bank kosakata SRS user.
          if (reply.length >= 40) {
            void (async () => {
              const items = await extractVocabularyFromChat({
                language: chatSession.language,
                level: chatSession.level,
                userMessage: message,
                aiReply: reply,
              });
              if (items.length > 0) {
                await addFlashcards(
                  session.email,
                  items.map((i) => ({ language: chatSession.language, front_text: i.word, back_text: i.meaning, kind: "vocab" as const }))
                ).catch(() => {});
              }
            })();
          }
        }
      },
    });
    return result.toTextStreamResponse();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal menghasilkan balasan." }, { status: 500 });
  }
}
