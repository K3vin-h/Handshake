import { test } from "node:test";
import assert from "node:assert/strict";
import { alphabetStates, newlyEarned } from "./alphabetState.ts";

const lessons = [
  { id: "1.1", teaches: ["L", "I", "Y"] },
  { id: "2.1", teaches: ["B", "C", "O"] },
  { id: "2.2", teaches: ["D", "I", "L", "Y"] },
  { id: "2.8", teaches: ["J", "Z"] },
  { id: "1.2" },
];

test("mastered letters are done, letters of an unlocked lesson are open, the rest are locked", () => {
  const s = alphabetStates({
    lessons,
    unlocked: new Set(["1.1", "1.2", "2.1"]),
    completed: ["1.1"],
    items: { L: { mastered: true }, I: { mastered: true }, Y: { mastered: false }, B: { mastered: false } },
  });
  assert.equal(s.L, "done");
  assert.equal(s.I, "done");
  assert.equal(s.Y, "open"); // taught, not yet 3 in a row
  assert.equal(s.B, "open");
  assert.equal(s.D, "locked"); // only taught by lesson 2.2, which is locked
  assert.equal(s.A, "locked"); // taught by no lesson
  assert.equal(Object.keys(s).length, 26);
});

test("a mastered letter stays done even if its lessons are not listed as unlocked", () => {
  const s = alphabetStates({ lessons, unlocked: new Set(), completed: [], items: { D: { mastered: true } } });
  assert.equal(s.D, "done");
});

test("J and Z are self-checked: done once a lesson teaching them is completed", () => {
  const before = alphabetStates({ lessons, unlocked: new Set(["2.8"]), completed: [], items: {} });
  assert.equal(before.J, "open");
  const after = alphabetStates({ lessons, unlocked: new Set(["2.8"]), completed: ["2.8"], items: {} });
  assert.equal(after.J, "done");
  assert.equal(after.Z, "done");
});

test("newlyEarned lists the done letters of the lesson just finished", () => {
  const s = alphabetStates({ lessons, unlocked: new Set(["1.1"]), completed: ["1.1"], items: { L: { mastered: true }, I: { mastered: true } } });
  assert.deepEqual(newlyEarned(lessons, "1.1", s), ["L", "I"]);
  assert.deepEqual(newlyEarned(lessons, "1.2", s), []); // lesson that teaches nothing
  assert.deepEqual(newlyEarned(lessons, "nope", s), []);
});
