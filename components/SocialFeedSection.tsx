"use client";

import { useEffect, useState } from "react";
import { getSocialFeedAction, likeActivityAction } from "@/lib/actions/social";
import type { FeedItem } from "@/lib/types";

export default function SocialFeedSection() {
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSocialFeedAction()
      .then((res) => {
        if (cancelled) return;
        if (!("error" in res)) setFeed(res.feed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function like(feedId: number) {
    await likeActivityAction(feedId).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  if (feed === null) return null;
  if (feed.length === 0) {
    return (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold mb-3">📰 Beranda Aktivitas Teman</h2>
        <p className="text-sm text-slate-400">Belum ada aktivitas baru dari teman yang Anda ikuti.</p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-3">📰 Beranda Aktivitas Teman</h2>
      <div className="space-y-3">
        {feed.map((f) => (
          <div key={f.id} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <span className="w-9 h-9 rounded-full bg-teal-500/10 flex items-center justify-center text-lg shrink-0">{f.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-bold">{f.full_name}</span> <span className="text-slate-500">{f.content}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{f.created_at}</p>
            </div>
            <button
              type="button"
              disabled={f.has_liked}
              onClick={() => like(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                f.has_liked ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 cursor-default" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              {f.has_liked ? `🎉 ${f.likes_count}` : `Kasih Selamat 🎉${f.likes_count > 0 ? ` ${f.likes_count}` : ""}`}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
