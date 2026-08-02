"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { checkAdminRoleAction } from "@/lib/actions/admin";

export default function AdminLoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (state.message === "ok") {
      checkAdminRoleAction().then((r) => {
        if ("isAdmin" in r && r.isAdmin) {
          router.push("/admin/konfigurasi");
        } else {
          setRoleError("Akses ditolak. Anda bukan admin.");
        }
      });
    }
  }, [state, router]);

  const errorMsg = state.error?.replace("UNVERIFIED:", "");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-700 text-center">
        <p className="text-2xl font-black">Admin Portal</p>
        <p className="text-xs text-slate-400 mt-1">Secure Access Control</p>
        {roleError && <p className="mt-4 p-3 bg-rose-900/30 border border-rose-700 rounded-lg text-rose-400 text-xs font-semibold">{roleError}</p>}
        {!roleError && errorMsg && (
          <p className="mt-4 p-3 bg-rose-900/30 border border-rose-700 rounded-lg text-rose-400 text-xs font-semibold">{errorMsg}</p>
        )}
        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lingomind.com" disabled={pending}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-bold py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm">
            {pending ? "Memproses..." : "Secure Login"}
          </button>
        </form>
        <Link href="/login" className="inline-block mt-5 text-xs text-slate-400 hover:underline">Kembali ke Aplikasi Utama</Link>
      </div>
    </div>
  );
}
