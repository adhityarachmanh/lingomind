import { db } from "./db";
import type { AdminLanguageItem, AdminLevelItem, AdminMissionConfigItem, AdminShopItem, AdminTopicItem, AdminUserRow } from "./types";
import { generateLesson } from "./ai-content/lesson";
import { GENERAL_PRACTICE_THEMES, buildGeneralPracticePrompt, buildQuizPrompt, generateQuizWithPrompt } from "./ai-content/quiz";
import { generateExam } from "./ai-content/exam";

// ---- Validasi anti-duplikat konten (pure, diuji di vitest) ----

export function normalizeTextForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s: string): Set<string> {
  return new Set(normalizeTextForCompare(s).split(" ").filter(Boolean));
}

// Quiz duplikat jika ADA minimal 1 pertanyaan yang identik (normalisasi, question + listen_text)
// dengan varian existing — soal listening dibedakan oleh isi listen_text, bukan instruksinya.
export function hasDuplicateQuiz(
  existingQuestions: { question: string; listenText?: string }[],
  newQuestions: { question: string; listenText?: string }[]
): boolean {
  if (existingQuestions.length === 0 || newQuestions.length === 0) return false;
  const existing = new Set(
    existingQuestions
      .map((q) => normalizeTextForCompare(`${q.question} ${q.listenText ?? ""}`))
      .filter(Boolean)
  );
  for (const q of newQuestions) {
    const key = normalizeTextForCompare(`${q.question} ${q.listenText ?? ""}`);
    if (key && existing.has(key)) return true;
  }
  return false;
}

// Lesson duplikat jika judul sama persis (normalisasi) ATAU overlap kata konten (Jaccard) >= 0.6.
export function hasDuplicateLesson(
  existingTitles: string[],
  existingContents: string[],
  newTitle: string,
  newContent: string
): boolean {
  const title = normalizeTextForCompare(newTitle);
  if (title && existingTitles.some((t) => normalizeTextForCompare(t) === title)) return true;
  if (!newContent.trim()) return false;
  const newWords = words(newContent);
  if (newWords.size === 0) return false;
  for (const content of existingContents) {
    const existingSet = words(content);
    if (existingSet.size === 0) continue;
    const union = new Set([...newWords, ...existingSet]);
    const intersection = new Set([...newWords].filter((w) => existingSet.has(w)));
    if (intersection.size / union.size >= 0.6) return true;
  }
  return false;
}

export async function getUsersAdmin(): Promise<AdminUserRow[]> {
  const users = await db.user.findMany({ orderBy: { email: "asc" } });
  const emails = users.map((u) => u.email);
  const statsRows = await db.userEngagementStat.findMany({ where: { email: { in: emails } } });
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  return users.map((u) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email,
      full_name: u.fullName ?? "",
      role: u.role,
      is_verified: u.isVerified,
      score: u.score ?? 0,
      coins: stats?.coins ?? 0,
      streak_days: stats?.currentStreak ?? 0,
    };
  });
}

export async function updateUserStatsAdmin(email: string, coins: number, streak: number): Promise<void> {
  const existing = await db.userEngagementStat.findUnique({ where: { email } });
  if (existing) {
    await db.userEngagementStat.update({
      where: { email },
      data: {
        coins,
        currentStreak: streak,
        longestStreak: Math.max(existing.longestStreak, streak),
      },
    });
  } else {
    await db.userEngagementStat.create({
      data: { email, coins, currentStreak: streak, longestStreak: streak },
    });
  }
}

export async function resetUserProgressAdmin(email: string): Promise<void> {
  await db.$transaction([
    db.chatSession.deleteMany({ where: { email } }),
    db.flashcard.deleteMany({ where: { email } }),
    db.weaknessLog.deleteMany({ where: { email } }),
    db.userLanguageGoal.deleteMany({ where: { email } }),
    db.skillProgressLog.deleteMany({ where: { email } }),
    db.userEngagementStat.deleteMany({ where: { email } }),
    db.passwordReset.deleteMany({ where: { email } }),
    db.userBadge.deleteMany({ where: { email } }),
    db.emailVerificationToken.deleteMany({ where: { email } }),
    db.userProgressLog.deleteMany({ where: { email } }),
    db.userLanguageProgress.deleteMany({ where: { email } }),
    db.follower.deleteMany({ where: { OR: [{ followerEmail: email }, { followedEmail: email }] } }),
    db.quizBattle.deleteMany({ where: { OR: [{ challengerEmail: email }, { challengedEmail: email }] } }),
    db.user.update({ where: { email }, data: { score: 0, preferredLanguage: "English" } }),
  ]);
}

