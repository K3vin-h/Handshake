import { test } from "node:test";
import assert from "node:assert/strict";
import { reportAttempt } from "./track.ts";

const ID = "11111111-1111-4111-8111-111111111111";
test("reports a measured attempt without profile data or snapshots", () => {
  const calls: { url: string; body: unknown }[] = [];
  reportAttempt("L", false, ["thumb:placement"], async (url, body) => { calls.push({ url, body }); }, ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/attempts");
  const body = calls[0].body as { learnerId: string; attempts: { item: string; correct: boolean; codes: string[]; ts: number }[] };
  assert.equal(body.learnerId, ID);
  assert.equal(body.attempts[0].item, "L");
  assert.equal(body.attempts[0].correct, false);
  assert.deepEqual(body.attempts[0].codes, ["thumb:placement"]);
  assert.ok(Math.abs(body.attempts[0].ts - Date.now()) < 1000);
  assert.deepEqual(Object.keys(body).sort(), ["attempts", "learnerId"]);
  assert.deepEqual(Object.keys(body.attempts[0]).sort(), ["codes", "correct", "item", "ts"]);
});

test("never sends fingerspelled words, names or malformed ids as practice items", () => {
  let calls = 0;
  for (const item of ["fs:LILY", "fs:Ryan", "", "Ryan", "<script>"]) {
    reportAttempt(item, true, [], async () => { calls++; }, ID);
  }
  assert.equal(calls, 0);
});

test("network failures never throw or produce an unhandled rejection", async () => {
  assert.doesNotThrow(() => reportAttempt("L", true, [], () => { throw new Error("offline"); }, ID));
  assert.doesNotThrow(() => reportAttempt("L", true, [], async () => { throw new Error("offline"); }, ID));
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("lesson events require opt-in and remain non-blocking offline", async () => {
  const { reportLessonComplete } = await import("./track.ts");
  const calls: unknown[] = [];
  const send = async (url: string, body: unknown) => { calls.push({ url, body }); };
  reportLessonComplete("1.2", 20, send, ID, false);
  assert.equal(calls.length, 0);
  reportLessonComplete("1.2", 20, send, ID, true);
  assert.deepEqual(calls, [{ url: "/api/lesson-complete", body: { learnerId: ID, lessonId: "1.2", xp: 20 } }]);
  assert.doesNotThrow(() => reportLessonComplete("1.2", 20, () => { throw new Error("offline"); }, ID, true));
  reportLessonComplete("1.2", 20, async () => { throw new Error("offline"); }, ID, true);
  await new Promise(resolve => setTimeout(resolve, 0));
});
