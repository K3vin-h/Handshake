import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProgress, mergeState } from "./merge.ts";
import type { Progress, ItemState } from "./progress.ts";

const it = (attempts: number, extra: Partial<ItemState> = {}): ItemState => ({ streak: 0, mastered: false, box: 0, due: 0, attempts, misses: 0, ...extra });
const P = (o: Partial<Progress> = {}): Progress => ({ xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: {}, ...o });

test("completed is the union, xp the larger", () => {
  const r = mergeProgress(P({ xp: 30, completed: ["1.1", "1.2"] }), P({ xp: 50, completed: ["1.2", "1.3"] }));
  assert.deepEqual([...r.completed].sort(), ["1.1", "1.2", "1.3"]);
  assert.equal(r.xp, 50);
});

test("later lastActiveDay wins the streak; tie takes larger streakDays", () => {
  const a = P({ streakDays: 5, lastActiveDay: "2026-11-06" });
  const b = P({ streakDays: 2, lastActiveDay: "2026-11-07" });
  assert.equal(mergeProgress(a, b).streakDays, 2);
  assert.equal(mergeProgress(b, a).lastActiveDay, "2026-11-07");
  const c = P({ streakDays: 9, lastActiveDay: "2026-11-07" });
  assert.equal(mergeProgress(b, c).streakDays, 9);
  assert.equal(mergeProgress(c, b).streakDays, 9);
});

test("items: more attempts wins, tie goes to the server (second arg)", () => {
  const local = P({ items: { A: it(5, { streak: 1 }), B: it(2, { streak: 7 }), C: it(1) } });
  const server = P({ items: { A: it(3, { streak: 2 }), B: it(2, { streak: 9 }), D: it(4) } });
  const r = mergeProgress(local, server);
  assert.equal(r.items.A.attempts, 5);
  assert.equal(r.items.B.streak, 9);
  assert.deepEqual(Object.keys(r.items).sort(), ["A", "B", "C", "D"]);
});

test("never smaller than either side", () => {
  const a = P({ xp: 10, completed: ["1.1"] });
  const b = P({ xp: 4, completed: ["1.2"] });
  for (const r of [mergeProgress(a, b), mergeProgress(b, a)]) {
    assert.ok(r.xp >= 10);
    assert.ok(r.completed.includes("1.1") && r.completed.includes("1.2"));
  }
});

test("merging with empty progress returns the other side unchanged", () => {
  const x = P({ xp: 12, streakDays: 3, lastActiveDay: "2026-11-05", completed: ["1.1"], items: { A: it(2) } });
  assert.deepEqual(mergeProgress(P(), x), x);
  assert.deepEqual(mergeProgress(x, P()), x);
});

test("mergeState: server profile wins when server has state, local wins when none", () => {
  const lp = { userName: "Ryan", theirName: "Lily", leftHanded: false };
  const sp = { userName: "Sam", theirName: "Jo", leftHanded: true };
  assert.deepEqual(mergeState({ profile: lp, progress: P() }, { profile: sp, progress: P() }).profile, sp);
  assert.deepEqual(mergeState({ profile: lp, progress: P({ xp: 3 }) }, null).profile, lp);
  assert.equal(mergeState({ profile: lp, progress: P({ xp: 3 }) }, null).progress.xp, 3);
  assert.deepEqual(mergeState({ profile: lp, progress: P() }, { profile: null, progress: P() }).profile, lp);
});