export async function updateUserRoleAdmin(email: string, newRole: string): Promise<void> {
  await db.user.update({ where: { email }, data: { role: newRole } });
}

export async function getShopItemsAdmin(): Promise<AdminShopItem[]> {
  const items = await db.shopItem.findMany({ orderBy: { cost: "asc" } });
  return items.map((i) => ({
    id: i.id, name: i.name, description: i.description, cost: i.cost,
    effect_type: i.effectType, icon_name: i.iconName,
  }));
}

export async function createShopItemAdmin(input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.create({
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function updateShopItemAdmin(id: number, input: {
  name: string; description: string | null; cost: number; effect_type: string; icon_name: string | null;
}): Promise<void> {
  await db.shopItem.update({
    where: { id },
    data: { name: input.name, description: input.description, cost: input.cost, effectType: input.effect_type, iconName: input.icon_name },
  });
}

export async function getLanguagesAdmin(): Promise<AdminLanguageItem[]> {
  const rows = await db.language.findMany({ orderBy: { name: "asc" } });
  return rows.map((l) => ({
    id: l.id, name: l.name, native_name: l.nativeName, flag: l.flag, description: l.description,
    theme_class: l.themeClass, button_class: l.buttonClass, category: l.category,
    tts_lang_code: l.ttsLangCode, edge_tts_voice: l.edgeTtsVoice,
  }));
}

export async function createLanguageAdmin(lang: AdminLanguageItem): Promise<void> {
  await db.language.create({
    data: {
      id: lang.id, name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice ?? "",
    },
  });
}

export async function updateLanguageAdmin(id: string, lang: AdminLanguageItem): Promise<void> {
  await db.language.update({
    where: { id },
    data: {
      name: lang.name, nativeName: lang.native_name, flag: lang.flag,
      description: lang.description, themeClass: lang.theme_class, buttonClass: lang.button_class,
      category: lang.category, ttsLangCode: lang.tts_lang_code, edgeTtsVoice: lang.edge_tts_voice ?? "",
    },
  });
}

export async function getLevelsAdmin(): Promise<AdminLevelItem[]> {
  const rows = await db.level.findMany({ orderBy: { orderIndex: "asc" } });
  return rows.map((l) => ({
    id: l.id, title: l.title, description: l.description,
    base_reward_points: l.baseRewardPoints, order_index: l.orderIndex,
  }));
}

export async function updateLevelAdmin(id: string, level: AdminLevelItem): Promise<void> {
  await db.level.update({
    where: { id },
    data: { title: level.title, description: level.description, baseRewardPoints: level.base_reward_points, orderIndex: level.order_index },
  });
}

export async function createLevelAdmin(level: AdminLevelItem): Promise<void> {
  await db.level.create({
    data: {
      id: level.id, title: level.title, description: level.description,
      baseRewardPoints: level.base_reward_points, orderIndex: level.order_index,
    },
  });
}

export async function getTopicsAdmin(levelId: string): Promise<AdminTopicItem[]> {
  const rows = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
  return rows.map((t) => ({ id: t.id, level_id: t.levelId, title: t.title, order_index: t.orderIndex }));
}

export async function updateTopicAdmin(id: number, title: string, orderIndex: number): Promise<void> {
  await db.topic.update({ where: { id }, data: { title, orderIndex } });
}

export async function createTopicAdmin(levelId: string, title: string, orderIndex: number): Promise<void> {
  await db.topic.create({ data: { levelId, title, orderIndex } });
}

export async function getAppConfigsAdmin(): Promise<{ key: string; value: string; description: string | null }[]> {
  const rows = await db.appConfig.findMany({ orderBy: { key: "asc" } });
  return rows.map((c) => ({ key: c.key, value: c.value, description: c.description }));
}

export async function updateAppConfigAdmin(key: string, value: string): Promise<void> {
  await db.appConfig.update({ where: { key }, data: { value } });
}

export async function getMissionConfigsAdmin(): Promise<AdminMissionConfigItem[]> {
  const rows = await db.missionConfig.findMany({ orderBy: { id: "asc" } });
  return rows.map((c) => ({
    id: c.id, name: c.name,
    lesson_target: c.lessonTarget ?? 1, quiz_target: c.quizTarget ?? 1,
    weakness_target: c.weaknessTarget ?? 3,
    flashcard_target_min: c.flashcardTargetMin ?? 5, flashcard_target_max: c.flashcardTargetMax ?? 15,
  }));
}

export async function updateMissionConfigAdmin(id: number, cfg: {
  lessonTarget: number; quizTarget: number; weaknessTarget: number;
  flashcardTargetMin: number; flashcardTargetMax: number;
}): Promise<void> {
  await db.missionConfig.update({
    where: { id },
    data: {
      lessonTarget: cfg.lessonTarget, quizTarget: cfg.quizTarget, weaknessTarget: cfg.weaknessTarget,
      flashcardTargetMin: cfg.flashcardTargetMin, flashcardTargetMax: cfg.flashcardTargetMax,
    },
  });
}

export type ContentUnit = { kind: "lesson" | "quiz"; goal: string; part: number; modifier: string };

export interface ContentWorkOptions {
  parts: number;
  lessonModifiers: string[];
  quizVariants: number;
  generalPracticeVariants: number;
}

// Target minimal per level: lesson 3 bagian per goal (modifier normal), quiz 1 per goal, exam 1, general_practice 1.
// Varian quiz boleh ditambah hingga CONTENT_QUIZ_MAX_VARIANTS (10) per goal (panel & action).
export const CONTENT_EXAM_VARIANTS = 1;
export const CONTENT_GENERAL_PRACTICE_VARIANTS = 1;
export const CONTENT_PARTS = 3;
export const CONTENT_LESSON_MODIFIERS = ["normal"] as const;
export const CONTENT_QUIZ_VARIANTS = 1;
export const CONTENT_QUIZ_MAX_VARIANTS = 10;

// Work list deterministik untuk bulk pre-generation konten (language, level):
// lesson per (goal, part, modifier) + quiz per (goal, modifier "normal") + exam + general_practice.
export function buildContentWorkList(topics: string[], opts: ContentWorkOptions): ContentUnit[] {
  const units: ContentUnit[] = [];
  const { parts, lessonModifiers, quizVariants, generalPracticeVariants } = opts;
  for (const goal of topics) {
    for (const modifier of lessonModifiers) {
      for (let part = 1; part <= parts; part++) {
        units.push({ kind: "lesson", goal, part, modifier });
      }
    }
    for (let v = 1; v <= quizVariants; v++) {
      units.push({ kind: "quiz", goal, part: 0, modifier: "normal" });
    }
  }
  for (let v = 1; v <= CONTENT_EXAM_VARIANTS; v++) {
    units.push({ kind: "quiz", goal: "exam", part: 0, modifier: "normal" });
  }
  for (let v = 1; v <= generalPracticeVariants; v++) {
    units.push({ kind: "quiz", goal: "general_practice", part: 0, modifier: "normal" });
  }
  return units;
}

// ===== Engine bulk pre-generation (dipakai action manual + background workflow) =====

export interface ContentGoalStatus {
  goal: string;
  lessonDone: number;
  lessonTotal: number;
  quizDone: number;
  quizTotal: number;
  done: number;
  total: number;
}

export interface ContentLevelStatus {
  levelId: string;
  title: string;
  lessonDone: number;
  lessonTotal: number;
  quizDone: number;
  quizTotal: number;
  done: number;
  total: number;
  goals: ContentGoalStatus[];
}

export interface LanguageContentStatus {
  levels: ContentLevelStatus[];
  done: number;
  total: number;
}

// Status kelengkapan konten per bahasa (SEMUA level; default: bagian 1-3, semua modifier, 5 varian quiz, 5 exam, 15 pool).
// Idempotent: dihitung dari baris cache yang sudah ada → resume aman dari posisi mana pun.
export async function resolveLanguageContentStatus(language: string): Promise<LanguageContentStatus> {
  const [levels, topics, lessons, quizzes] = await Promise.all([
    db.level.findMany({ orderBy: { orderIndex: "asc" } }),
    db.topic.findMany({ orderBy: { orderIndex: "asc" } }),
    db.cachedLesson.findMany({ where: { language }, select: { level: true, goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language }, select: { level: true, goal: true, modifier: true } }),
  ]);

  const lessonKeys = new Set(lessons.map((l) => `${l.level}|${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.level}|${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }

  const levelStatuses: ContentLevelStatus[] = [];
  let totalDone = 0;
  let totalAll = 0;

  for (const level of levels) {
    const levelTopics = topics.filter((t) => t.levelId === level.id);
    if (levelTopics.length === 0) continue; // level tanpa topik tidak dihitung
    const units = buildContentWorkList(levelTopics.map((t) => t.title), {
      parts: CONTENT_PARTS,
      lessonModifiers: [...CONTENT_LESSON_MODIFIERS],
      quizVariants: CONTENT_QUIZ_VARIANTS,
      generalPracticeVariants: CONTENT_GENERAL_PRACTICE_VARIANTS,
    });

    const goalMap = new Map<string, ContentGoalStatus>();
    const quizPos = new Map<string, number>();
    let levelDone = 0;

    for (const u of units) {
      let g = goalMap.get(u.goal);
      if (!g) {
        g = { goal: u.goal, lessonDone: 0, lessonTotal: 0, quizDone: 0, quizTotal: 0, done: 0, total: 0 };
        goalMap.set(u.goal, g);
      }
      let isDone: boolean;
      if (u.kind === "lesson") {
        g.lessonTotal++;
        isDone = lessonKeys.has(`${level.id}|${u.goal}|${u.part}|${u.modifier}`);
        if (isDone) g.lessonDone++;
      } else {
        // display: varian aktual (cap CONTENT_QUIZ_MAX_VARIANTS) vs maks 10;
        // kelengkapan unit (readiness) tetap dari posisi unit tunggal di work list
        const key = `${level.id}|${u.goal}|${u.modifier}`;
        const pos = (quizPos.get(key) ?? 0) + 1;
        quizPos.set(key, pos);
        const count = quizCounts.get(key) ?? 0;
        isDone = pos <= count;
        g.quizTotal = CONTENT_QUIZ_MAX_VARIANTS;
        g.quizDone = Math.min(count, CONTENT_QUIZ_MAX_VARIANTS);
      }
      if (isDone) levelDone++;
    }

    const goals = [...goalMap.values()].map((g) => ({
      ...g,
      done: g.lessonDone + g.quizDone,
      total: g.lessonTotal + g.quizTotal,
    }));
    levelStatuses.push({
      levelId: level.id,
      title: level.title,
      lessonDone: goals.reduce((s, g) => s + g.lessonDone, 0),
      lessonTotal: goals.reduce((s, g) => s + g.lessonTotal, 0),
      quizDone: goals.reduce((s, g) => s + g.quizDone, 0),
      quizTotal: goals.reduce((s, g) => s + g.quizTotal, 0),
      done: levelDone,
      total: units.length,
      goals,
    });
    totalDone += levelDone;
    totalAll += units.length;
  }

  return { levels: levelStatuses, done: totalDone, total: totalAll };
}

// Ambil hingga `n` unit berikutnya yang belum ada di cache untuk (language, level).
// Unit yang gagal AI >= 3x di-skip SEMENTARA (cooldown 30 menit sejak kegagalan terakhir) —
// setelah cooldown dicoba lagi otomatis (anti-deadlock sekaligus anti-skip-permanen).
export async function findNextUndoneUnits(language: string, levelId: string, n: number): Promise<ContentUnit[]> {
  const topics = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
  const units = buildContentWorkList(topics.map((t) => t.title), {
    parts: CONTENT_PARTS,
    lessonModifiers: [...CONTENT_LESSON_MODIFIERS],
    quizVariants: CONTENT_QUIZ_VARIANTS,
    generalPracticeVariants: CONTENT_GENERAL_PRACTICE_VARIANTS,
  });

  const [lessons, quizzes, failed] = await Promise.all([
    db.cachedLesson.findMany({ where: { language, level: levelId }, select: { goal: true, part: true, modifier: true } }),
    db.cachedQuiz.findMany({ where: { language, level: levelId }, select: { goal: true, modifier: true } }),
    db.failedContentUnit.findMany({ where: { language, level: levelId, failures: { gte: FAILED_SKIP_THRESHOLD } } }),
  ]);
  const lessonKeys = new Set(lessons.map((l) => `${l.goal}|${l.part}|${l.modifier}`));
  const quizCounts = new Map<string, number>();
  for (const q of quizzes) {
    const key = `${q.goal}|${q.modifier}`;
    quizCounts.set(key, (quizCounts.get(key) ?? 0) + 1);
  }
  const now = Date.now();
  const skippedKeys = new Set(
    failed
      .filter((f) => now - f.lastFailedAt.getTime() < FAILED_COOLDOWN_MS)
      .map((f) => `${f.goal}|${f.part}|${f.modifier}`)
  );

  const quizPos = new Map<string, number>();
  const found: ContentUnit[] = [];
  for (const u of units) {
    if (skippedKeys.has(`${u.goal}|${u.part}|${u.modifier}`)) continue;
    let isDone: boolean;
    if (u.kind === "lesson") {
      isDone = lessonKeys.has(`${u.goal}|${u.part}|${u.modifier}`);
    } else {
      const key = `${u.goal}|${u.modifier}`;
      const pos = (quizPos.get(key) ?? 0) + 1;
      quizPos.set(key, pos);
      isDone = pos <= (quizCounts.get(key) ?? 0);
    }
    if (!isDone) {
      found.push(u);
      if (found.length >= n) break;
    }
  }
  return found;
}

// Unit berikutnya yang belum ada di cache (untuk action manual — 1 unit/panggilan).
export async function findNextUndoneUnit(language: string, levelId: string): Promise<ContentUnit | null> {
  const units = await findNextUndoneUnits(language, levelId, 1);
  return units[0] ?? null;
}

// Generate satu unit konten (lesson / quiz goal / exam / general_practice) lalu simpan ke cache.
// Anti-duplikat: hasil dibandingkan dengan varian existing (pertanyaan/judul+konten) — jika mirip,
// generate ulang otomatis (maks 3x); tetap mirip → throw error jujur.
export async function generateOneContentUnit(language: string, unit: ContentUnit, levelId: string): Promise<void> {
  const MAX_RETRY = 3;
  if (unit.kind === "lesson") {
    const existing = await db.cachedLesson.findMany({
      where: { language, level: levelId, goal: unit.goal },
      select: { contentJson: true },
    });
    const existingTitles = existing.map((e) => {
      const p = JSON.parse(e.contentJson) as { title?: string };
      return p.title ?? "";
    });
    const existingContents = existing.map((e) => {
      const p = JSON.parse(e.contentJson) as { content?: string };
      return p.content ?? "";
    });
    let lesson: Awaited<ReturnType<typeof generateLesson>> | null = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      const candidate = await generateLesson({ language, level: levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier });
      if (!hasDuplicateLesson(existingTitles, existingContents, candidate.title, candidate.content)) {
        lesson = candidate;
        break;
      }
    }
    if (!lesson) throw new Error("Hasil generate mirip dengan materi yang sudah ada — coba lagi.");
    await db.cachedLesson.create({
      data: { language, level: levelId, goal: unit.goal, part: unit.part, modifier: unit.modifier, contentJson: JSON.stringify(lesson) },
    });
  } else {
    const existing = await db.cachedQuiz.findMany({
      where: { language, level: levelId, goal: unit.goal, modifier: "normal" },
      select: { contentJson: true },
    });
    const existingQuestions = existing.flatMap((e) => {
      try {
        const p = JSON.parse(e.contentJson) as { questions?: { question?: string; listen_text?: string }[] };
        return p.questions?.map((q) => ({ question: q.question ?? "", listenText: q.listen_text ?? "" })) ?? [];
      } catch {
        return [];
      }
    });

    let quiz: Awaited<ReturnType<typeof generateQuizWithPrompt>> | null = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      let candidate: Awaited<ReturnType<typeof generateQuizWithPrompt>>;
      if (unit.goal === "exam") {
        const topics = await db.topic.findMany({ where: { levelId }, orderBy: { orderIndex: "asc" } });
        const topicsStr = topics.map((t) => t.title).join(", ") || "Grammar lanjutan, vocabulary tingkat tinggi, reading comprehension, dan listening";
        candidate = await generateExam({ language, level: levelId, topicsStr });
      } else if (unit.goal === "general_practice") {
        // pool general practice: tema acak tiap varian agar variasi besar
        const theme = GENERAL_PRACTICE_THEMES[Math.floor(Math.random() * GENERAL_PRACTICE_THEMES.length)];
        candidate = await generateQuizWithPrompt({
          prompt: buildGeneralPracticePrompt(language, levelId, theme),
          expectedCount: 5,
          label: "general practice quiz",
        });
      } else {
        candidate = await generateQuizWithPrompt({
          prompt: buildQuizPrompt(language, levelId, unit.goal, "(belum ada riwayat kelemahan)"),
          expectedCount: 5,
          label: "quiz",
        });
      }
      if (
        !hasDuplicateQuiz(
          existingQuestions,
          candidate.questions.map((q) => ({ question: q.question, listenText: q.listen_text ?? "" }))
        )
      ) {
        quiz = candidate;
        break;
      }
    }
    if (!quiz) throw new Error("Hasil generate mirip dengan varian yang sudah ada — coba lagi.");
    await db.cachedQuiz.create({
      data: { language, level: levelId, goal: unit.goal, modifier: "normal", contentJson: JSON.stringify(quiz) },
    });
  }
}

// Unit gagal AI di-skip SEMENTARA (cooldown), bukan permanen — setelah cooldown dicoba lagi otomatis.
export const FAILED_SKIP_THRESHOLD = 3;
export const FAILED_COOLDOWN_MS = 30 * 60 * 1000;

export async function getFailedContentUnitCount(language: string): Promise<number> {
  return db.failedContentUnit.count({ where: { language } });
}

export async function resetFailedContentUnits(language: string): Promise<void> {
  await db.failedContentUnit.deleteMany({ where: { language } });
}
