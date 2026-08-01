import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getEngagementStats, getLanguages } from "@/lib/dashboard";
import QuizView from "@/components/QuizView";

export default async function QuizPage({ params }: { params: Promise<{ goal: string }> }) {
  const { goal } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, curriculum, stats] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getCurriculum(),
    getEngagementStats(session.email),
  ]);
  if (!profile) redirect("/login");
  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";
  const ttsLang = languages.find((l) => l.id === langId)?.tts_lang_code ?? "en-US";
  const baseLevel = (profile.current_level[langId] ?? "A1.0").split(".")[0] || "A1";
  const ptsPerQuestion = curriculum.find((c) => c.level === baseLevel)?.base_reward_points ?? 10;

  return (
    <QuizView
      goal={decodeURIComponent(goal)}
      language={langId}
      ttsLang={ttsLang}
      initialHearts={stats?.hearts ?? 5}
      ptsPerQuestion={ptsPerQuestion}
    />
  );
}
