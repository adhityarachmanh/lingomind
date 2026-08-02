"use client";

export function playSfx(name: "correct" | "wrong" | "winner") {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(`/${name}.mp3`);
    audio.volume = 0.6;
    void audio.play().catch(() => {});
  } catch {
    /* noop */
  }
}
