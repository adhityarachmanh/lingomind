import { db } from "@/lib/db";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="p-6 text-center text-sm text-slate-500">Token tidak ditemukan.</p>;

  const record = await db.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return <p className="p-6 text-center text-sm text-rose-500">Token tidak valid atau kedaluwarsa.</p>;

  await db.user.update({ where: { email: record.email }, data: { isVerified: true } });
  await db.emailVerificationToken.delete({ where: { id: record.id } });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg max-w-md text-center">
        <p className="text-2xl font-black text-teal-600">✅</p>
        <p className="text-lg font-extrabold mt-4">Email Terverifikasi!</p>
        <p className="text-sm text-slate-500 mt-2">Akun Anda sudah aktif. Silakan login.</p>
        <a href="/login" className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold">Masuk</a>
      </div>
    </div>
  );
}
