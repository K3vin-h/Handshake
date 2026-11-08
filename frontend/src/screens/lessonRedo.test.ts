import { test } from "node:test";
import assert from "node:assert/strict";
import { clearRedo, loadRedo, saveRedo } from "./lessonRedo.ts";

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };

test("what is left in a lesson is kept per lesson, and cleared when done", () => {
  assert.equal(loadRedo("1.1"), null);
  saveRedo("1.1", [{ kind: "check", letter: "R" }]);
  saveRedo("2.1", [{ kind: "check", letter: "B" }]);
  assert.deepEqual(loadRedo("1.1"), [{ kind: "check", letter: "R" }]);
  clearRedo("1.1");
  assert.equal(loadRedo("1.1"), null);
  assert.equal(loadRedo("2.1")?.length, 1);
});
