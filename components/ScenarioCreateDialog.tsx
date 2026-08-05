"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { SCENARIO_TEMPLATES } from "@/lib/templates";
import { createScenarioAction } from "@/lib/actions/scenario";

export default function ScenarioCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [language, setLanguage] = useState("English");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = [...new Set(SCENARIO_TEMPLATES.map((t) => t.category))];

  function pickTemplate(id: string) {
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
      const res = await createScenarioAction({ templateId: templateId ?? undefined, title, description, language });
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
          <DialogDescription>Pilih bahasa, lalu pilih template atau buat sendiri.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bahasa Target</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Pilih Template</Label>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[11px] font-bold text-muted-foreground mb-1.5">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SCENARIO_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTemplate(t.id)}
                        className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                          templateId === t.id ? "border-teal-500 bg-teal-500/10" : "border-border hover:border-teal-500/60"
                        }`}
                      >
                        <span className="text-xs font-semibold block">{t.title}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</span>
                      </button>
                    ))}
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
