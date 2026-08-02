"use client";

import { useEffect, useState } from "react";
import {
  createLanguageAdminAction, getLanguagesAdminAction, updateLanguageAdminAction,
} from "@/lib/actions/admin";
import type { AdminLanguageItem } from "@/lib/types";
import { Modal, ModalFooter } from "./ui";

interface LanguageForm {
  id: string; name: string; native_name: string; flag: string; category: string;
  tts_lang_code: string; edge_tts_voice: string; theme_class: string; button_class: string; description: string;
}

const emptyForm: LanguageForm = {
  id: "", name: "", native_name: "", flag: "🌐", category: "Eropa",
  tts_lang_code: "", edge_tts_voice: "", theme_class: "bg-indigo-500",
  button_class: "bg-indigo-600 hover:bg-indigo-700", description: "",
};

export default function AdminLanguagePanel() {
  const [languages, setLanguages] = useState<AdminLanguageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<AdminLanguageItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LanguageForm>(emptyForm);

  useEffect(() => {
    let cancelled = false;
    getLanguagesAdminAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setLanguages(res.languages);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat katalog bahasa.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  }

  function openEdit(lang: AdminLanguageItem) {
    setCreating(false);
    setEditing(lang);
    setForm({
      id: lang.id,
      name: lang.name,
      native_name: lang.native_name,
      flag: lang.flag || "🌐",
      category: lang.category || "Eropa",
      tts_lang_code: lang.tts_lang_code,
      edge_tts_voice: lang.edge_tts_voice ?? "",
      theme_class: lang.theme_class || "bg-indigo-500",
      button_class: lang.button_class || "bg-indigo-600 hover:bg-indigo-700",
      description: lang.description ?? "",
    });
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  async function save() {
    if (!creating && !editing) return;
    setStatus(null);
    const input: AdminLanguageItem = {
      id: form.id.trim(),
      name: form.name.trim(),
      native_name: form.native_name.trim(),
      flag: form.flag.trim() || "🌐",
      category: form.category.trim() || "Eropa",
      tts_lang_code: form.tts_lang_code.trim(),
      edge_tts_voice: form.edge_tts_voice.trim() || null,
      theme_class: form.theme_class.trim() || "bg-indigo-500",
      button_class: form.button_class.trim() || "bg-indigo-600 hover:bg-indigo-700",
      description: form.description.trim(),
    };
    if (creating) {
      const res = await createLanguageAdminAction(input).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Bahasa ditambahkan!");
    } else if (editing) {
      const res = await updateLanguageAdminAction({ id: editing.id, lang: input }).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Bahasa diperbarui!");
    } else {
      return;
    }
    closeModal();
    setReloadKey((k) => k + 1);
  }

  if (error && !languages) {
    return (
      <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">
        {error}
        <button type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="ml-2 text-xs font-bold underline">
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!languages) {
    return <div className="text-sm text-slate-400">Memuat Bahasa...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">🌐 Katalog Bahasa</h2>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          Tambah Bahasa
        </button>
      </div>

      {status && <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">{error}</div>}

      <section className="bg-white rounded-lg p-5 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50">
                <th className="text-left py-2 px-3">Bendera</th>
                <th className="text-left py-2 px-3">Kode ID</th>
                <th className="text-left py-2 px-3">Nama</th>
                <th className="text-left py-2 px-3">Nama Asli</th>
                <th className="text-left py-2 px-3">Kategori</th>
                <th className="text-left py-2 px-3">TTS Voice</th>
                <th className="text-left py-2 px-3">Edge TTS</th>
                <th className="text-left py-2 px-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="py-2 px-3 text-xl">{lang.flag || "🌐"}</td>
                  <td className="py-2 px-3 font-mono text-xs">{lang.id}</td>
                  <td className="py-2 px-3 font-bold">{lang.name}</td>
                  <td className="py-2 px-3 text-xs text-slate-400">{lang.native_name}</td>
                  <td className="py-2 px-3 text-xs">{lang.category}</td>
                  <td className="py-2 px-3 text-xs font-mono">{lang.tts_lang_code}</td>
                  <td className="py-2 px-3 text-xs font-mono text-slate-400">{lang.edge_tts_voice}</td>
                  <td className="py-2 px-3">
                    <button type="button" onClick={() => openEdit(lang)} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {languages.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">Belum ada bahasa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(creating || editing) && (
        <Modal title={editing ? "Edit Katalog Bahasa" : "Tambah Katalog Bahasa"} onClose={closeModal}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bendera</label>
          <input value={form.flag} onChange={(e) => setForm((f) => ({ ...f, flag: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Kode ID</label>
          <input value={form.id} disabled={!!editing} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. ja, ko, fr" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Nama</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jepang" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Nama Asli</label>
          <input value={form.native_name} onChange={(e) => setForm((f) => ({ ...f, native_name: e.target.value }))} placeholder="e.g. 日本語" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Kategori</label>
          <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Asia, Eropa" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Kode TTS Voice</label>
          <input value={form.tts_lang_code} onChange={(e) => setForm((f) => ({ ...f, tts_lang_code: e.target.value }))} placeholder="e.g. ja-JP, ko-KR" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Edge TTS Voice</label>
          <input value={form.edge_tts_voice} onChange={(e) => setForm((f) => ({ ...f, edge_tts_voice: e.target.value }))} placeholder="e.g. ja-JP-NanamiNeural" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">CSS Kelas Tema</label>
          <input value={form.theme_class} onChange={(e) => setForm((f) => ({ ...f, theme_class: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">CSS Kelas Tombol</label>
          <input value={form.button_class} onChange={(e) => setForm((f) => ({ ...f, button_class: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Deskripsi</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none" />
          <ModalFooter
            onCancel={closeModal}
            onSave={save}
            disabled={creating ? form.id.trim().length === 0 || form.name.trim().length === 0 : form.name.trim().length === 0}
          />
        </Modal>
      )}
    </div>
  );
}
