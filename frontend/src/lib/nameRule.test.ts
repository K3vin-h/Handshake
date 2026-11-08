import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, validName } from "./nameRule.ts";

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
