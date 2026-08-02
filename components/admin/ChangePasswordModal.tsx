"use client";

import { useEffect, useState } from "react";
import { changeAdminPasswordAction } from "@/lib/actions/admin";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("Password lama dan baru wajib diisi!");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok dengan password utama!");
      return;
    }
    setPending(true);
    try {
      const res = await changeAdminPasswordAction({ currentPassword, newPassword });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSuccess("Password berhasil diganti!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Gagal mengganti password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ganti Password"
        className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md shadow-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-bold text-slate-900">🔑 Ganti Password</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
        </div>
        {error && (
          <p className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-600 text-xs font-semibold">{error}</p>
        )}
        {success && (
          <p className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-600 text-xs font-semibold">{success}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password Lama</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={pending}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password Baru</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={pending}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Konfirmasi Password Baru</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={pending}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
              {pending ? "Memproses..." : "Simpan"}
            </button>
            <button type="button" onClick={onClose} disabled={pending}
              className="px-4 py-2 rounded-md border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50">
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
