"use client";

import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

interface Props { full_name: string; }

export default function Navbar({ full_name }: Props) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-sm flex items-center">
      <div className="max-w-4xl mx-auto w-full px-4 flex items-center justify-between">
        <Link href="/chat" className="flex items-center gap-2">
          <span className="text-lg font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">LingoMind</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">{full_name}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">Keluar</button>
          </form>
        </div>
      </div>
    </header>
  );
}
