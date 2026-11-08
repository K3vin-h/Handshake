import { flatLessons, type Unit } from "./curriculum";
import { liveStreak, touchStreak } from "./streak";

// Learner progress in localStorage: XP, daily streak, per-item mastery, spaced review.
// Item ids: a letter ("A"), a sign ("HELLO"), or a word ("fs:LILY").
//
// Mastery: 3 correct in a row. Review uses Leitner boxes: each correct review moves an item
// up a box (seen again later); a miss sends it back to box 0 (seen again today).

const KEY = "handshake.progress.v1";
const BOX_DAYS = [0, 1, 3, 7, 14];
const DAY = 86_400_000;

export type ItemState = { streak: number; mastered: boolean; box: number; due: number; attempts: number; misses: number };
export type Progress = {
  xp: number;
  streakDays: number;
  lastActiveDay: string | null;
  completed: string[]; // lesson ids
  items: Record<string, ItemState>;
};

const empty = (): Progress => ({ xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: {} });
export function loadProgress(): Progress {
  try {
    const p: Progress = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    p.streakDays = liveStreak(p.streakDays, p.lastActiveDay); // a lapsed streak reads 0, not an old number
    return p;
  } catch {
    return empty();
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}

/** Call after every graded attempt. Returns the updated progress (also saved). */
export function recordAttempt(p: Progress, itemId: string, correct: boolean, now = Date.now()): Progress {
  const it: ItemState = p.items[itemId] ?? { streak: 0, mastered: false, box: 0, due: now, attempts: 0, misses: 0 };
  it.attempts++;
  if (correct) {
    it.streak++;
    if (it.streak >= 3) it.mastered = true;
    it.box = Math.min(BOX_DAYS.length - 1, it.box + 1);
  } else {
    it.streak = 0;
    it.misses++;
    it.box = 0;
  }
  it.due = now + BOX_DAYS[it.box] * DAY;
  const next = { ...p, items: { ...p.items, [itemId]: it } };
  Object.assign(next, touchStreak(next.streakDays, next.lastActiveDay, now));
  saveProgress(next);
  return next;
}

export function addXp(p: Progress, amount: number): Progress {
  const next = { ...p, xp: p.xp + amount };
  saveProgress(next);
  return next;
}

export function completeLesson(p: Progress, lessonId: string, xp: number): Progress {
  const next = { ...p, xp: p.xp + xp, completed: p.completed.includes(lessonId) ? p.completed : [...p.completed, lessonId] };
  saveProgress(next);
  return next;
}

/** Items due for review (weakest first). Used by "review" steps and the Daily review card. */
export function dueItems(p: Progress, now = Date.now(), limit = 5): string[] {
  return Object.entries(p.items)
    .filter(([, s]) => s.due <= now)
    .sort((a, b) => a[1].box - b[1].box || b[1].misses - a[1].misses)
    .slice(0, limit)
    .map(([id]) => id);
}

/** A lesson is unlocked when the previous DEMO lesson (in path order) is completed. Stretch lessons never gate. */
export function isUnlocked(units: Unit[], p: Progress, lessonId: string): boolean {
  const all = flatLessons(units);
  const i = all.findIndex((l) => l.id === lessonId);
  const prev = all.slice(0, Math.max(0, i)).filter((l) => l.scope === "demo").at(-1);
  return !prev || p.completed.includes(prev.id);
}

/** Next lesson to do (first demo lesson not completed). */
export function nextLesson(units: Unit[], p: Progress) {
  return flatLessons(units).find((l) => l.scope === "demo" && !p.completed.includes(l.id)) ?? null;
}

/** Letters that need practice: most misses relative to attempts. */
export function weakItems(p: Progress, limit = 3): string[] {
  return Object.entries(p.items)
    .filter(([, s]) => s.attempts >= 2 && !s.mastered)
    .sort((a, b) => b[1].misses / b[1].attempts - a[1].misses / a[1].attempts)
    .slice(0, limit)
    .map(([id]) => id);
}
