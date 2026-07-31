"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";

export default function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, {});
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleValidate(e: React.FormEvent<HTMLFormElement>) {
    const trimmed = fullName.trim();
    if (!trimmed || !email.trim() || !password || !confirmPassword) {
      e.preventDefault();
      setErrorMsg("Seluruh kolom input wajib diisi!");
      return;
    }
    if (password.length < 6) {
      e.preventDefault();
      setErrorMsg("Password minimal harus berukuran 6 karakter!");
      return;
    }
    if (password !== confirmPassword) {
      e.preventDefault();
      setErrorMsg("Konfirmasi password tidak cocok dengan password utama!");
      return;
    }
    setErrorMsg(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-center items-center p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <img src="/logo.png" alt="LingoMind Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-md object-cover border border-slate-100/30 dark:border-slate-800" />
        <h2 className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mb-2">Join LingoMind</h2>
        <p className="text-slate-500/30 dark:text-slate-400 font-medium text-sm mb-6">Create an account to track your study scores</p>

        {state.message ? (
          <div className="py-6">
            <div className="w-16 h-16 bg-teal-100 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📩</div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Cek Email Anda</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{state.message}</p>
            <Link href="/login" className="block w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg">
              Kembali ke Halaman Login
            </Link>
          </div>
        ) : (
          <form action={formAction} onSubmit={handleValidate} className="text-left">
            {(errorMsg || state.error) && (
              <div className="mb-4 p-3 bg-rose-50/30 dark:bg-rose-900/30 border border-rose-200 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-left font-semibold flex items-center gap-2">
                ⚠️ {errorMsg ?? state.error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
              <input type="text" name="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap..." disabled={pending}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
              <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email aktif Anda..." disabled={pending}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative flex items-center">
                <input type={showPassword ? "text" : "password"} name="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Buat password aman..." disabled={pending}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={pending}
                  className="absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors">
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">Minimal panjang password adalah 6 karakter.</span>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative flex items-center">
                <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password..." disabled={pending}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl pl-4 pr-12 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={pending}
                  className="absolute right-4 text-slate-400 hover:text-teal-600 dark:text-teal-400 text-xs font-bold select-none bg-transparent border-none cursor-pointer disabled:opacity-30 transition-colors">
                  {showConfirmPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={pending}
              className={`w-full font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md flex justify-center items-center gap-2 ${
                pending ? "bg-teal-100 text-teal-800 cursor-not-allowed opacity-80" : "bg-teal-500 hover:bg-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30"}`}>
              {pending ? (
                <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent" /> Mendaftarkan Akun Baru...</span>
              ) : (
                <span>Buat Akun Baru 🎉</span>
              )}
            </button>
          </form>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Login di sini</Link>
        </div>
      </div>
    </div>
  );
}
