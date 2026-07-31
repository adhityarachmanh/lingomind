import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import Navbar from "@/components/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await getUserProfile(session.email);
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <Navbar full_name={profile.full_name} score={profile.score} email={profile.email} />
      <main className="pt-16">{children}</main>
    </div>
  );
}
