import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { UUID_RE, ITEM_RE, CODE_RE, LESSON_RE, NAME_RE, isEmail, isLetters } from "./validate.mjs";

test("UUID_RE accepts a v4 uuid and rejects junk", () => {
  assert.ok(UUID_RE.test(randomUUID()));
  assert.equal(UUID_RE.test("not-a-uuid"), false);
});

test("ITEM_RE accepts letters and sign ids, rejects fingerspelled words", () => {
  for (const ok of ["A", "HELLO", "THANK-YOU"]) assert.ok(ITEM_RE.test(ok), ok);
  for (const bad of ["fs:LILY", "a", "", "A".repeat(21)]) assert.equal(ITEM_RE.test(bad), false, bad);
});

test("CODE_RE and LESSON_RE", () => {
  assert.ok(CODE_RE.test("thumb:placement"));
  assert.equal(CODE_RE.test("thumb"), false);
  assert.ok(LESSON_RE.test("2.10"));
  assert.equal(LESSON_RE.test("2"), false);
});

test("NAME_RE allows letters, spaces, apostrophes; rejects markup", () => {
  assert.ok(NAME_RE.test("Zoë O'Neil"));
  assert.equal(NAME_RE.test("<b>x</b>"), false);
  assert.equal(NAME_RE.test("a".repeat(41)), false);
});

test("isEmail and isLetters", () => {
  assert.ok(isEmail("lily@example.com"));
  assert.equal(isEmail("lily@"), false);
  assert.equal(isEmail(`${"a".repeat(250)}@x.co`), false);
  assert.ok(isLetters(["A", "B"], 26));
  assert.equal(isLetters(["AB"], 26), false);
  assert.equal(isLetters("A", 26), false);
});
