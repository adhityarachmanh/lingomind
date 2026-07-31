import ResetPasswordForm from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <p className="text-center text-rose-500 p-8">Token reset tidak valid atau sudah kedaluwarsa.</p>;
  }
  return <ResetPasswordForm token={token} />;
}
