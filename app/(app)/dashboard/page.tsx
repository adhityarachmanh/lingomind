import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getDailyMission, getDueFlashcardCount, getEngagementStats, getLanguages } from "@/lib/dashboard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AiStatus from "@/components/AiStatus";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [profile, stats, languages] = await Promise.all([
    getUserProfile(session.email),
    getEngagementStats(session.email),
    getLanguages(),
  ]);
  if (!profile) redirect("/login");

  const langId = languages.some((l) => l.id === profile.preferred_language) ? profile.preferred_language : "English";

  const [curriculum, mission, dueCount] = await Promise.all([
    getCurriculum(),
    getDailyMission(session.email, langId),
    getDueFlashcardCount(session.email, langId),
  ]);

  const currentLevel = profile.current_level[langId] ?? "A1.0";
  const baseLevel = currentLevel.split(".")[0] ?? "A1";
  const topicIdx = Number(currentLevel.split(".")[1] ?? 0);
  const level = curriculum.find((c) => c.level === baseLevel);
  const nextTopic = level?.topics[topicIdx] ?? "Belajar";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Halo, {profile.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Lanjutkan belajar {langId} — {level?.title ?? baseLevel}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <LanguageSwitcher initial={langId} languages={languages} />
        </div>
      </div>

      <div className="flex justify-end">
        <AiStatus />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Streak</p>
          <p className="text-2xl font-black text-orange-500 mt-1">🔥 {stats?.current_streak ?? 0} hari</p>
          <p className="text-[11px] text-slate-400 mt-1">Terpanjang: {stats?.longest_streak ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koin</p>
          <p className="text-2xl font-black text-amber-500 mt-1">🪙 {stats?.coins ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">Total {stats?.total_points_earned ?? 0} pts</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nyawa</p>
          <p className="text-2xl font-black text-rose-500 mt-1">❤️ {stats?.hearts ?? 0}/5</p>
          <p className="text-[11px] text-slate-400 mt-1">1 per 4 jam</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skor</p>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">⭐ {profile.score}</p>
          <p className="text-[11px] text-slate-400 mt-1">{baseLevel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/general-practice" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
          <p className="text-xl">🎲</p>
          <p className="font-extrabold mt-2">Latihan Acak</p>
          <p className="text-xs text-slate-400 mt-1">+1 Nyawa ❤️ dan +15 Poin + Koin 🪙</p>
        </Link>
        <Link href="/practice/General" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
          <p className="text-xl">🎯</p>
          <p className="font-extrabold mt-2">Latihan Kelemahan</p>
          <p className="text-xs text-slate-400 mt-1">Fokus pada topik yang paling sering salah</p>
        </Link>
        <Link href="/placement" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:border-teal-500/50 transition-colors">
          <p className="text-xl">📝</p>
          <p className="font-extrabold mt-2">Tes Penempatan</p>
          <p className="text-xs text-slate-400 mt-1">Belum yakin dengan level Anda?</p>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold mb-3">Misi Harian</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>📚 Pelajaran ({mission.lessons_completed}/{mission.lesson_target})</span>
            </li>
            <li className="flex justify-between">
              <span>📝 Kuis ({mission.quizzes_completed}/{mission.quiz_target})</span>
            </li>
            <li className="flex justify-between">
              <span>🎯 Latihan kelemahan ({mission.weakness_practices_completed}/{mission.weakness_target})</span>
            </li>
            <li className="flex justify-between">
              <span>🃏 Flashcard ({mission.flashcards_reviewed}/{mission.flashcard_target})</span>
            </li>
            <li className="flex justify-between font-bold">
              <span>Status</span>
              <span className={mission.is_completed ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}>
                {mission.is_completed ? "✅ Selesai" : "⏳ Belum"}
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold mb-3">Lanjutkan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Topik berikutnya: <span className="font-bold text-slate-800 dark:text-slate-200">{nextTopic}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            🃏 {dueCount} flashcard menunggu review
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Level {level?.title ?? baseLevel}: {level?.topics.join(" · ") ?? ""}
          </p>
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold mb-3">Kurikulum ({langId})</h2>
        <div className="space-y-4">
          {curriculum.map((c) => (
            <div key={c.level} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <p className="font-bold text-sm">{c.level} — {c.title}</p>
                <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">{c.base_reward_points} pts</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{c.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.topics.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
