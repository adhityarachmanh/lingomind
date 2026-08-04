import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserProfile } from "@/lib/profile";
import { getCurriculum, getDailyMission, getDueFlashcardCount, getEngagementStats, getLanguages } from "@/lib/dashboard";
import { getDueVocabularyCount } from "@/lib/flashcards";
import { getGoalMastery } from "@/lib/mastery";
import { getUserBadges } from "@/lib/badges";
import { getTopWeaknesses } from "@/lib/weakness";
import { db } from "@/lib/db";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AiStatus from "@/components/AiStatus";
import HeartsRefillModal from "@/components/HeartsRefillModal";
import ChestCard from "@/components/ChestCard";
import SocialFeedSection from "@/components/SocialFeedSection";
import BattleArenaSection from "@/components/BattleArenaSection";
import PetCard from "@/components/PetCard";

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

  const [curriculum, mission, dueCount, dueVocabCount, badges, topWeaknesses, dailyLogs, goalMastery] = await Promise.all([
    getCurriculum(),
    getDailyMission(session.email, langId),
    getDueFlashcardCount(session.email, langId),
    getDueVocabularyCount(session.email, langId),
    getUserBadges(session.email),
    getTopWeaknesses(session.email, langId, 5),
    db.userProgressLog.findMany({
      where: { email: session.email, createdAt: { gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6); return d; })() } },
      select: { createdAt: true, scoreGained: true },
    }),
    getGoalMastery(session.email, langId),
  ]);

  const byDay = new Map<string, number>();
  for (const l of dailyLogs) {
    if (!l.createdAt) continue;
    const key = `${l.createdAt.getFullYear()}-${l.createdAt.getMonth() + 1}-${l.createdAt.getDate()}`;
    byDay.set(key, (byDay.get(key) ?? 0) + l.scoreGained);
  }
  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const skillPoints = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    skillPoints.push({ label: dayLabels[d.getDay()], value: byDay.get(key) ?? 0 });
  }
  const maxScore = Math.max(1, ...skillPoints.map((p) => p.value));
  const weekTotal = skillPoints.reduce((s, p) => s + p.value, 0);

  const currentLevel = profile.current_level[langId] ?? "A1.0";
  const baseLevel = currentLevel.split(".")[0] ?? "A1";
  const topicIdx = Number(currentLevel.split(".")[1] ?? 0);
  const level = curriculum.find((c) => c.level === baseLevel);
  const nextTopic = level?.topics[topicIdx] ?? "Belajar";

  // ---- Rekomendasi adaptif hari ini (prioritas: re-review mastery → kosakata → kelemahan → lanjutkan) ----
  const reviewDueGoal = [...goalMastery.entries()].find(([, m]) => m.reviewDue)?.[0] ?? null;
  const topWeakness = topWeaknesses[0]?.topic ?? null;
  const recommendation = reviewDueGoal
    ? { icon: "🔄", text: `Re-review topik "${reviewDueGoal}" agar tidak lupa`, href: `/lesson/${encodeURIComponent(reviewDueGoal)}` }
    : dueVocabCount > 0
      ? { icon: "📖", text: `Review ${dueVocabCount} kosakata hari ini`, href: "/vocabulary" }
      : topWeakness
        ? { icon: "🎯", text: `Latih kelemahan: ${topWeakness}`, href: "/practice/General" }
        : { icon: "🚀", text: "Lanjutkan kurikulum berikutnya", href: "/roadmap" };

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

      <Link
        href={recommendation.href}
        className="block bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/30 rounded-xl px-5 py-4 shadow-card hover:shadow-card-hover transition-all hover:border-teal-500/50"
      >
        <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Rekomendasi Hari Ini</p>
        <p className="text-sm font-bold mt-1">
          {recommendation.icon} {recommendation.text}
        </p>
      </Link>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Streak</p>
          <p className="text-2xl font-black text-orange-500 mt-1">🔥 {stats?.current_streak ?? 0} hari</p>
          <p className="text-[11px] text-slate-400 mt-1">Terpanjang: {stats?.longest_streak ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Koin</p>
          <p className="text-2xl font-black text-amber-500 mt-1">🪙 {stats?.coins ?? 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">Total {stats?.total_points_earned ?? 0} pts</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nyawa</p>
          <p className="text-2xl font-black text-rose-500 mt-1">❤️ {stats?.hearts ?? 0}/5</p>
          <div>
            <p className="text-[11px] text-slate-400 mt-1">1 per 4 jam</p>
            <HeartsRefillModal hearts={stats?.hearts ?? 5} coins={stats?.coins ?? 0} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skor</p>
          <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">⭐ {profile.score}</p>
          <p className="text-[11px] text-slate-400 mt-1">{baseLevel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/general-practice" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">🎲</p>
          <p className="font-extrabold mt-2">Latihan Acak</p>
          <p className="text-xs text-slate-400 mt-1">+1 Nyawa ❤️ dan +15 Poin + Koin 🪙</p>
        </Link>
        <Link href="/practice/General" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">🎯</p>
          <p className="font-extrabold mt-2">Latihan Kelemahan</p>
          <p className="text-xs text-slate-400 mt-1">Fokus pada topik yang paling sering salah</p>
        </Link>
        <Link href="/placement" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">📝</p>
          <p className="font-extrabold mt-2">Tes Penempatan</p>
          <p className="text-xs text-slate-400 mt-1">Belum yakin dengan level Anda?</p>
        </Link>
        <Link href="/chat/Bebas" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">💬</p>
          <p className="font-extrabold mt-2">Chat AI</p>
          <p className="text-xs text-slate-400 mt-1">Simulasi percakapan teks bebas.</p>
        </Link>
        <Link href="/voice-chat/Bebas" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">🎙️</p>
          <p className="font-extrabold mt-2">Live Voice AI</p>
          <p className="text-xs text-slate-400 mt-1">Ngobrol langsung dengan suara.</p>
        </Link>
        <Link href="/pronunciation-practice" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-card hover:border-teal-500/50 transition-all hover:shadow-card-hover">
          <p className="text-xl">🗣️</p>
          <p className="font-extrabold mt-2">Speech Scoring</p>
          <p className="text-xs text-slate-400 mt-1">Latih akurasi pronunciation.</p>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
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

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-extrabold mb-3">Lanjutkan</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Topik berikutnya: <span className="font-bold text-slate-800 dark:text-slate-200">{nextTopic}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            🃏 {dueCount} flashcard menunggu review
          </p>
          <Link
            href="/vocabulary"
            className="inline-block text-sm text-slate-500 dark:text-slate-400 mt-2 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            📖 {dueVocabCount > 0 ? `${dueVocabCount} kosakata perlu review` : "Kosakata bank"}
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Level {level?.title ?? baseLevel}: {level?.topics.join(" · ") ?? ""}
          </p>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-extrabold mb-3">📈 Skill Progress 7 Hari</h2>
          <svg viewBox="0 0 280 96" className="w-full h-24" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-teal-500"
              points={skillPoints.map((p, i) => `${Math.round((i * 280) / 6)},${Math.round(92 - (p.value / maxScore) * 84)}`).join(" ")}
            />
          </svg>
          <div className="grid grid-cols-7 mt-1 text-center text-[10px] font-semibold text-slate-400">
            {skillPoints.map((p, i) => (
              <span key={i}>{p.label}</span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Total {weekTotal} poin minggu ini</p>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-extrabold mb-3">🎯 Kelemahan Teratas</h2>
          {topWeaknesses.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data kelemahan.</p>
          ) : (
            <ul className="space-y-2">
              {topWeaknesses.map((w) => (
                <li key={w.topic} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <span className="text-sm font-bold">{w.topic}</span>
                  <span className="text-[11px] font-bold text-rose-500 bg-rose-500/10 rounded-lg px-2 py-0.5">{w.count}x</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
        <h2 className="text-lg font-extrabold mb-3">📜 Quest Harian Bertingkat</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <ChestCard
            icon="🪵" title="Peti Kayu" desc="Selesaikan 1 Kuis Apapun."
            progress={`${mission.quizzes_completed}/1 Selesai`}
            locked={mission.quizzes_completed < 1}
            claimed={mission.tier1_claimed}
            buttonLabel="Klaim 20 Koin!"
            tier={1}
          />
          <ChestCard
            icon="🥈" title="Peti Perak" desc="Jawab 50 pertanyaan dengan benar hari ini."
            progress={`${mission.correct_answers_today}/50 Benar`}
            locked={mission.correct_answers_today < 50}
            claimed={mission.tier2_claimed}
            buttonLabel="Klaim 50 Koin!"
            tier={2}
          />
          <ChestCard
            icon="🥇" title="Peti Emas" desc="Menangkan 3 PvP Battle hari ini."
            progress={`${mission.pvp_wins_today}/3 Menang`}
            locked={mission.pvp_wins_today < 3}
            claimed={mission.tier3_claimed}
            buttonLabel="Klaim 100 Koin + Bonus!"
            tier={3}
            highlight
          />
        </div>
      </section>

      {badges.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-extrabold mb-3">🏅 Badges / Lencana</h2>
          <div className="space-y-2">
            {badges.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <span className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center">{b.icon_name}</span>
                <div>
                  <p className="font-bold text-sm">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-card">
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

      <SocialFeedSection />
      <BattleArenaSection />
      <PetCard />
    </div>
  );
}
