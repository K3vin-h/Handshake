import { test } from "node:test";
import assert from "node:assert/strict";
import {
  letterBars, strongAndWeak, masteryCounts, almostThere, fingerBars, kindCounts, topMistake, boxCounts, reviewPlan,
} from "./progressStats.ts";

const DAY = 86_400_000;
const it = (o: Partial<{ streak: number; mastered: boolean; box: number; due: number; attempts: number; misses: number }> = {}) =>
  ({ streak: 0, mastered: false, box: 0, due: 0, attempts: 0, misses: 0, ...o });

test("letterBars skips untried letters and computes share", () => {
  const bars = letterBars({ B: it({ attempts: 4, misses: 1 }), A: it({ attempts: 2, misses: 0 }), C: it() });
  assert.deepEqual(bars, [
    { letter: "A", attempts: 2, matched: 2, share: 1 },
    { letter: "B", attempts: 4, matched: 3, share: 0.75 },
  ]);
});

test("strongAndWeak", () => {
  assert.deepEqual(strongAndWeak({}), { strong: [], weak: [] });
  const r = strongAndWeak({
    A: it({ attempts: 5, misses: 0 }),
    B: it({ attempts: 4, misses: 3 }),
    C: it({ attempts: 2, misses: 2 }),
    D: it({ mastered: true, attempts: 3, misses: 2 }),
    E: it({ attempts: 2, misses: 0 }), // only 2 tries: not strong
    F: it({ attempts: 1, misses: 1 }), // 1 try: not weak
  });
  assert.deepEqual(r.strong, ["A", "D"]);
  assert.deepEqual(r.weak, ["C", "B"]);
});

test("strongAndWeak caps at 3", () => {
  const items: Record<string, ReturnType<typeof it>> = {};
  for (const l of "ABCDE") items[l] = it({ attempts: 5, misses: 0 });
  assert.equal(strongAndWeak(items).strong.length, 3);
});

test("masteryCounts", () => {
  assert.deepEqual(
    masteryCounts({ A: it({ mastered: true, attempts: 3 }), B: it({ attempts: 1 }), C: it() }),
    { mastered: 1, practising: 1 },
  );
});

test("almostThere", () => {
  assert.deepEqual(almostThere({ B: it({ streak: 2 }), A: it({ streak: 1 }) }), { letter: "B", need: 1 });
  assert.equal(almostThere({ B: it({ streak: 3, mastered: true }) }), null);
  assert.equal(almostThere({}), null);
});

const m = {
  D: { "index:curl": { count: 3, lastAt: 1 }, "thumb:placement": { count: 1, lastAt: 1 } },
  Y: { "index:curl": { count: 1, lastAt: 1 }, nonsense: { count: 9, lastAt: 1 } },
  L: { "pinky:direction": { count: 2, lastAt: 1 } },
};

test("fingerBars zero-fills and ignores malformed codes", () => {
  assert.deepEqual(fingerBars(m, ["thumb", "index", "middle", "ring", "pinky"]), [
    { finger: "thumb", count: 1 }, { finger: "index", count: 4 }, { finger: "middle", count: 0 },
    { finger: "ring", count: 0 }, { finger: "pinky", count: 2 },
  ]);
});

test("kindCounts", () => {
  assert.deepEqual(kindCounts(m), { curl: 4, direction: 2, placement: 1 });
});

test("topMistake", () => {
  assert.deepEqual(topMistake(m), { finger: "index", kind: "curl", count: 4, letters: ["D", "Y"] });
  assert.equal(topMistake({}), null);
});

test("boxCounts has length 5", () => {
  assert.deepEqual(boxCounts({ A: it({ box: 0 }), B: it({ box: 4 }), C: it({ box: 4 }) }), [1, 0, 0, 0, 2]);
  assert.equal(boxCounts({}).length, 5);
});

test("reviewPlan buckets by whole days", () => {
  const now = 1_000_000_000;
  const r = reviewPlan({
    A: it({ attempts: 1, due: now - DAY }),
    B: it({ attempts: 1, due: now + 2 * DAY }),
    C: it({ attempts: 1, due: now + DAY }),
    D: it({ attempts: 1, due: now + 5 * DAY }),
    E: it({ attempts: 1, due: now + 30 * DAY }),
    F: it({ attempts: 0, due: now - DAY }),
  }, now);
  assert.deepEqual(r, { today: ["A"], tomorrow: ["C"], threeDays: ["B"], week: ["D"], later: ["E"] });
});

test("strongAndWeak never lists a letter with no attempts", () => {
  const r = strongAndWeak({ A: it({ attempts: 0, mastered: true }), B: it({ attempts: 0, mastered: false }) });
  assert.deepEqual(r, { strong: [], weak: [] });
});

test("reviewPlan day boundaries", () => {
  const now = 1_000_000_000;
  const r = reviewPlan({
    A: it({ attempts: 1, due: now }),
    B: it({ attempts: 1, due: now + DAY / 2 }),
    C: it({ attempts: 1, due: now + 3 * DAY }),
    G: it({ attempts: 1, due: now + 3 * DAY + 1 }),
    D: it({ attempts: 1, due: now + 4 * DAY }),
    E: it({ attempts: 1, due: now + 7 * DAY }),
    F: it({ attempts: 1, due: now + 8 * DAY }),
  }, now);
  assert.deepEqual(r, { today: ["A"], tomorrow: ["B"], threeDays: ["C"], week: ["D", "E", "G"].sort(), later: ["F"] });
});
