"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { logoutAction } from "@/lib/actions/auth";

interface NavbarProps {
  full_name: string;
  score: number;
  email: string;
}

export default function Navbar({ score }: NavbarProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const tabClass = (active: boolean) =>
    active
      ? "text-teal-600 dark:text-teal-400 font-bold transition-colors"
      : "text-slate-600/50 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 font-bold transition-colors";

  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="LingoMind Logo" className="w-8 h-8 rounded-xl shadow-sm object-cover border border-slate-100 dark:border-slate-800" />
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">LingoMind</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className={tabClass(isDashboard)}>Beranda</Link>
            <div className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/30 text-xs font-black text-amber-700 shadow-sm flex items-center gap-1">
              <span>🔥</span>
              <span>{score} pts</span>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <button type="submit" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
