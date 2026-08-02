"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getUsersAdminAction, resetUserProgressAdminAction,
  updateUserRoleAdminAction, updateUserStatsAdminAction,
} from "@/lib/actions/admin";
import { Modal, ModalFooter } from "./ui";

interface UserRow {
  email: string; full_name: string; role: string | null; is_verified: boolean | null;
  score: number; coins: number; streak_days: number;
}

export default function AdminUsersPanel({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [coins, setCoins] = useState("");
  const [streak, setStreak] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUsersAdminAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setUsers(res.users);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat data pengguna.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  function openEdit(u: UserRow) {
    setEditing(u);
    setCoins(String(u.coins));
    setStreak(String(u.streak_days));
  }

  async function saveStats() {
    if (!editing) return;
    setStatus(null);
    const toNum = (v: string, fallback: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
    const res = await updateUserStatsAdminAction({
      email: editing.email,
      coins: toNum(coins, editing.coins),
      streak: toNum(streak, editing.streak_days),
    }).catch(() => ({ error: "Gagal menyimpan." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus(`Statistik ${editing.email} diperbarui!`);
    setEditing(null);
    setReloadKey((k) => k + 1);
  }

  async function reset(u: UserRow) {
    if (u.email === adminEmail) { setError("Tidak bisa mereset akun sendiri."); return; }
    if (!window.confirm("Yakin ingin mereset seluruh progress pengguna ini?")) return;
    setStatus(null);
    const res = await resetUserProgressAdminAction(u.email).catch(() => ({ error: "Gagal mereset." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus(`Progres ${u.email} direset!`);
    setReloadKey((k) => k + 1);
  }

  async function toggleRole(u: UserRow) {
    if (u.email === adminEmail) { setError("Tidak bisa mengubah akun admin sendiri."); return; }
    const isAdmin = u.role === "admin";
    setStatus(null);
    const res = await updateUserRoleAdminAction({ email: u.email, role: isAdmin ? "user" : "admin" }).catch(() => ({ error: "Gagal mengubah peran." }));
    if ("error" in res) { setError(res.error); return; }
    setStatus(`Peran ${u.email} diubah!`);
    setReloadKey((k) => k + 1);
  }

  if (error && !users) {
    return (
      <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">
        {error}
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="ml-2 text-xs font-bold underline">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!users || !filtered) {
    return <div className="text-sm text-slate-400">Memuat Data Pengguna...</div>;
  }

  return (
    <div className="space-y-6">
      {status && <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">{error}</div>}

      <section className="bg-white rounded-lg p-5 border border-slate-200">
        <h2 className="text-base font-bold text-slate-900 mb-4">👥 Manajemen Pengguna</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari email atau nama..."
          className="w-full mb-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50">
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">Nama</th>
                <th className="text-left py-2 px-3">Role</th>
                <th className="text-left py-2 px-3">Verified</th>
                <th className="text-left py-2 px-3">Score</th>
                <th className="text-left py-2 px-3">Koin</th>
                <th className="text-left py-2 px-3">Streak</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-sm">Tidak ada pengguna yang cocok.</td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.email} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="py-2 px-3 font-bold">{u.email}</td>
                  <td className="py-2 px-3">{u.full_name || "—"}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                      {u.role ?? "user"}
                    </span>
                  </td>
                  <td className="py-2 px-3">{u.is_verified ? "✅" : "❌"}</td>
                  <td className="py-2 px-3">{u.score}</td>
                  <td className="py-2 px-3">{u.coins}</td>
                  <td className="py-2 px-3">{u.streak_days}</td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(u)} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold">
                        Edit Stats
                      </button>
                      <button type="button" onClick={() => reset(u)} className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold">
                        Reset
                      </button>
                      <button type="button" onClick={() => toggleRole(u)} className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-semibold">
                        {u.role === "admin" ? "Cabut Admin" : "Jadikan Admin"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <Modal title="Edit Statistik Pengguna" onClose={() => setEditing(null)}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
          <input value={editing.email} disabled className="w-full bg-slate-100 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 disabled:opacity-60" />
          <div className="mt-4 mb-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Koin</label>
            <input type="number" value={coins} onChange={(e) => setCoins(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Streak</label>
            <input type="number" value={streak} onChange={(e) => setStreak(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <ModalFooter onCancel={() => setEditing(null)} onSave={saveStats} />
        </Modal>
      )}
    </div>
  );
}
