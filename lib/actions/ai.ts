"use server";

import { generateText } from "ai";
import { getSession } from "../auth";
import { model } from "../ai";

export async function testAiAction(): Promise<{ ok: boolean; text?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi berakhir. Silakan login kembali." };

  try {
    const { text } = await generateText({
      model,
      prompt: "Balas dengan tepat satu kata: siap",
      maxOutputTokens: 1024,
    });
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi AI." };
  }
}
