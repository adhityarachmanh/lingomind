"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/password";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleValidate(e: React.FormEvent<HTMLFormElement>) {
    if (!password || !confirmPassword) {
      e.preventDefault();
      setErrorMsg("Kata sandi baru tidak boleh kosong!");
      return;
    }
    if (password.length < 6) {
      e.preventDefault();
      setErrorMsg("Kata sandi baru minimal harus berukuran 6 karakter!");
      return;
    }
    if (password !== confirmPassword) {
      e.preventDefault();
      setErrorMsg("Konfirmasi kata sandi tidak cocok!");
      return;
    }
    setErrorMsg(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800" />
        <h2 className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2">Reset Password</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">Masukkan kata sandi baru Anda di bawah ini.</p>

        {state.message ? (
          <div className="py-2">
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-teal-900/30 border border-emerald-200 dark:border-teal-700 rounded-lg text-emerald-600 dark:text-teal-400 text-xs text-left font-semibold flex items-start gap-2">
              <span className="shrink-0">✅</span>
              <span>{state.message}</span>
            </div>
            <Link href="/login" className="block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-md hover:shadow-lg hover:shadow-teal-500/30">
              Login dengan Password Baru 🚀
            </Link>
          </div>
        ) : (
          <>
            <form action={formAction} onSubmit={handleValidate} className="text-left">
              <input type="hidden" name="token" value={token} />

              {(errorMsg || state.error) && (
                <div className="mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex items-start gap-2">
                  <span className="shrink-0">⚠️</span>
                  <span>{errorMsg ?? state.error}</span>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Kata Sandi Baru</label>
                <div className="relative flex items-center">
                  <input type={showPassword ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Buat password baru..." disabled={pending}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={pending}
                    className="absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors">
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Konfirmasi Kata Sandi</label>
                <input type={showPassword ? "text" : "password"} name="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru..." disabled={pending}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
              </div>

              <button type="submit" disabled={pending}
                className={`w-full font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 ${
                  pending ? "bg-teal-100 text-teal-800 cursor-not-allowed opacity-80" : "bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30"}`}>
                {pending ? (
                  <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" /> Memperbarui Password...</span>
                ) : (
                  <span>Reset Password Sekarang 🚀</span>
                )}
              </button>
            </form>

            <div className="text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
              <Link href="/login" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Kembali ke Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
