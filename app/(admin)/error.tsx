"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
      <p className="text-2xl font-black">Terjadi Kesalahan</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">Coba muat ulang halaman ini.</p>
      <button type="button" onClick={reset} className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Coba Lagi</button>
    </div>
  );
}
