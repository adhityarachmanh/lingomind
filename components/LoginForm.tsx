"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { loginAction, resendVerificationAction } from "@/lib/actions/auth";

export default function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);

  const isUnverified = state.error?.startsWith("UNVERIFIED:");
  const errorMsg = state.error?.replace("UNVERIFIED:", "");

  useEffect(() => {
    if (state.message === "ok") router.push("/dashboard");
  }, [state, router]);

  async function handleResend() {
    setResendPending(true);
    const res = await resendVerificationAction(email);
    setResendMsg(res.message ?? `Gagal: ${res.error ?? "terjadi kesalahan"}`);
    setResendPending(false);
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800" />
        <h2 className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2">Welcome Back</h2>
        <p className="text-slate-500/30 dark:text-slate-400 text-sm mb-6 font-medium">Learn English & German powered by Gemini AI</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex flex-col gap-2">
            <div className="flex items-center gap-2">⚠️ {errorMsg}</div>
            {isUnverified && (
              <button type="button" onClick={handleResend} disabled={resendPending}
                className="mt-1 self-start text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:underline bg-transparent border-none cursor-pointer p-0">
                {resendPending ? "Mengirim..." : "Kirim ulang email verifikasi"}
              </button>
            )}
          </div>
        )}

        {resendMsg && (
          <div className="mb-4 p-3 bg-teal-50/30 dark:bg-teal-900/30 border border-teal-200 rounded-lg text-teal-700 dark:text-teal-400 text-xs text-left font-semibold flex items-center gap-2">📩 {resendMsg}</div>
        )}

        <form action={formAction} className="text-left">
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email Anda..." disabled={pending}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline">Lupa Password?</Link>
            </div>
            <div className="relative flex items-center">
              <input type={showPassword ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..." disabled={pending}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={pending}
                className="absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors">
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={pending}
            className={`w-full font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 ${
              pending ? "bg-teal-100 text-teal-800 cursor-not-allowed opacity-80" : "bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30"}`}>
            {pending ? (
              <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" /> Memverifikasi Akun...</span>
            ) : (
              <span>Masuk ke Aplikasi 🚀</span>
            )}
          </button>
        </form>

        <div className="text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
          Belum punya akun?{" "}
          <Link href="/register" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Daftar sekarang</Link>
        </div>
      </div>
    </div>
  );
}
