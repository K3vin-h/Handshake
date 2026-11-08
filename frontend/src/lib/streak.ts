// Daily practice streak rules. No imports, so `node --test` can run it (same idea as mistakes.ts).
// Days are the learner's LOCAL calendar days. This used to use toISOString(), which is the UTC date: in the evening
// (e.g. after 4 pm in Vancouver) UTC is already "tomorrow", so one real day could count as two and inflate the streak.

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = (now = Date.now()) => dayKey(new Date(now));
export const yesterdayOf = (now = Date.now()) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1); // calendar step, so it stays right across daylight-saving changes
  return dayKey(d);
};

/** Streak after practicing at `now`: same day keeps it, the day after adds one, any gap starts again at 1. */
export function touchStreak(streakDays: number, lastActiveDay: string | null, now = Date.now()) {
  const t = today(now);
  if (lastActiveDay === t) return { streakDays, lastActiveDay };
  return { streakDays: lastActiveDay === yesterdayOf(now) ? streakDays + 1 : 1, lastActiveDay: t };
}

/** Streak to SHOW: one that was not extended today or yesterday has lapsed, so it reads 0 instead of an old number. */
export function liveStreak(streakDays: number, lastActiveDay: string | null, now = Date.now()) {
  return lastActiveDay === today(now) || lastActiveDay === yesterdayOf(now) ? streakDays : 0;
}
