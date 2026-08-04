"use client";

import { redirectIfSessionExpired } from "./sessionGuard";

import { useEffect, useState } from "react";
import { createBattleAction, getLeaderboardSummaryAction, searchUsersAction, toggleFollowAction } from "@/lib/actions/leaderboard";
import type { LeaderboardRow, LeagueMemberRow, SearchUserRow } from "@/lib/types";

const DIVISION_HEADER: Record<string, string> = {
  Bronze: "🥉 Liga Perunggu",
  Silver: "🥈 Liga Perak",
  Gold: "🥇 Liga Emas",
  Diamond: "💎 Liga Berlian",
};

const NAME_COLOR_CLASS: Record<string, string> = {
  gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 font-black",
  crimson: "text-rose-600 font-black",
  neon_blue: "text-cyan-400 font-black",
};

const TITLE_BADGE: Record<string, string> = {
  polyglot: "🎓 Polyglot",
  sultan: "👑 Sultan",
  legend: "🌟 Legend",
};

type Tab = "liga" | "global" | "teman" | "cari";

export default function LeaderboardView({ myEmail }: { myEmail: string }) {
  const [tab, setTab] = useState<Tab>("liga");
  const [weekly, setWeekly] = useState<{ division: string; daysLeft: number; members: LeagueMemberRow[] } | null>(null);
  const [global, setGlobal] = useState<LeaderboardRow[]>([]);
  const [following, setFollowing] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserRow[] | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [challengeGoal, setChallengeGoal] = useState("");
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [challengePending, setChallengePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLeaderboardSummaryAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { redirectIfSessionExpired(res.error);
          setError(res.error);
          return;
        }
        setWeekly(res.weekly);
        setGlobal(res.global);
        setFollowing(res.following);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat leaderboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function doSearch() {
    setSearchMsg(null);
    if (searchQuery.trim().length < 3) {
      setSearchResults(null);
      setSearchMsg("Ketik minimal 3 huruf...");
      return;
    }
    const res = await searchUsersAction(searchQuery).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal mencari." }));
    if ("error" in res) { redirectIfSessionExpired(res.error);
      setSearchResults(null);
      setSearchMsg(res.error);
      return;
    }
    setSearchResults(res.users);
    if (res.users.length === 0) setSearchMsg("Tidak ditemukan.");
  }

  async function toggleFollow(email: string, follow: boolean) {
    await toggleFollowAction(email, follow).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  async function sendChallenge() {
    if (!challengeTarget) return;
    const goal = challengeGoal.trim();
    if (!goal) {
      setChallengeStatus("Topik kuis tidak boleh kosong!");
      return;
    }
    setChallengePending(true);
    setChallengeStatus("Mengirim tantangan...");
    const res = await createBattleAction(challengeTarget, goal).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal mengirim." }));
    setChallengePending(false);
    if ("error" in res) { redirectIfSessionExpired(res.error);
      setChallengeStatus(`Gagal: ${res.error}`);
      return;
    }
    setChallengeStatus(res.message ?? "Tantangan berhasil dikirim! Tutup jendela ini.");
  }

  if (error && !weekly && global.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Peringkat</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Coba Lagi</button>
      </div>
    );
  }

  if (!weekly && global.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const nameClass = (row: { active_name_color: string | null }) => NAME_COLOR_CLASS[row.active_name_color ?? ""] ?? "text-slate-700 dark:text-slate-300";
  const titleBadge = (row: { active_title: string | null }) => (row.active_title ? TITLE_BADGE[row.active_title] ?? "" : "");

  const renderGlobalRow = (row: LeaderboardRow, isFriend: boolean) => (
    <div key={row.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
      <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{row.rank}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${nameClass(row)}`}>{row.full_name}</p>
        <p className="text-[11px] text-slate-400">🔥 {row.current_streak} · {row.score} pts</p>
      </div>
      {titleBadge(row) && <span className="text-[11px] font-bold text-slate-500">{titleBadge(row)}</span>}
      {isFriend && row.email !== myEmail && (
        <button
          type="button"
          onClick={() => setChallengeTarget(row.email)}
          className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-colors"
        >
          ⚔️ Tantang
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-xl p-6 text-white mb-6 shadow-md">
        <h1 className="text-2xl font-extrabold">🏆 Papan Peringkat</h1>
        <p className="text-sm mt-1">Pantau progresmu dan tantang temanmu!</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["liga", "global", "teman", "cari"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              tab === t ? "bg-teal-500 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
            }`}
          >
            {t === "liga" ? "🛡️ Liga Mingguan" : t === "global" ? "🌍 Global" : t === "teman" ? "👥 Teman" : "🔍 Cari"}
          </button>
        ))}
      </div>

      {tab === "liga" && (
        <div>
          <p className="text-lg font-extrabold mb-1">{DIVISION_HEADER[weekly?.division ?? ""] ?? "Liga"}</p>
          <p className="text-xs text-slate-400 mb-4">Sisa {weekly?.daysLeft ?? 0} hari lagi minggu ini!</p>
          <div className="space-y-2">
            {(weekly?.members ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Data liga belum tersedia.</p>
            ) : (
              weekly?.members.map((m) => (
                <div key={m.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                    m.zone === "promosi" ? "text-emerald-600 bg-emerald-100" : m.zone === "degradasi" ? "text-rose-600 bg-rose-100" : "text-slate-500 bg-slate-100"
                  }`}>{m.rank}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${m.email === myEmail ? "text-amber-700" : nameClass(m)}`}>
                      {m.full_name} {m.email === myEmail && <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">Anda</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{m.active_title ? `${TITLE_BADGE[m.active_title] ?? ""} ` : ""}{m.league_score} pts</p>
                  </div>
                  {m.zone === "promosi" && <span className="text-[11px] font-bold text-emerald-600">⬆ Promosi</span>}
                  {m.zone === "degradasi" && <span className="text-[11px] font-bold text-rose-600">⬇ Degradasi</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "global" && <div className="space-y-2">{global.map((r) => renderGlobalRow(r, false))}</div>}

      {tab === "teman" && (
        <div className="space-y-2">
          {following.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Anda belum mengikuti siapa pun.</p>
              <button type="button" onClick={() => setTab("cari")} className="mt-3 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">
                Cari Teman
              </button>
            </div>
          ) : (
            following.map((r) => renderGlobalRow(r, true))
          )}
        </div>
      )}

      {tab === "cari" && (
        <div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            placeholder="Cari nama atau email teman..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <button type="button" onClick={doSearch} className="mt-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold">Cari</button>
          {searchMsg && <p className="text-xs text-slate-400 mt-2">{searchMsg}</p>}
          <div className="space-y-2 mt-4">
            {searchResults?.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center justify-center shrink-0">{u.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{u.full_name}</p>
                  <p className="text-[11px] text-slate-400">🔥 {u.current_streak} · {u.score} pts</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFollow(u.email, !u.is_following)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    u.is_following ? "bg-slate-100 dark:bg-slate-800 text-slate-500" : "bg-teal-500 hover:bg-teal-600 text-white"
                  }`}
                >
                  {u.is_following ? "Unfollow" : "Follow"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {challengeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setChallengeTarget(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">⚔️ Tantang Teman</h3>
            <p className="text-xs text-slate-400 mb-4">Pilih topik kuis yang ingin Anda ujikan. Siapa yang paling tinggi skornya, dia yang dapat Koin!</p>
            <input
              value={challengeGoal}
              onChange={(e) => setChallengeGoal(e.target.value)}
              placeholder="Contoh: Past Tense, Passive Voice..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {challengeStatus && <p className="text-xs mt-3 text-teal-600 dark:text-teal-400 font-semibold">{challengeStatus}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" disabled={challengePending} onClick={sendChallenge} className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-bold">
                {challengePending ? "Mengirim..." : "Kirim Tantangan"}
              </button>
              <button type="button" onClick={() => { setChallengeTarget(null); setChallengeStatus(null); setChallengeGoal(""); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
