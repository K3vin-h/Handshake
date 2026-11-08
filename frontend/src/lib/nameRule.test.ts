import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, validName, validTheirName } from "./nameRule.ts";

test("names the server rejects are cleaned to ones it accepts", () => {
  for (const [raw, want] of [["Ryan2", "Ryan"], ["J.R.", "JR"], ["Zoe!", "Zoe"], ["O’Brien", "O'Brien"], ["  Mary   Ann ", "Mary Ann"]]) {
    assert.equal(cleanName(raw), want);
    assert.ok(validName(cleanName(raw)));
  }
  for (const bad of ["Ryan2", "J.R.", "Zoe!", "O’Brien", ""]) assert.equal(validName(bad), false);
});
test("already-valid names are unchanged", () => {
  for (const n of ["Anne-Marie", "Mary Ann", "O'Brien", "Lily"]) {
    assert.ok(validName(n));
    assert.equal(cleanName(n), n);
  }
});
test("cap at 40", () => assert.equal(cleanName("a".repeat(60)).length, 40));
test("theirName may be empty (solo learner); other names may not", () => {
  assert.equal(validTheirName(""), true);
  assert.equal(validTheirName(cleanName("")), true);
  assert.equal(validTheirName("Lily"), true);
  for (const bad of ["L2", "a".repeat(41), null, undefined, 5, ["Lily"]]) assert.equal(validTheirName(bad), false, String(bad));
  assert.equal(validName(""), false);
});
