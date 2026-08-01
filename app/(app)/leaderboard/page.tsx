import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LeaderboardView from "@/components/LeaderboardView";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <LeaderboardView myEmail={session.email} />;
}
