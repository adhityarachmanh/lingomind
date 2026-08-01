import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const target = decodeURIComponent(email);
  return <ProfileView email={target} isOwn={session.email.toLowerCase() === target.toLowerCase()} />;
}
