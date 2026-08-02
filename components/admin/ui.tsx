"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-lg p-5 w-full max-w-md border border-slate-200 shadow-xs max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  onSave,
  disabled = false,
}: {
  onCancel: () => void;
  onSave: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-3 mt-6 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="px-4 py-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || disabled}
        className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2"
      >
        {saving && <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );
}
