import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanRequest, lessonLetters } from "./planInput.ts";
import type { Unit } from "./curriculum.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const lesson = (id: string, title: string, steps: any[], teaches?: string[]) => ({ id, title, summary: "", scope: "demo", grading: "auto", xp: 10, steps, teaches });
const units = [
  {
    id: "u1", title: "Introduce yourself", goal: "",
    lessons: [
      lesson("1.1", "Your letters", [{ kind: "learn", letter: "A" }, { kind: "practice", letter: "Y", reps: 3 }], ["A", "Y"]),
      lesson("1.2", "Spell RYAN", [{ kind: "spell", word: "RYAN", showReference: true }]),
      lesson("1.3", "Checkpoint", [{ kind: "contrast", letters: ["I", "L"] }]),
    ],
  },
] as Unit[];

test("lessonLetters collects letters from steps, sorted and unique", () => {
  assert.deepEqual(lessonLetters(units[0].lessons[1]), ["A", "N", "R", "Y"]);
  assert.deepEqual(lessonLetters(units[0].lessons[2]), ["I", "L"]);
});

test("a new learner gets only the next lesson and no known letters", () => {
  const req = buildPlanRequest(units, { completed: [], items: {} }, [], ID)!;
  assert.deepEqual(req.candidates, [{ id: "1.1", letters: ["A", "Y"] }]);
  assert.deepEqual(req.knownLetters, []);
});

test("after a lesson: next lesson first, then completed lessons, known letters from attempts and teaches", () => {
  const req = buildPlanRequest(units, { completed: ["1.1"], items: { L: { attempts: 2 }, "fs:LILY": { attempts: 3 }, HELLO: { attempts: 1 } } }, ["L", "Q"], ID)!;
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.2", "1.1"]);
  assert.deepEqual(req.knownLetters, ["A", "L", "Y"]);
  assert.deepEqual(req.weakLetters, ["L"]);
});

test("review lessons follow completion order, not curriculum order", () => {
  const req = buildPlanRequest(units, { completed: ["1.3", "1.1"], items: {} }, [], ID)!;
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.2", "1.1", "1.3"]);
});

test("stretch lessons are never picked as the next lesson", () => {
  const mixed = [{ id: "u", title: "", goal: "", lessons: [lesson("2.1", "", []), { ...lesson("2.2", "", []), scope: "stretch" }, lesson("3.1", "", [])] }] as Unit[];
  const req = buildPlanRequest(mixed, { completed: ["2.1"], items: {} }, [], ID)!;
  assert.equal(req.candidates[0].id, "3.1");
});

test("returns at most 4 review lessons, never titles, and null with no lessons", () => {
  const many = [{ id: "u", title: "", goal: "", lessons: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"].map((id) => lesson(id, `Secret title ${id}`, [])) }] as Unit[];
  const req = buildPlanRequest(many, { completed: ["1.1", "1.2", "1.3", "1.4", "1.5"], items: {} }, [], ID)!;
  assert.equal(req.candidates.length, 5);
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.6", "1.5", "1.4", "1.3", "1.2"]);
  assert.equal(JSON.stringify(req).includes("Secret title"), false);
  assert.equal(buildPlanRequest([], { completed: [], items: {} }, [], ID), null);
});
