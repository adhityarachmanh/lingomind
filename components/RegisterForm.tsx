"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 text-center">
        <p className="text-2xl font-black text-slate-900">LingoMind</p>
        <p className="text-xs text-slate-400 mt-1">Buat Akun Baru</p>
        {state.error && (
          <p className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-xs font-semibold">{state.error}</p>
        )}
        {state.message && (
          <p className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-700 text-xs font-semibold">{state.message}</p>
        )}
        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
            <input name="full_name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending}
              placeholder="Nama Anda"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending}
              placeholder="email@example.com"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              placeholder="Minimal 6 karakter"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-bold py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm">
            {pending ? "Memproses..." : "Daftar"}
          </button>
        </form>
        <Link href="/login" className="inline-block mt-5 text-xs text-teal-600 hover:underline font-semibold">Sudah punya akun? Masuk</Link>
      </div>
    </div>
  );
}
