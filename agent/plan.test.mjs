import { test } from "node:test";
import assert from "node:assert/strict";
import { planSession } from "./plan.mjs";

const APP = "https://app.test";
const ID = "11111111-1111-4111-8111-111111111111";
const base = { appUrl: APP, learnerId: ID, candidates: [{ id: "1.3", letters: ["L", "I"] }], knownLetters: ["L", "I"] };

const call = (name, args) => ({ functionCalls: [{ name, args }], candidates: [{ content: { role: "model", parts: [{ functionCall: { name, args } }] } }] });
// The model may wrap its JSON in prose or a markdown fence; the agent takes everything from the first { to the last }.
const done = (obj) => ({ functionCalls: undefined, text: "Here is the plan: " + JSON.stringify(obj) + " Good luck!" });

function fakeAi(script) {
  let i = 0;
  return { models: { generateContent: async () => script[i++] ?? done({}) } };
}
function fakeFetch() {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    return { json: async () => ({ ok: true }) };
  };
  f.calls = calls;
  return f;
}

test("runs the tool loop and returns the parsed final JSON", async () => {
  const f = fakeFetch();
  const plan = { lessonId: "1.3", focus: ["I"], words: ["LIL"], tip: "Pinky up." };
  const out = await planSession({ ...base, ai: fakeAi([call("get_stats", {}), done(plan)]), model: "m", fetch: f });
  assert.deepEqual(out, plan);
  assert.equal(f.calls[0].url, `${APP}/api/stats/${ID}`);
});

test("get_practice_words uses the closure's known letters and ignores ids the model supplies", async () => {
  const f = fakeFetch();
  const args = { focus: ["I", "!", "toolong"], knownLetters: ["Z"], learnerId: "evil" };
  await planSession({ ...base, ai: fakeAi([call("get_practice_words", args), done({})]), model: "m", fetch: f });
  assert.equal(f.calls[0].url, `${APP}/api/words`);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { knownLetters: ["L", "I"], weakLetters: ["I"] });
});

test("an unknown tool name gets an error result instead of crashing", async () => {
  const out = await planSession({ ...base, ai: fakeAi([call("rm_rf", {}), done({ tip: "ok" })]), model: "m", fetch: fakeFetch() });
  assert.equal(out.tip, "ok");
});

test("stops after 4 model turns", async () => {
  const loop = Array.from({ length: 6 }, () => call("get_stats", {}));
  await assert.rejects(planSession({ ...base, ai: fakeAi(loop), model: "m", fetch: fakeFetch() }), /agent_turn_limit/);
});

test("tool fetches and model generations share the request deadline", async () => {
  const signal = AbortSignal.timeout(1000);
  let modelSignal;
  let fetchSignal;
  let turns = 0;
  const ai = { models: { generateContent: async (request) => {
    modelSignal = request.config.abortSignal;
    return turns++ ? done({ tip: "steady" }) : call("get_stats", {});
  } } };
  await planSession({ ...base, ai, model: "m", signal, fetch: async (_url, init) => {
    fetchSignal = init.signal;
    return { json: async () => ({ daily: [], items: [] }) };
  } });
  assert.equal(modelSignal, signal);
  assert.equal(fetchSignal, signal);
});

test('a stalled model request rejects at the shared abort deadline', async () => {
  const signal = AbortSignal.timeout(30);
  const keepAlive = setInterval(() => {}, 1000);
  const ai = { models: { generateContent: ({ config }) => new Promise((_resolve, reject) => {
    config.abortSignal.addEventListener('abort', () => reject(config.abortSignal.reason), { once: true });
  }) } };
  const start = performance.now();
  try {
    await assert.rejects(planSession({ ...base, ai, model: 'm', signal }), { name: 'TimeoutError' });
    assert.ok(performance.now() - start < 1000);
  } finally { clearInterval(keepAlive); }
});
