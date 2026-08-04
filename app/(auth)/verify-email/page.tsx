import { verifyEmailAction } from "@/lib/actions/password";
import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailAction(token) : { error: "Token verifikasi tidak valid atau sudah kedaluwarsa." };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col justify-center items-center p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-card max-w-md w-full border border-slate-200 dark:border-slate-700 text-center">
        <h2 className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mb-3">Verifikasi Email</h2>
        {result.error ? (
          <p className="text-rose-600 dark:text-rose-400 text-sm font-semibold mb-4">⚠️ {result.error}</p>
        ) : (
          <p className="text-teal-700 dark:text-teal-400 text-sm font-semibold mb-4">✅ {result.message}</p>
        )}
        <Link href="/login" className="inline-block w-full font-bold py-3 px-4 rounded-xl transition-all text-sm bg-teal-500 hover:bg-teal-600 text-white shadow-md">
          Masuk ke Aplikasi
        </Link>
      </div>
    </div>
  );
}
