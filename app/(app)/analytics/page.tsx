import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnalyticsView from "@/components/AnalyticsView";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AnalyticsView />;
}
