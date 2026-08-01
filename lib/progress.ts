export interface StreakInput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  streakFreezes: number;
  hasWeekendAmulet: boolean | null;
}

export interface StreakOutput {
  currentStreak: number;
  previousStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastActiveDate: Date;
}

function dayNumber(dt: Date): number {
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function computeStreakAfterActivity(input: StreakInput, now: Date): StreakOutput {
  const today = dayNumber(now);
  const last = input.lastActiveDate ? dayNumber(input.lastActiveDate) : null;
  const diff = last === null ? Number.POSITIVE_INFINITY : Math.round((today - last) / 86400000);
  const dow = now.getUTCDay(); // 0=Sunday, 1=Monday, 6=Saturday
  const amulet = input.hasWeekendAmulet === true;

  let current: number;
  let previous = input.previousStreak;
  let freezes = input.streakFreezes;

  if (last === null) {
    current = 1;
  } else if (diff <= 0) {
    current = input.currentStreak; // same day
  } else if (diff === 1) {
    current = input.currentStreak + 1;
  } else if (freezes >= diff - 1) {
    current = input.currentStreak + 1;
    freezes -= diff - 1;
  } else if (amulet && dow === 1 && diff <= 3) {
    current = input.currentStreak + 1; // Monday, weekend amulet
  } else if (amulet && dow === 0 && diff <= 2) {
    current = input.currentStreak + 1; // Sunday, weekend amulet
  } else {
    previous = input.currentStreak;
    current = 1;
  }

  const longest = Math.max(input.longestStreak, current);
  return { currentStreak: current, previousStreak: previous, longestStreak: longest, streakFreezes: freezes, lastActiveDate: new Date(today) };
}

export interface QuizOutcomeInput {
  baseLevel: string;
  topicIdx: number;
  topicsInLevel: number;
  playedTopicIdx: number;
  ptsPerQuestion: number;
  scoreGained: number;
}

export function computeQuizOutcome(input: QuizOutcomeInput): { passed: boolean; newTopicIdx: number } {
  const requiredScore = input.ptsPerQuestion * 5;
  const passed = input.scoreGained >= requiredScore && input.playedTopicIdx === input.topicIdx;
  let newTopicIdx = input.topicIdx;
  if (passed && input.topicIdx < input.topicsInLevel) {
    newTopicIdx += 1;
  }
  return { passed, newTopicIdx };
}
