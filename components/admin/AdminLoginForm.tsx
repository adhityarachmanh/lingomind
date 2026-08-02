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
      checkAdminRoleAction()
        .then((r) => {
          if ("isAdmin" in r && r.isAdmin) {
            router.push("/admin/konfigurasi");
          } else {
            setRoleError("Akses ditolak. Anda bukan admin.");
          }
        })
        .catch(() => setRoleError("Gagal memeriksa hak akses."));
    }
  }, [state, router]);

  function handleSubmit(formData: FormData) {
    setRoleError(null);
    formAction(formData);
  }

  const errorMsg = state.error?.replace("UNVERIFIED:", "");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center items-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-xs max-w-md w-full border border-slate-200 text-center">
        <p className="text-xl font-bold text-slate-900">Admin Portal</p>
        <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Secure Access Control</p>
        {roleError && <p className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-600 text-xs font-semibold">{roleError}</p>}
        {!roleError && errorMsg && (
          <p className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-600 text-xs font-semibold">{errorMsg}</p>
        )}
        <form action={handleSubmit} className="text-left mt-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Admin Email</label>
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lingomind.com" disabled={pending}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Password</label>
            <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full font-semibold py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm">
            {pending ? "Memproses..." : "Secure Login"}
          </button>
        </form>
        <Link href="/login" className="inline-block mt-5 text-xs text-slate-500 hover:underline">Kembali ke Aplikasi Utama</Link>
      </div>
    </div>
  );
}
