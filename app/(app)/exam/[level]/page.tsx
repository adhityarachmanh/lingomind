import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getEngagementStats, getLanguages } from "@/lib/dashboard";
import ExamView from "@/components/ExamView";

export default async function ExamPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, stats] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getEngagementStats(session.email),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  return <ExamView level={level} language={langId} ttsLang={ttsLang} initialHearts={stats?.hearts ?? 5} />;
}
