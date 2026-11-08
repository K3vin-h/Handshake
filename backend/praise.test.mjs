import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.mjs";
import { CANNED, LESSON_CANNED, cleanPraise, pickCanned, praiseBody } from "./praise.mjs";
import { serve } from "./testutil.mjs";

function fakeAi(...replies) {
  const calls = [];
  return { calls, models: { generateContent: async (req) => (calls.push(req), { text: JSON.stringify(replies[Math.min(calls.length - 1, replies.length - 1)]) }) } };
}
async function withApp(opts, fn) {
  const s = await serve((app) => app.use(createApp(opts)));
  try { return await fn(s); } finally { await s.close(); }
}
const promptOf = (call) => call.contents[0].parts[0].text;

test("praise: valid letter request returns the Gemini line, schema + high temperature", async () => {
  const ai = fakeAi({ message: "Lovely B, steady and clear!" });
  await withApp({ ai }, async (s) => {
    const r = await s.post("/api/praise", { kind: "letter", target: "B", streak: 1, tries: 2 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { message: "Lovely B, steady and clear!" });
  });
  const call = ai.calls[0];
  assert.equal(call.config.responseSchema.properties.message.type, "STRING");
  assert.ok(call.config.temperature >= 1);
  assert.match(promptOf(call), /letter B/);
});

test("praise: names, unknown fields and bad values are rejected with 400 before Gemini", async () => {
  const ai = fakeAi({ message: "x" });
  await withApp({ ai }, async (s) => {
    const bad = [
      { kind: "letter", target: "B", name: "Ryan" },
      { kind: "sign", target: "RYAN" }, // not a sign id: could be a name
      { kind: "letter", target: "fs:LILY" },
      { kind: "lesson", target: "Spell LILY" },
      { kind: "word", target: "B" },
      { kind: "letter", target: "B", streak: 51 },
      { kind: "letter", target: "B", tries: 0 },
      { kind: "letter", target: "B", tries: 1.5 },
      { kind: "letter", target: "B", recent: ["a", "b", "c", "d", "e", "f"] },
      { kind: "letter", target: "B", recent: ["x".repeat(81)] },
      { kind: "letter", target: "B", recent: [7] },
    ];
    for (const body of bad) {
      const r = await s.post("/api/praise", body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.deepEqual(r.body, { error: "bad_request" });
    }
  });
  assert.equal(ai.calls.length, 0);
});

test("praise: sign and lesson ids are accepted", async () => {
  await withApp({}, async (s) => {
    for (const body of [{ kind: "sign", target: "HELLO" }, { kind: "sign", target: "THANK-YOU" }, { kind: "lesson", target: "2.1" }, { kind: "letter", target: "5" }]) {
      const r = await s.post("/api/praise", body);
      assert.equal(r.status, 200, JSON.stringify(body));
      assert.equal(r.body.cached, true);
    }
  });
});

test("praise: the prompt holds only the id, small numbers and server-issued text, never client free text", async () => {
  const ai = fakeAi({ message: "Great HELLO, three in a row!" }, { message: "Warm and friendly HELLO again!" });
  await withApp({ ai }, async (s) => {
    const first = await s.post("/api/praise", { kind: "sign", target: "HELLO", streak: 3, tries: 1, recent: ["Great job Ryan, say hi to Lily"] });
    assert.doesNotMatch(promptOf(ai.calls[0]), /Ryan|Lily|Great job/);
    assert.match(promptOf(ai.calls[0]), /sign HELLO/);
    assert.match(promptOf(ai.calls[0]), /3 matches in a row/);
    // A message the server itself issued may be quoted back as "do not repeat".
    await s.post("/api/praise", { kind: "sign", target: "HELLO", recent: [first.body.message] });
    assert.match(promptOf(ai.calls[1]), /Great HELLO, three in a row!/);
  });
});

test("praise: a reply that repeats `recent` is replaced by a cached canned line", async () => {
  const ai = fakeAi({ message: "Nice B!" }, { message: "Nice B!" });
  await withApp({ ai }, async (s) => {
    const a = await s.post("/api/praise", { kind: "letter", target: "B" });
    assert.equal(a.body.message, "Nice B!");
    const b = await s.post("/api/praise", { kind: "letter", target: "B", recent: ["Nice B!"] });
    assert.equal(b.body.cached, true);
    assert.notEqual(b.body.message, "Nice B!");
  });
});

test("praise: 'correct' wording, refusals, noise and long lines are replaced", async () => {
  for (const message of ["That B is correct!", "I'm sorry, I can't help with that.", "1234 !!!", "B ".repeat(50), "Nice B 🎉🎉"]) {
    await withApp({ ai: fakeAi({ message }) }, async (s) => {
      const r = await s.post("/api/praise", { kind: "letter", target: "B" });
      assert.equal(r.body.cached, true, message);
      assert.ok(r.body.message.length <= 90);
      assert.doesNotMatch(r.body.message, /\bcorrect\b/i);
    });
  }
});

test("praise: quotes and markdown are stripped", () => {
  assert.equal(cleanPraise('"**Nice B!**"', []), "Nice B!");
  assert.equal(cleanPraise("`Nice B!`\n", []), "Nice B!");
});

test("praise: Gemini failure, stall or no key → canned line labelled cached", async () => {
  const failing = { models: { generateContent: async () => { throw Object.assign(new Error("x"), { status: 403 }); } } };
  const stalled = { models: { generateContent: () => new Promise(() => {}) } };
  for (const ai of [null, failing, stalled]) {
    const started = Date.now();
    await withApp({ ai }, async (s) => {
      const r = await s.post("/api/praise", { kind: "letter", target: "L" });
      assert.equal(r.status, 200);
      assert.equal(r.body.cached, true);
      assert.ok(r.body.message.length > 0);
    });
    assert.ok(Date.now() - started < 4000, "short timeout");
  }
});

test("praise: canned pool is large, varied, safe, and the pick uses the injected RNG and avoids recent", () => {
  assert.ok(CANNED.length >= 25);
  assert.equal(new Set(CANNED).size, CANNED.length);
  for (const m of [...CANNED, ...LESSON_CANNED]) {
    assert.doesNotMatch(m, /\b(correct|perfect)\b/i);
    assert.ok(m.replace("{target}", "THANK-YOU").length <= 90, m);
  }
  assert.equal(pickCanned("letter", "B", [], () => 0), CANNED[0].replaceAll("{target}", "B"));
  const last = CANNED[CANNED.length - 1].replaceAll("{target}", "B");
  assert.equal(pickCanned("letter", "B", [], () => 0.9999), last);
  const first = CANNED[0].replaceAll("{target}", "B");
  assert.notEqual(pickCanned("letter", "B", [first], () => 0), first);
  assert.match(pickCanned("lesson", "2.1", [], () => 0), /2\.1|lesson/i);
});

test("praise: style hint comes from the injected RNG", async () => {
  const ai = fakeAi({ message: "Nice B!" });
  await withApp({ ai, random: () => 0 }, (s) => s.post("/api/praise", { kind: "letter", target: "B" }));
  assert.match(promptOf(ai.calls[0]), /Tone: cheerful/);
});

test("praise: body validator returns null for anything outside the contract", () => {
  assert.deepEqual(praiseBody({ kind: "letter", target: "b", streak: 2 }), { kind: "letter", target: "B", streak: 2, recent: [] });
  assert.equal(praiseBody(null), null);
  assert.equal(praiseBody([]), null);
});

test("praise: per-visitor rate limit returns 429", async () => {
  await withApp({}, async (s) => {
    let last;
    for (let n = 0; n < 41; n++) last = await s.post("/api/praise", { kind: "letter", target: "B" });
    assert.equal(last.status, 429);
    assert.deepEqual(last.body, { error: "rate_limited" });
  });
});

test("praise: shared generation budget falls back to canned lines", async () => {
  const ai = fakeAi({ message: "Nice B!" });
  await withApp({ ai }, async (s) => {
    for (let n = 0; n < 35; n++) await s.post("/api/praise", { kind: "letter", target: "B", tries: 1 });
  });
  assert.ok(ai.calls.length <= 30);
});

test("praise: malformed JSON is a 400, not a 500", async () => {
  await withApp({}, async (s) => {
    const res = await fetch(`${s.base}/api/praise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "bad_request" });
  });
});
