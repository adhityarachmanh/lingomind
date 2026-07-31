"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePreferredLanguageAction } from "@/lib/actions/dashboard";
import type { LanguageCourse } from "@/lib/types";

export default function LanguageSwitcher({
  initial,
  languages,
}: {
  initial: string;
  languages: LanguageCourse[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: string) {
    setSelected(value);
    setError(null);
    const res = await updatePreferredLanguageAction(value);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
      >
        {languages.map((l) => (
          <option key={l.id} value={l.id}>
            {l.flag} {l.native_name} — {l.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
