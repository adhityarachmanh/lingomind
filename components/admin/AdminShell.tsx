"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import ChangePasswordModal from "./ChangePasswordModal";

export interface AdminTab { key: string; label: string; icon: string; }

export default function AdminShell({ tabs, children }: { tabs: AdminTab[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const active = pathname.split("/")[2] ?? "konfigurasi";
  const activeTab = tabs.find((t) => t.key === active);

  async function logout() {
    await logoutAction();
    router.push("/admin/login");
  }

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6">
          <p className="text-xl font-black">LingoAdmin</p>
          <p className="text-[11px] text-slate-400">Enterprise</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/${t.key}`}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                active === t.key ? "bg-indigo-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="p-6 text-[11px] text-slate-400">LingoMind v1.0.0</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between px-6">
          <h1 className="font-extrabold">{activeTab?.label ?? "Admin"}</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-teal-600">Aplikasi Utama</Link>
            <button type="button" onClick={() => setShowPasswordModal(true)} className="text-xs font-bold text-slate-400 hover:text-teal-600">🔑 Ganti Password</button>
            <button type="button" onClick={logout} className="text-xs font-bold text-slate-400 hover:text-rose-500">Logout</button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
