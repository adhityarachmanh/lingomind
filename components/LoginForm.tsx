"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction } from "@/lib/actions/auth";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorMsg = (state.error ?? "").replace("UNVERIFIED:", "");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 text-center">
        <p className="text-2xl font-black text-slate-900">LingoMind</p>
        <p className="text-xs text-slate-400 mt-1">AI Language Tutor</p>
        {errorMsg && (
          <p className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-xs font-semibold">{errorMsg}</p>
        )}
        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending}
              placeholder="email@example.com"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-bold py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm">
            {pending ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <Link href="/register" className="inline-block mt-5 text-xs text-teal-600 hover:underline font-semibold">Belum punya akun? Daftar</Link>
      </div>
    </div>
  );
}
