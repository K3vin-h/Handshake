import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK, pickFallback, recentPraise, requestPraise, streakAfter, triesFrom } from "./praise.ts";

test("streak counts consecutive matches; a miss or skip resets it", () => {
  assert.equal(streakAfter(0, "match"), 1);
  assert.equal(streakAfter(4, "match"), 5);
  assert.equal(streakAfter(4, "miss"), 0);
  assert.equal(streakAfter(4, "skip"), 0);
  assert.equal(streakAfter(50, "match"), 50); // server cap
});

test("tries = misses before the match + 1, clamped to 1..20", () => {
  assert.equal(triesFrom(0), 1);
  assert.equal(triesFrom(2), 3);
  assert.equal(triesFrom(99), 20);
  assert.equal(triesFrom(-1), 1);
});

test("fallback pick uses the injected RNG, fills the target and avoids recent", () => {
  assert.ok(FALLBACK.length >= 10);
  const first = pickFallback("letter", "B", [], () => 0);
  assert.equal(first, FALLBACK[0].replaceAll("{target}", "B"));
  assert.notEqual(pickFallback("letter", "B", [first], () => 0), first);
  assert.match(pickFallback("lesson", "2.1", [], () => 0), /2\.1/);
  for (const m of FALLBACK) assert.doesNotMatch(m, /\b(correct|perfect)\b/i);
});

test("requestPraise returns the server line, sends only allowed fields, keeps the last 5", async () => {
  recentPraise.length = 0;
  const sent: Record<string, unknown>[] = [];
  for (let n = 0; n < 7; n++) {
    const r = await requestPraise("letter", "B", { streak: 2, tries: 1 }, async (body) => { sent.push(body); return { message: `Line ${n}` }; });
    assert.deepEqual(r, { message: `Line ${n}`, cached: false });
  }
  assert.deepEqual(Object.keys(sent[0]).sort(), ["kind", "recent", "streak", "target", "tries"]);
  assert.deepEqual(sent[6].recent, ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"]);
  assert.deepEqual(recentPraise, ["Line 2", "Line 3", "Line 4", "Line 5", "Line 6"]);
});

test("requestPraise never throws: network errors and bad replies fall back, marked cached", async () => {
  recentPraise.length = 0;
  const a = await requestPraise("sign", "HELLO", {}, async () => { throw new Error("offline"); });
  assert.equal(a.cached, true);
  assert.match(a.message, /HELLO/);
  const b = await requestPraise("letter", "L", {}, async () => ({ nope: 1 }));
  assert.equal(b.cached, true);
  const c = await requestPraise("letter", "L", {}, async () => ({ message: "x".repeat(200) }));
  assert.equal(c.cached, true);
});

test("requestPraise never sends a target that could be a name", async () => {
  let calls = 0;
  const r = await requestPraise("letter", "fs:LILY", {}, async () => { calls++; return { message: "x" }; });
  assert.equal(calls, 0);
  assert.equal(r.cached, true);
  assert.doesNotMatch(r.message, /LILY/);
});
