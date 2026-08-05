import { redirect } from "next/navigation";
import { getSession, clearSessionCookie } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar full_name={session.full_name} />
      <main className="pt-14">{children}</main>
    </div>
  );
}
