"use client";

import { useEffect, useState } from "react";
import { buyItemAction, getShopAction } from "@/lib/actions/shop";
import type { ShopItem } from "@/lib/types";

type ItemWithOwned = ShopItem & { is_owned: boolean };

const COSMETIC_PREFIXES = ["profile_frame_", "title_", "name_color_"];

export default function ShopView() {
  const [items, setItems] = useState<ItemWithOwned[] | null>(null);
  const [coins, setCoins] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getShopAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setItems(res.items);
        setCoins(res.coins);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat toko.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function buy(item: ItemWithOwned) {
    if (item.is_owned || buyingId !== null) return;
    setBuyingId(item.id);
    setStatus(null);
    setError(null);
    const res = await buyItemAction(item.id).catch((e: unknown) => ({ error: e instanceof Error ? e.message : "Gagal membeli item." }));
    setBuyingId(null);
    if ("error" in res) {
      setError(res.error ?? "Gagal membeli item.");
      return;
    }
    setStatus(`✨ ${res.message}`);
    setReloadKey((k) => k + 1);
  }

  if (error && !items) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-2xl font-black">Gagal Memuat Toko</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const isCosmetic = (eff: string) => COSMETIC_PREFIXES.some((p) => eff.startsWith(p));
  const utilities = items.filter((i) => !isCosmetic(i.effect_type));
  const cosmetics = items.filter((i) => isCosmetic(i.effect_type));

  const renderCard = (item: ItemWithOwned) => {
    const canAfford = coins >= item.cost;
    const busy = buyingId === item.id;
    return (
      <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">{item.icon_name}</div>
          <div>
            <p className="font-bold text-sm">{item.name}</p>
            <p className="text-xs text-slate-400">🪙 {item.cost}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 flex-1">{item.description}</p>
        {item.is_owned ? (
          <button type="button" disabled className="w-full px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold cursor-not-allowed">
            Dimiliki
          </button>
        ) : canAfford ? (
          <button type="button" onClick={() => buy(item)} disabled={busy} className="w-full px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold disabled:opacity-60">
            {busy ? "Memproses..." : "Beli"}
          </button>
        ) : (
          <button type="button" disabled className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
            Koin Kurang
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-6 text-white mb-6 shadow-md">
        <h1 className="text-2xl font-extrabold">Toko LingoMind 🏪</h1>
        <p className="text-sm mt-1 font-bold">Saldo Koin: 🪙 {coins}</p>
      </div>

      {status && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm font-semibold">
          {error}
        </div>
      )}

      <h2 className="text-lg font-extrabold mb-3">🚑 Utilitas & Penyelamat Nyawa</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {utilities.map(renderCard)}
      </div>

      <h2 className="text-lg font-extrabold mb-3">🏆 Status & Gengsi (Kosmetik)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cosmetics.map(renderCard)}
      </div>
    </div>
  );
}
