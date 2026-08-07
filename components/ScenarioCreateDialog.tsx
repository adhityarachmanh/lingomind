"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { isTemplateUsed, SCENARIO_TEMPLATES, type ScenarioType, type UsedScenarioTemplate } from "@/lib/templates";
import { createScenarioAction, getScenarioTemplatesUsedAction } from "@/lib/actions/scenario";

export default function ScenarioCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<ScenarioType>("language");
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState("A1");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [used, setUsed] = useState<UsedScenarioTemplate[]>([]);

  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

  const modeTemplates = SCENARIO_TEMPLATES.filter((t) => t.type === mode);
  const categories = [...new Set(modeTemplates.map((t) => t.category))];

  function isUsedTemplate(id: string) {
    return mode === "general" ? used.some((u) => u.templateId === id) : isTemplateUsed(used, id, language);
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await getScenarioTemplatesUsedAction();
      if ("error" in res) { toast.error(res.error); return; }
      setUsed(res.used);
    })();
  }, [open]);

  function pickTemplate(id: string) {
    if (isUsedTemplate(id)) return;
    const t = SCENARIO_TEMPLATES.find((x) => x.id === id);
    setTemplateId(id);
    if (t) {
      setTitle(t.title);
      setDescription(t.description);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await createScenarioAction({ templateId: templateId ?? undefined, title, description, language: mode === "general" ? "Indonesian" : language, level, type: mode });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Skenario berhasil dibuat!");
      setTemplateId(null);
      setTitle("");
      setDescription("");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan skenario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Skenario</DialogTitle>
          <DialogDescription>{mode === "general" ? "Pilih template atau buat skenario sendiri." : "Pilih bahasa, lalu pilih template atau buat sendiri."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            <Button type="button" variant={mode === "language" ? "default" : "outline"} size="sm" onClick={() => { setMode("language"); setLanguage("English"); setTemplateId(null); setTitle(""); setDescription(""); }}>
              Belajar Bahasa
            </Button>
            <Button type="button" variant={mode === "general" ? "default" : "outline"} size="sm" onClick={() => { setMode("general"); setLanguage("English"); setTemplateId(null); setTitle(""); setDescription(""); }}>
              Umum
            </Button>
          </div>
          {mode === "language" && (
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bahasa Target</Label>
            <Select
              value={language}
              onValueChange={(next) => {
                setLanguage(next);
                if (templateId && isTemplateUsed(used, templateId, next)) {
                  setTemplateId(null);
                  setTitle("");
                  setDescription("");
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.flag} {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          {mode === "language" && (
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Semakin tinggi level, semakin kompleks balasan & koreksi AI.</p>
          </div>
          )}
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Pilih Template</Label>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1.5">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {modeTemplates.filter((t) => t.category === cat).map((t) => {
                      const usedTemplate = isUsedTemplate(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={usedTemplate}
                          onClick={() => pickTemplate(t.id)}
                          className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                            usedTemplate
                              ? "border-border opacity-40 cursor-not-allowed"
                              : templateId === t.id
                                ? "border-teal-500 bg-teal-500/10"
                                : "border-border hover:border-teal-500/60"
                          }`}
                        >
                          <span className="text-xs font-semibold block">
                            {t.title}
                            {usedTemplate && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Sudah ada</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama skenario..." />
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider pt-1">Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat..." rows={2} />
          </div>
          <Button type="button" className="w-full" onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Menyimpan..." : "Simpan Skenario"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
