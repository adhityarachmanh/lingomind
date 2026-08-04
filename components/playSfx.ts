"use client";

type SfxName = "correct" | "wrong" | "winner";

let initialized = false;
let pending: SfxName | null = null;

function tryPlay(name: SfxName) {
  try {
    const audio = new Audio(`/${name}.mp3`);
    audio.volume = 0.6;
    const playResult = audio.play();
    if (playResult !== undefined) {
      playResult.catch((e: unknown) => {
        const errName = e instanceof DOMException ? e.name : String(e);
        if (errName === "NotAllowedError") {
          // autoplay policy browser memblokir (mis. dipanggil setelah await) —
          // antri dan mainkan saat interaksi user berikutnya.
          pending = name;
        } else {
          console.warn(`playSfx "${name}" gagal: ${errName}`);
        }
      });
    }
  } catch (e) {
    console.warn(`playSfx "${name}" gagal:`, e);
  }
}

export function playSfx(name: SfxName) {
  if (typeof window === "undefined") return;
  if (!initialized) {
    initialized = true;
    document.addEventListener("pointerdown", () => {
      if (pending) {
        const n = pending;
        pending = null;
        tryPlay(n);
      }
    });
  }
  tryPlay(name);
}
