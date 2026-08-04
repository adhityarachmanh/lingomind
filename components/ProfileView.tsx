"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { equipColorAction, equipFrameAction, equipTitleAction, getPublicProfileAction } from "@/lib/actions/profile";
import type { PublicProfile } from "@/lib/types";

const FRAME_CLASS: Record<string, string> = {
  mythic: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white border-4 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.7)] animate-pulse",
  diamond: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-cyan-100 text-cyan-800 border-4 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]",
  gold: "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-yellow-500 text-slate-900 border-4 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]",
};

const FRAME_BADGE: Record<string, string> = {
  mythic: "MYTHIC",
  diamond: "DIAMOND",
  gold: "VIP",
};

const NAME_COLOR_CLASS: Record<string, string> = {
  gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] font-black",
  crimson: "text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] font-black",
  neon_blue: "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] font-black",
};

const TITLE_BADGE: Record<string, { label: string; className: string }> = {
  polyglot: { label: "🎓 Polyglot", className: "px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold" },
  sultan: { label: "👑 Sultan", className: "px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[11px] font-bold" },
  legend: { label: "🌟 Legend", className: "px-2 py-0.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-bold" },
};

export default function ProfileView({ email, isOwn }: { email: string; isOwn: boolean }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProfileAction(email)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setProfile(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat profil.");
      });
    return () => {
      cancelled = true;
    };
  }, [email, reloadKey]);

  async function equip(action: (v: string) => Promise<{ error?: string; message?: string }>, value: string) {
    setStatus(null);
    const res = await action(value).catch(() => ({ error: "Gagal menyimpan." }));
    if (res.error) {
      setError(res.error);
      return;
    }
    setStatus("Kosmetik diperbarui!");
    setReloadKey((k) => k + 1);
  }

  if (error && !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Profil Tidak Ditemukan</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link href="/dashboard" className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Kembali ke Dashboard</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const frameClass = FRAME_CLASS[profile.active_frame ?? ""] ?? "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold bg-indigo-600 text-white";
  const nameColor = NAME_COLOR_CLASS[profile.active_name_color ?? ""] ?? "text-slate-700 dark:text-slate-300";
  const title = profile.active_title ? TITLE_BADGE[profile.active_title] : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {status && <div className="mb-4 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">{status}</div>}
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm">{error}</div>}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card text-center">
        <div className="flex flex-col items-center">
          <div className={frameClass}>
            {(profile.full_name || "?").charAt(0).toUpperCase()}
          </div>
          {FRAME_BADGE[profile.active_frame ?? ""] && (
            <span className="mt-2 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black tracking-wider">
              {FRAME_BADGE[profile.active_frame ?? ""]}
            </span>
          )}
          <h1 className={`text-2xl font-extrabold mt-3 ${nameColor}`}>{profile.full_name}</h1>
          {title && <span className={`mt-1 ${title.className}`}>{title.label}</span>}
          <p className="text-xs text-slate-400 mt-1">{profile.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl bg-indigo-500/10 p-3">
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{profile.score}</p>
            <p className="text-[11px] font-bold text-slate-400">Total Skor</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 p-3">
            <p className="text-xl font-black text-orange-500">🔥 {profile.current_streak}</p>
            <p className="text-[11px] font-bold text-slate-400">Streak</p>
          </div>
          <div className="rounded-xl bg-yellow-500/10 p-3">
            <p className="text-xl font-black text-yellow-500">👑 {profile.longest_streak}</p>
            <p className="text-[11px] font-bold text-slate-400">Max Streak</p>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
        <h2 className="text-lg font-extrabold mb-3">🏅 Lencana yang Diraih</h2>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-slate-400">Pengguna ini belum mengumpulkan lencana apapun.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.badges.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <span className="text-2xl">{b.icon_name}</span>
                <div>
                  <p className="font-bold text-sm">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwn && (
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
        >
          🎨 Ganti Kosmetik
        </button>
      )}

      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setGalleryOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-4">Galeri Kosmetik</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🖼️ Bingkai</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {["", ...profile.owned_frames].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => equip(equipFrameAction, f)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_frame === f ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400" : "border-slate-300"}`}
                >
                  {profile.active_frame === f ? "Dipakai" : "Pakai"} — {f === "" ? "Bawaan (Default)" : f === "gold" ? "VIP Gold" : f === "diamond" ? "Diamond 💎" : "Mythic 🌌"}
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">🏅 Gelar</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {["", ...profile.owned_titles].map((key) => {
                const t = key === "" ? null : TITLE_BADGE[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => equip(equipTitleAction, key)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_title === key ? "border-teal-500 bg-teal-500/10" : "border-slate-300"}`}
                  >
                    {profile.active_title === key ? "Dipakai" : "Pakai"} — {key === "" ? "Tanpa Gelar" : t?.label ?? key}
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">✨ Warna Nama</p>
            <div className="flex flex-wrap gap-2">
              {["", ...profile.owned_colors].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => equip(equipColorAction, key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${profile.active_name_color === key ? "border-teal-500 bg-teal-500/10" : "border-slate-300"}`}
                >
                  {profile.active_name_color === key ? "Dipakai" : "Pakai"} — {key === "" ? "Bawaan" : key === "gold" ? "✨ Gold" : key === "crimson" ? "🔥 Crimson" : "⚡ Neon Blue"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setGalleryOpen(false)} className="mt-6 w-full text-xs text-slate-400 hover:text-slate-600">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
