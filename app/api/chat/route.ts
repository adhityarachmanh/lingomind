import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { model } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPolyglotStreamPrompt } from "@/lib/ai-content/chat";
import { mapHistoryToAiMessages } from "@/lib/chat-helpers";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  }

  let body: { sessionId?: string; text?: string };
  try {
    body = (await req.json()) as { sessionId?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const userMessage = body.text?.trim() ?? "";
  if (!userMessage) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
  }
  if (userMessage.length > 2000) return NextResponse.json({ error: "Pesan terlalu panjang." }, { status: 400 });
  if (!body.sessionId) {
    return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: session.email }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 401 });
  }

  const dbSession = await db.session.findFirst({
    where: { id: body.sessionId, userId: user.id },
    include: { scenario: { select: { title: true, language: true } } },
  });
  if (!dbSession) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const language = dbSession.scenario?.language ?? dbSession.language;
  const scenario = dbSession.scenario?.title ?? "Percakapan";

  const history = await db.message.findMany({
    where: { sessionId: dbSession.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const aiMessages = mapHistoryToAiMessages(history);

  const { instructions, messages } = buildPolyglotStreamPrompt(userMessage, language, "A1", scenario, aiMessages);

  await db.message.create({
    data: { sessionId: dbSession.id, role: "user", content: userMessage },
  });

  const result = streamText({
    model,
    instructions,
    messages,
    maxOutputTokens: 1024,
    temperature: 0.7,
  });
  return result.toTextStreamResponse();
}
