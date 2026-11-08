import { test } from "node:test";
import assert from "node:assert/strict";
import { liveStreak, touchStreak } from "./streak.ts";

// Times are built from LOCAL calendar parts, so these tests hold in any timezone.
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).getTime();

test("practising twice on the same local day (morning, then late evening) is a 1-day streak", () => {
  let s = touchStreak(0, null, at(7, 9));
  s = touchStreak(s.streakDays, s.lastActiveDay, at(7, 23));
  assert.equal(s.streakDays, 1);
});

test("the next local day adds one; a skipped day starts again at 1", () => {
  let s = touchStreak(0, null, at(7, 20));
  s = touchStreak(s.streakDays, s.lastActiveDay, at(8, 8));
  assert.equal(s.streakDays, 2);
  s = touchStreak(s.streakDays, s.lastActiveDay, at(10, 8));
  assert.equal(s.streakDays, 1);
});

test("a stored streak that has lapsed reads as 0, a live one is kept", () => {
  assert.equal(liveStreak(3, "2020-01-01", at(7, 12)), 0);
  assert.equal(liveStreak(3, "2026-11-06", at(7, 12)), 3); // practised yesterday: still alive
  assert.equal(liveStreak(3, "2026-11-07", at(7, 12)), 3);
});
