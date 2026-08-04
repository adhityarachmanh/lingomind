"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, resendVerificationAction } from "@/lib/actions/auth";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function resend() {
    setResendMsg(null);
    const res = await resendVerificationAction(email);
    setResendMsg(res.error ?? res.message ?? null);
  }

  const successMsg = state.message ?? null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-center items-center p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800" />
        <p className="text-2xl font-black">Buat Akun Baru</p>
        <p className="text-xs text-slate-400 mt-1">Mulai belajar bahasa dengan AI</p>

        {state.error && (
          <div className="mt-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold">{state.error}</div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-teal-50/30 dark:bg-teal-900/30 border border-teal-200 rounded-lg text-teal-700 dark:text-teal-400 text-xs text-left font-semibold">
            {successMsg}
            <button type="button" onClick={resend} className="ml-2 underline font-bold text-teal-600 hover:text-teal-800">
              Kirim Ulang
            </button>
            {resendMsg && <p className="mt-1 text-[11px] text-teal-500">{resendMsg}</p>}
          </div>
        )}

        <form action={formAction} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
            <input name="full_name" value={name} onChange={(e) => setName(e.target.value)} disabled={pending}
              placeholder="John Doe"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending}
              placeholder="email@lingomind.com"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
          </div>
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input type={show ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              placeholder="Minimal 6 karakter"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
            <button type="button" onClick={() => setShow((v) => !v)}
              className="absolute top-8 right-0 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors">
              {show ? "HIDE" : "SHOW"}
            </button>
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-bold py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm shadow-md">
            {pending ? "Mendaftarkan..." : "Daftar Gratis"}
          </button>
        </form>
        <p className="mt-5 text-xs text-slate-400">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-teal-600 hover:underline font-bold">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
