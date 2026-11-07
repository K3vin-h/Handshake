import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createDb } from "./db.mjs";

test("attempt inserts parameterize every value in a single batch", async (t) => {
  const calls = [];
  t.mock.method(pg.Pool.prototype, "query", async (text, values) => { calls.push({ text, values }); return { rows: [] }; });
  const db = createDb("postgres://unused:unused@localhost/test");
  try {
    const ts = new Date("2026-11-07T12:00:00Z");
    await db.insertAttempts("learner-value", [
      { ts, item: "L", correct: true, codes: [] },
      { ts, item: "I", correct: false, codes: ["thumb:placement"] },
    ]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /\$1.*\$10/s);
    assert.doesNotMatch(calls[0].text, /learner-value|thumb:placement/);
    assert.deepEqual(calls[0].values, [ts, "learner-value", "L", true, [], ts, "learner-value", "I", false, ["thumb:placement"]]);
    await db.insertAttempts("learner-value", []);
    assert.equal(calls.length, 1);
  } finally { await db.close(); }
});

test("stats queries are learner-scoped and return both aggregates", async (t) => {
  const calls = [];
  t.mock.method(pg.Pool.prototype, "query", async (text, values) => {
    calls.push({ text, values });
    return { rows: calls.length === 1
      ? [{ day: "2026-11-07", attempts: 3, accuracy: 2 / 3 }]
      : [{ item: "L", attempts: 3, accuracy: 2 / 3 }] };
  });
  const db = createDb("postgres://unused:unused@localhost/test");
  try {
    assert.deepEqual(await db.stats("learner-value"), {
      daily: [{ day: "2026-11-07", attempts: 3, accuracy: 2 / 3 }],
      items: [{ item: "L", attempts: 3, accuracy: 2 / 3 }],
    });
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.deepEqual(call.values, ["learner-value"]);
      assert.match(call.text, /learner_id = \$1/);
      assert.match(call.text, /interval '14 days'/);
    }
    assert.match(calls[0].text, /time_bucket/);
    assert.match(calls[1].text, /HAVING count\(\*\) >= 3/);
    assert.match(calls[1].text, /LIMIT 5/);
  } finally { await db.close(); }
});
