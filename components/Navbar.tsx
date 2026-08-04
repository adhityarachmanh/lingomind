"use client";

import Image from "next/image";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { logoutAction } from "@/lib/actions/auth";

interface NavbarProps {
  full_name: string;
  score: number;
  email: string;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/roadmap", label: "Kurikulum" },
  { href: "/vocabulary", label: "Kosakata" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/analytics", label: "Analisis" },
  { href: "/shop", label: "Toko" },
  { href: "/guide", label: "Panduan" },
];

export default function Navbar({ full_name, score, email }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const tabClass = (active: boolean) =>
    active
      ? "text-teal-600 dark:text-teal-400 font-bold transition-colors"
      : "text-slate-600/50 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 font-bold transition-colors";

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Image src="/logo.png" alt="LingoMind Logo" width={32} height={32} className="w-8 h-8 rounded-xl shadow-card object-cover border border-slate-100 dark:border-slate-800"  />
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">LingoMind</span>
          </Link>

          {/* navigasi desktop */}
          <nav className="hidden md:flex items-center gap-4">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={tabClass(pathname === l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 shadow-card items-center gap-1">
              <span>🔥</span>
              <span>{score} pts</span>
            </div>
            <ThemeToggle />
            <Link
              href={`/profile/${encodeURIComponent(email)}`}
              className="w-8 h-8 rounded-full bg-teal-500 text-white text-xs font-black flex items-center justify-center hover:opacity-90 transition-opacity"
              title={full_name}
            >
              {(full_name || "?").charAt(0).toUpperCase()}
            </Link>
            {/* hamburger mobile */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
              className="md:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
            <form action={logoutAction} className="hidden md:block">
              <button type="submit" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* drawer mobile */}
      {menuOpen && (
        <nav className="md:hidden border-t border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-card">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  pathname === l.href
                    ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 shadow-card flex items-center gap-1">
                <span>🔥</span>
                <span>{score} pts</span>
              </span>
              <form action={logoutAction}>
                <button type="submit" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                  Keluar
                </button>
              </form>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
