import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { serve } from "../testutil.mjs";
import { register } from "./plan.mjs";

const id = randomUUID();
const agent = { url: "http://agent.test/plan", token: "tok" };
const body = {
  learnerId: id,
  candidates: [{ id: "2.1", letters: ["B", "C", "O"] }, { id: "1.3", letters: ["L", "I"] }],
  knownLetters: ["L", "I", "B", "O"],
  weakLetters: ["I", "Z"],
};
const good = { lessonId: "1.3", focus: ["I"], words: ["LIB", "OIL"], tip: "Keep your pinky tall." };

function fakeFetch(reply, { ok = true, throws = false } = {}) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    if (throws) throw new Error("timeout");
    return { ok, json: async () => reply };
  };
  f.calls = calls;
  return f;
}

async function plan(deps, payload = body) {
  const s = await serve((app) => register(app, deps));
  try {
    return await s.post("/api/plan", payload);
  } finally {
    await s.close();
  }
}

test("without an agent it returns the local plan: first candidate, weak letters the learner knows", async () => {
  const r = await plan({ agent: null, fetch: fakeFetch(null) });
  assert.equal(r.body.source, "local");
  assert.equal(r.body.lessonId, "2.1");
  assert.deepEqual(r.body.focus, ["I"]);
  assert.deepEqual(r.body.words, []);
});

test("returns the agent plan when it passes the guard, and sends a bearer token without names or weak letters", async () => {
  const f = fakeFetch(good);
  const r = await plan({ agent, fetch: f });
  assert.deepEqual(r.body, { ...good, source: "agent" });
  assert.equal(f.calls[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(Object.keys(JSON.parse(f.calls[0].init.body)).sort(), ["candidates", "knownLetters", "learnerId"]);
  assert.ok(f.calls[0].init.signal instanceof AbortSignal, "the agent call must carry a timeout signal");
});

test("strips extra candidate fields such as titles before calling the agent", async () => {
  const f = fakeFetch(good);
  const withTitle = { ...body, candidates: body.candidates.map((c) => ({ ...c, title: "Spell RYAN", userName: "Ryan" })) };
  await plan({ agent, fetch: f }, withTitle);
  assert.deepEqual(JSON.parse(f.calls[0].init.body).candidates, body.candidates);
});

test("falls back to local when the agent picks a lesson that is not a candidate", async () => {
  assert.equal((await plan({ agent, fetch: fakeFetch({ ...good, lessonId: "9.9" }) })).body.source, "local");
});

test("falls back to local when the agent suggests words with letters the learner does not know", async () => {
  assert.equal((await plan({ agent, fetch: fakeFetch({ ...good, words: ["ZOO"] }) })).body.source, "local");
});

test("falls back to local when the agent errors, times out or returns junk", async () => {
  assert.equal((await plan({ agent, fetch: fakeFetch(good, { throws: true }) })).body.source, "local");
  assert.equal((await plan({ agent, fetch: fakeFetch(good, { ok: false }) })).body.source, "local");
  assert.equal((await plan({ agent, fetch: fakeFetch("nope") })).body.source, "local");
});

test("caps the tip at 200 characters", async () => {
  const r = await plan({ agent, fetch: fakeFetch({ ...good, tip: "x".repeat(500) }) });
  assert.equal(r.body.tip.length, 200);
});

test("rejects bad input with 400", async () => {
  assert.equal((await plan({ agent: null }, { ...body, candidates: [] })).status, 400);
  assert.equal((await plan({ agent: null }, { ...body, learnerId: "x" })).status, 400);
  assert.equal((await plan({ agent: null }, { ...body, knownLetters: ["ab"] })).status, 400);
  assert.equal((await plan({ agent: null }, { ...body, candidates: [{ id: "x", letters: [] }] })).status, 400);
});
