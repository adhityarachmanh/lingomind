import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getLanguages } from "@/lib/dashboard";
import { getGoalMastery } from "@/lib/mastery";
import RoadmapClient from "@/components/RoadmapClient";

const LEVELS_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default async function RoadmapPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile, languages, curriculum] = await Promise.all([
    getUserProfile(session.email),
    getLanguages(),
    getCurriculum(),
  ]);
  if (!profile) redirect("/login");

  const langId = languages.some((l) => l.id === profile.preferred_language)
    ? profile.preferred_language
    : "English";

  const current = (profile.current_level[langId] ?? "A1.0").split(".");
  const activeLevelIdx = Math.max(0, LEVELS_ORDER.indexOf(current[0] ?? "A1"));
  const activeTopicIdx = Number(current[1] ?? 0);

  const mastery = await getGoalMastery(session.email, langId);

  const levels = LEVELS_ORDER.map((levelId, idx) => {
    const data = curriculum.find((c) => c.level === levelId);
    const unlocked = idx <= activeLevelIdx;
    const currentLevel = idx === activeLevelIdx;
    const topics = (data?.topics ?? []).map((title, topicIdx) => ({
      title,
      unlocked: unlocked && (idx < activeLevelIdx || topicIdx <= activeTopicIdx),
      current: currentLevel && topicIdx === activeTopicIdx,
      mastery: mastery.get(title),
    }));
    return {
      level: levelId,
      title: data?.title ?? levelId,
      description: data?.description ?? "",
      base_reward_points: data?.base_reward_points ?? 0,
      unlocked,
      currentLevel,
      topics,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">Peta Kurikulum {langId}</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Pilih topik pelajaran yang ingin Anda kuasai. Level Anda saat ini adalah {current[0] ?? "A1"}.
      </p>
      <div className="border-l-4 border-slate-200 dark:border-slate-700 pl-4 space-y-8">
        {levels.map((lv) => (
          <div key={lv.level} className={lv.unlocked ? "" : "opacity-60"}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-black">{lv.level}</span>
              <h2 className="font-extrabold">{lv.title}</h2>
              {lv.currentLevel && (
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[11px] font-bold">
                  Posisi Anda
                </span>
              )}
              {!lv.unlocked && <span className="text-sm">🔒</span>}
            </div>
            <p className="text-xs text-slate-400 mb-3">{lv.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lv.topics.map((t) => (
                <RoadmapClient
                  key={t.title}
                  topic={t.title}
                  unlocked={t.unlocked}
                  current={t.current}
                  masteryLevel={t.mastery?.level}
                  reviewDue={t.mastery?.reviewDue}
                />
              ))}
            </div>
            {lv.currentLevel && (
              <div className="mt-3">
                {activeTopicIdx < 4 ? (
                  <span className="inline-block px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold">
                    🔒 Ujian Kenaikan Tingkat (Selesaikan semua topik)
                  </span>
                ) : (
                  <Link
                    href={`/exam/${lv.level}`}
                    className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    🎓 Ujian Kenaikan Tingkat
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
