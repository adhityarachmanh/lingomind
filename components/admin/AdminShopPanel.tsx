"use client";

import { useEffect, useState } from "react";
import {
  createShopItemAdminAction, getShopItemsAdminAction, updateShopItemAdminAction,
} from "@/lib/actions/admin";
import { Modal, ModalFooter } from "./ui";

interface ShopItemRow {
  id: number; name: string; description: string | null;
  cost: number; effect_type: string; icon_name: string | null;
}

interface ShopForm {
  name: string; cost: string; effect_type: string; description: string; icon_name: string;
}

const emptyForm: ShopForm = { name: "", cost: "10", effect_type: "", description: "", icon_name: "🎁" };

export default function AdminShopPanel() {
  const [items, setItems] = useState<ShopItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<ShopItemRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ShopForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    getShopItemsAdminAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setItems(res.items);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat item toko.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  }

  function openEdit(item: ShopItemRow) {
    setCreating(false);
    setEditing(item);
    setForm({
      name: item.name,
      cost: String(item.cost),
      effect_type: item.effect_type,
      description: item.description ?? "",
      icon_name: item.icon_name ?? "🎁",
    });
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  async function save() {
    if (!creating && !editing) return;
    setStatus(null);
    const cost = parseInt(form.cost, 10);
    const input = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      cost: Number.isFinite(cost) ? cost : 10,
      effect_type: form.effect_type.trim(),
      icon_name: form.icon_name.trim() || null,
    };
    if (creating) {
      const res = await createShopItemAdminAction(input).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Item ditambahkan!");
    } else if (editing) {
      const res = await updateShopItemAdminAction({ id: editing.id, ...input }).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Item diperbarui!");
    } else {
      return;
    }
    closeModal();
    setReloadKey((k) => k + 1);
  }

  if (error && !items) {
    return (
      <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm">
        {error}
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="ml-2 text-xs font-bold underline">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!items) {
    return <div className="text-sm text-slate-400">Memuat item toko...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">🛒 Katalog Toko</h2>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
        >
          Tambah Item
        </button>
      </div>

      {status && <div className="px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/40 text-teal-700 dark:text-teal-400 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-sm">{error}</div>}

      <section className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3">Ikon</th>
                <th className="text-left py-2 px-3">Nama</th>
                <th className="text-left py-2 px-3">Harga</th>
                <th className="text-left py-2 px-3">Tipe Efek</th>
                <th className="text-left py-2 px-3">Deskripsi</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-3 text-xl">{item.icon_name ?? "🎁"}</td>
                  <td className="py-2 px-3 font-bold">{item.name}</td>
                  <td className="py-2 px-3">🪙 {item.cost}</td>
                  <td className="py-2 px-3">{item.effect_type}</td>
                  <td className="py-2 px-3 text-xs text-slate-400">{item.description}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => openEdit(item)} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Belum ada item toko.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(creating || editing) && (
        <Modal title={editing ? "Edit Item Toko" : "Tambah Item Toko"} onClose={closeModal}>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ikon</label>
          <input value={form.icon_name} onChange={(e) => setForm((f) => ({ ...f, icon_name: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Harga (Koin)</label>
          <input type="number" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Nama</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Tipe Efek</label>
          <input value={form.effect_type} onChange={(e) => setForm((f) => ({ ...f, effect_type: e.target.value }))} placeholder="e.g. shield, streak_freeze, double_xp" className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Deskripsi</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none" />
          <ModalFooter onCancel={closeModal} onSave={save} disabled={form.name.trim().length === 0} />
        </Modal>
      )}
    </div>
  );
}
