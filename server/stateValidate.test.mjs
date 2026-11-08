import { test } from "node:test";
import assert from "node:assert/strict";
import { validateState } from "./stateValidate.mjs";

const good = () => ({
  profile: { userName: "Ryan", theirName: "Lily", relationship: "coworker", leftHanded: false, practiceWords: { "1.1": ["LILY"] }, wordPack: ["HELLO"] },
  progress: { xp: 10, streakDays: 2, lastActiveDay: "2026-11-07", completed: ["1.1"], items: { "L": { streak: 1, box: 2, attempts: 3, misses: 0, due: 123.5, mastered: false } } },
  baseRev: 0,
});
const bad = (mut) => { const b = good(); mut(b); return validateState(b); };
const item = () => ({ streak: 0, box: 1, attempts: 0, misses: 0, due: 0, mastered: false });

test("valid body round-trips, extra keys dropped", () => {
  const b = good();
  assert.deepEqual(JSON.parse(JSON.stringify(validateState(b))), b);
  b.extra = 1; b.profile.x = 1; b.progress.y = 1; b.progress.items.L.z = 1;
  assert.deepEqual(JSON.parse(JSON.stringify(validateState(b))), good());
});
test("optional fields may be absent", () => {
  const b = good(); delete b.profile.relationship; delete b.profile.practiceWords; delete b.profile.wordPack;
  assert.ok(validateState(b));
});
test("rejects each rule", () => {
  for (const [n, m] of Object.entries({
    nonobj: (b) => { b.profile = null; },
    userName: (b) => { b.profile.userName = "R2"; },
    theirName: (b) => { b.profile.theirName = ""; },
    relationship: (b) => { b.profile.relationship = "boss"; },
    leftHanded: (b) => { b.profile.leftHanded = "no"; },
    lessonId: (b) => { b.profile.practiceWords = { x: ["A"] }; },
    tooManyLessons: (b) => { b.profile.practiceWords = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`1.${i}`, []])); },
    tooManyWords: (b) => { b.profile.practiceWords = { "1.1": Array(13).fill("A") }; },
    badWord: (b) => { b.profile.practiceWords = { "1.1": ["A1"] }; },
    longWord: (b) => { b.profile.practiceWords = { "1.1": ["A".repeat(21)] }; },
    packMany: (b) => { b.profile.wordPack = Array(31).fill("A"); },
    packBad: (b) => { b.profile.wordPack = ["hi"]; },
    xp: (b) => { b.progress.xp = 1_000_001; },
    xpFloat: (b) => { b.progress.xp = 1.5; },
    streak: (b) => { b.progress.streakDays = 10_001; },
    day: (b) => { b.progress.lastActiveDay = "yesterday"; },
    completedMany: (b) => { b.progress.completed = Array(61).fill("a"); },
    completedBad: (b) => { b.progress.completed = ["a b"]; },
    itemKey: (b) => { b.progress.items = { "bad/key": item() }; },
    itemField: (b) => { b.progress.items.L.box = -1; },
    itemBig: (b) => { b.progress.items.L.attempts = 100_001; },
    due: (b) => { b.progress.items.L.due = Infinity; },
    mastered: (b) => { b.progress.items.L.mastered = 1; },
    baseRev: (b) => { b.baseRev = -1; },
    baseRevBig: (b) => { b.baseRev = 1_000_001; },
  })) assert.equal(bad(m), null, n);
});
test("201st item key rejected, 200 ok", () => {
  const mk = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, item()]));
  assert.ok(bad((b) => { b.progress.items = mk(200); }));
  assert.equal(bad((b) => { b.progress.items = mk(201); }), null);
});
test("__proto__ / constructor / prototype item keys rejected, nothing polluted", () => {
  for (const k of ["__proto__", "constructor", "prototype"]) {
    const b = good();
    b.progress.items = JSON.parse(`{"${k}": ${JSON.stringify(item())}}`);
    assert.equal(validateState(b), null, k);
  }
  assert.equal({}.streak, undefined);
});
