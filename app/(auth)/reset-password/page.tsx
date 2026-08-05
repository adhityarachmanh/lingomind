import Link from "next/link";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-card p-8 rounded-2xl border border-border shadow-lg max-w-md text-center">
          <p className="text-lg font-extrabold">Token Tidak Ditemukan</p>
          <p className="text-sm text-muted-foreground mt-2">Link reset password tidak valid.</p>
          <Link href="/forgot-password" className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold">Minta Ulang</Link>
        </div>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
