"use client";

import { useState } from "react";
import { testAiAction } from "@/lib/actions/ai";

export default function AiStatus() {
  const [state, setState] = useState<{ pending: boolean; result?: string; error?: string }>({ pending: false });

  async function run() {
    setState({ pending: true });
    const res = await testAiAction();
    setState({ pending: false, result: res.ok ? res.text : undefined, error: res.ok ? undefined : res.error });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state.pending}
        className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-xs font-bold shadow-md transition-colors"
      >
        {state.pending ? "Memeriksa..." : "Cek AI"}
      </button>
      {state.result && <span className="text-xs font-bold text-teal-600 dark:text-teal-400">AI siap: {state.result}</span>}
      {state.error && <span className="text-xs font-bold text-rose-500 max-w-xs truncate">{state.error}</span>}
    </div>
  );
}
