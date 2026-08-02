"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[60vh] bg-slate-50 flex flex-col items-center justify-center gap-3 text-center px-6">
      <p className="text-2xl font-bold text-slate-900">Terjadi Kesalahan</p>
      <p className="text-sm text-slate-500">Coba muat ulang halaman ini.</p>
      <button type="button" onClick={reset} className="mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Coba Lagi</button>
    </div>
  );
}
