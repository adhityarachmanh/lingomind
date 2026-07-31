"use client";

import { useSyncExternalStore } from "react";

const THEME_KEY = "lingomind_theme";

function getTheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  return getTheme() === "dark";
}

function getServerSnapshot(): boolean {
  return false;
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-base"
      aria-label="Ganti tema"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
