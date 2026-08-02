"use client";

import { useEffect, useState } from "react";
import {
  createLevelAdminAction, createTopicAdminAction, getLevelsAdminAction,
  getTopicsAdminAction, updateLevelAdminAction, updateTopicAdminAction,
} from "@/lib/actions/admin";
import type { AdminLevelItem, AdminTopicItem } from "@/lib/types";
import { Modal, ModalFooter } from "./ui";

interface LevelForm {
  id: string; title: string; description: string; base_reward_points: string; order_index: string;
}

interface TopicForm {
  title: string; order_index: string;
}

const emptyLevelForm: LevelForm = { id: "", title: "", description: "", base_reward_points: "100", order_index: "1" };
const emptyTopicForm: TopicForm = { title: "", order_index: "1" };

export default function AdminCurriculumPanel() {
  const [levels, setLevels] = useState<AdminLevelItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topics, setTopics] = useState<AdminTopicItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingLevel, setEditingLevel] = useState<AdminLevelItem | null>(null);
  const [creatingLevel, setCreatingLevel] = useState(false);
  const [levelForm, setLevelForm] = useState<LevelForm>(emptyLevelForm);
  const [editingTopic, setEditingTopic] = useState<AdminTopicItem | null>(null);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState<TopicForm>(emptyTopicForm);

  useEffect(() => {
    let cancelled = false;
    getLevelsAdminAction()
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setLevels(res.levels);
        setSelectedId((prev) => (prev && res.levels.some((l) => l.id === prev) ? prev : (res.levels[0]?.id ?? null)));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat levels.");
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getTopicsAdminAction(selectedId)
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) { setError(res.error); return; }
        setTopics(res.topics);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal memuat topik.");
      });
    return () => { cancelled = true; };
  }, [selectedId, reloadKey]);

  function openCreateLevel() {
    setEditingLevel(null);
    setCreatingLevel(true);
    setLevelForm(emptyLevelForm);
  }

  function openEditLevel(level: AdminLevelItem) {
    setCreatingLevel(false);
    setEditingLevel(level);
    setLevelForm({
      id: level.id,
      title: level.title,
      description: level.description,
      base_reward_points: String(level.base_reward_points),
      order_index: String(level.order_index),
    });
  }

  function closeLevelModal() {
    setEditingLevel(null);
    setCreatingLevel(false);
  }

  async function saveLevel() {
    if (!creatingLevel && !editingLevel) return;
    setStatus(null);
    const reward = parseInt(levelForm.base_reward_points, 10);
    const order = parseInt(levelForm.order_index, 10);
    const input = {
      id: levelForm.id.trim(),
      title: levelForm.title.trim(),
      description: levelForm.description.trim(),
      base_reward_points: Number.isFinite(reward) ? reward : 100,
      order_index: Number.isFinite(order) ? order : 1,
    };
    if (creatingLevel) {
      const res = await createLevelAdminAction(input).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Level ditambahkan!");
      setSelectedId(input.id);
      setTopics(null);
    } else if (editingLevel) {
      const res = await updateLevelAdminAction({ id: editingLevel.id, level: input }).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Level diperbarui!");
    } else {
      return;
    }
    closeLevelModal();
    setReloadKey((k) => k + 1);
  }

  function openCreateTopic() {
    setEditingTopic(null);
    setCreatingTopic(true);
    setTopicForm(emptyTopicForm);
  }

  function openEditTopic(topic: AdminTopicItem) {
    setCreatingTopic(false);
    setEditingTopic(topic);
    setTopicForm({ title: topic.title, order_index: String(topic.order_index) });
  }

  function closeTopicModal() {
    setEditingTopic(null);
    setCreatingTopic(false);
  }

  async function saveTopic() {
    if (!creatingTopic && !editingTopic) return;
    if (!selectedId) return;
    setStatus(null);
    const order = parseInt(topicForm.order_index, 10);
    const title = topicForm.title.trim();
    if (creatingTopic) {
      const res = await createTopicAdminAction({ levelId: selectedId, title, orderIndex: Number.isFinite(order) ? order : 1 }).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Topik ditambahkan!");
    } else if (editingTopic) {
      const res = await updateTopicAdminAction({ id: editingTopic.id, title, orderIndex: Number.isFinite(order) ? order : 1 }).catch(() => ({ error: "Gagal menyimpan." }));
      if ("error" in res) { setError(res.error); return; }
      setStatus("Topik diperbarui!");
    } else {
      return;
    }
    closeTopicModal();
    setReloadKey((k) => k + 1);
  }

  const selectedLevel = levels?.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">📚 Kurikulum</h2>
      </div>

      {status && <div className="px-4 py-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-semibold">{status}</div>}
      {error && <div className="px-4 py-3 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <section className="bg-white rounded-lg p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Levels (CEFR)</h3>
            <button
              type="button"
              onClick={openCreateLevel}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Tambah
            </button>
          </div>
          {levels === null ? (
            <p className="text-sm text-slate-400">Memuat Levels...</p>
          ) : levels.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada level.</p>
          ) : (
            <ul className="space-y-2">
              {levels.map((level) => (
                <li key={level.id}>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer border ${
                      selectedId === level.id
                        ? "bg-blue-50 border-blue-200"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                    onClick={() => { setTopics(null); setSelectedId(level.id); }}
                  >
                    <span className="text-xs font-bold text-slate-400 w-8">{level.order_index}</span>
                    <span className="font-bold text-sm flex-1">{level.title}</span>
                    <span className="text-xs font-mono text-slate-400">{level.id}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditLevel(level); }}
                      className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-lg p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">
              Daftar Topik: <span className="text-blue-700">{selectedLevel?.title ?? ""}</span>
            </h3>
            <button
              type="button"
              onClick={openCreateTopic}
              disabled={!selectedId}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold"
            >
              Tambah Topik
            </button>
          </div>
          {!selectedId ? (
            <p className="text-sm text-slate-400">Pilih salah satu Level di sebelah kiri untuk melihat dan mengelola Topik.</p>
          ) : topics === null ? (
            <p className="text-sm text-slate-400">Memuat Topik...</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-slate-400">Tidak ada topik ditemukan di level ini.</p>
          ) : (
            <ul className="space-y-2">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 w-8">{topic.order_index}</span>
                    <span className="font-semibold text-sm flex-1">{topic.title}</span>
                    <button
                      type="button"
                      onClick={() => openEditTopic(topic)}
                      className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(creatingLevel || editingLevel) && (
        <Modal title={editingLevel ? "Edit Level Pembelajaran" : "Tambah Level Pembelajaran"} onClose={closeLevelModal}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Kode</label>
          <input value={levelForm.id} disabled={!!editingLevel} onChange={(e) => setLevelForm((f) => ({ ...f, id: e.target.value }))} placeholder="e.g. A1" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Nama</label>
          <input value={levelForm.title} onChange={(e) => setLevelForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Beginner" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Base Reward</label>
          <input type="number" value={levelForm.base_reward_points} onChange={(e) => setLevelForm((f) => ({ ...f, base_reward_points: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Order Index</label>
          <input type="number" value={levelForm.order_index} onChange={(e) => setLevelForm((f) => ({ ...f, order_index: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Deskripsi</label>
          <textarea value={levelForm.description} onChange={(e) => setLevelForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none" />
          <ModalFooter
            onCancel={closeLevelModal}
            onSave={saveLevel}
            disabled={creatingLevel ? levelForm.id.trim().length === 0 || levelForm.title.trim().length === 0 : levelForm.title.trim().length === 0}
          />
        </Modal>
      )}

      {(creatingTopic || editingTopic) && (
        <Modal title={editingTopic ? "Edit Topik" : "Tambah Topik"} onClose={closeTopicModal}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Level</label>
          <input value={selectedLevel?.title ?? ""} disabled className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Nama Topik</label>
          <input value={topicForm.title} onChange={(e) => setTopicForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Greetings &amp; Introductions" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Order Index</label>
          <input type="number" value={topicForm.order_index} onChange={(e) => setTopicForm((f) => ({ ...f, order_index: e.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          <ModalFooter onCancel={closeTopicModal} onSave={saveTopic} disabled={topicForm.title.trim().length === 0} />
        </Modal>
      )}
    </div>
  );
}
