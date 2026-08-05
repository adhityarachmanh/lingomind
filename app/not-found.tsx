import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-background text-foreground">
      <p className="text-6xl font-black text-muted-foreground">404</p>
      <p className="text-2xl font-black">Halaman Tidak Ditemukan</p>
      <p className="text-sm text-muted-foreground">Halaman yang kamu cari tidak ada atau sudah dipindah.</p>
      <Link
        href="/chat"
        className="mt-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold"
      >
        Kembali ke Chat
      </Link>
    </div>
  );
}
