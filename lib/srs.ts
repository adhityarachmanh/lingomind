export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsResult extends SrsState {
  dueAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function srsReview(prev: SrsState, remembered: boolean, now = new Date()): SrsResult {
  if (!remembered) {
    return {
      easeFactor: Math.max(1.3, prev.easeFactor - 0.2),
      intervalDays: 0,
      repetitions: 0,
      dueAt: new Date(now.getTime() + 10 * 60 * 1000),
    };
  }
  const repetitions = prev.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = 1;
  } else if (repetitions === 2) {
    intervalDays = 3;
  } else {
    intervalDays = Math.max(1, Math.round(prev.intervalDays * prev.easeFactor));
  }
  return {
    easeFactor: prev.easeFactor,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
