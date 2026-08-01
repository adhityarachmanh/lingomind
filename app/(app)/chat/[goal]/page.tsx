import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getLanguages } from "@/lib/dashboard";
import ChatView from "@/components/ChatView";

export default async function ChatPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages] = await Promise.all([getUserProfile(session.email), getLanguages()]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  return <ChatView goal={decodeURIComponent(goal)} language={langId} />;
}
