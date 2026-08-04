import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <p className="text-6xl font-black text-slate-300 dark:text-slate-700">404</p>
      <p className="text-2xl font-black">Halaman Tidak Ditemukan</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">Halaman yang kamu cari tidak ada atau sudah dipindah.</p>
      <Link
        href="/dashboard"
        className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
