import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { serve } from "../testutil.mjs";
import { register } from "./notify.mjs";

const id = randomUUID();
const n8n = { subscribeUrl: "http://n8n.test/sub", eventUrl: "http://n8n.test/evt", secret: "s3cret" };

function fakeFetch({ ok = true, throws = false } = {}) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    if (throws) throw new Error("network");
    return { ok };
  };
  f.calls = calls;
  return f;
}

async function withApp(deps, fn) {
  const s = await serve((app) => register(app, deps));
  try {
    return await fn(s);
  } finally {
    await s.close();
  }
}

const sub = { action: "subscribe", learnerId: id, consent: true, userName: "Ryan", theirName: "Lily", contactEmail: "lily@example.com" };

test("subscribe forwards the validated fields with the secret header", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    const r = await s.post("/api/subscribe", { ...sub, junk: "ignored" });
    assert.deepEqual(r.body, { ok: true });
    assert.equal(f.calls[0].url, n8n.subscribeUrl);
    assert.equal(f.calls[0].init.headers["X-Handshake-Secret"], "s3cret");
    const forwarded = JSON.parse(f.calls[0].init.body);
    assert.ok(Number.isFinite(Date.parse(forwarded.requestedAt)));
    const { requestedAt, ...fields } = forwarded;
    assert.deepEqual(fields, {
      action: "subscribe", learnerId: id, userName: "Ryan", theirName: "Lily", contactEmail: "lily@example.com",
    });
  });
});

test("subscribe without consent, without any email, or with a bad name is a 400 and sends nothing", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    assert.equal((await s.post("/api/subscribe", { ...sub, consent: false })).status, 400);
    assert.equal((await s.post("/api/subscribe", { ...sub, contactEmail: undefined })).status, 400);
    assert.equal((await s.post("/api/subscribe", { ...sub, userName: "<script>" })).status, 400);
    assert.equal((await s.post("/api/subscribe", { ...sub, contactEmail: "not-an-email" })).status, 400);
    assert.equal(f.calls.length, 0);
  });
});

test("unsubscribe forwards the action, learner id and server ordering timestamp", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    const r = await s.post("/api/subscribe", { action: "unsubscribe", learnerId: id });
    assert.deepEqual(r.body, { ok: true });
    const { requestedAt, ...fields } = JSON.parse(f.calls[0].init.body);
    assert.ok(Number.isFinite(Date.parse(requestedAt)));
    assert.deepEqual(fields, { action: "unsubscribe", learnerId: id });
  });
});

test("lesson-complete forwards to the event webhook and validates fields", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    const r = await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", xp: 20 });
    assert.deepEqual(r.body, { ok: true });
    assert.equal(f.calls[0].url, n8n.eventUrl);
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { learnerId: id, lessonId: "1.2", xp: 20 });
    assert.equal((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "x", xp: 20 })).status, 400);
    assert.equal((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", xp: 5000 })).status, 400);
    // Free text is never forwarded: n8n derives the title from lessonId.
    await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", lessonTitle: "Open http://evil.example/x", userName: "Ryan", xp: 5 });
    assert.deepEqual(JSON.parse(f.calls[1].init.body), { learnerId: id, lessonId: "1.2", xp: 5 });
    assert.equal(f.calls.length, 2);
  });
});

test("answers ok:false when n8n is off, down, or rejects", async () => {
  await withApp({ n8n: null, fetch: fakeFetch() }, async (s) => {
    assert.deepEqual((await s.post("/api/subscribe", sub)).body, { ok: false, reason: "disabled" });
    assert.deepEqual((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", xp: 1 })).body, { ok: false, reason: "disabled" });
  });
  await withApp({ n8n, fetch: fakeFetch({ throws: true }) }, async (s) => {
    assert.deepEqual((await s.post("/api/subscribe", sub)).body, { ok: false, reason: "upstream" });
  });
  await withApp({ n8n, fetch: fakeFetch({ ok: false }) }, async (s) => {
    assert.deepEqual((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", xp: 1 })).body, { ok: false, reason: "upstream" });
  });
});


test("subscription ordering timestamp is minted by the server, never accepted from the browser", async () => {
  const f = fakeFetch();
  const before = Date.now();
  await withApp({ n8n, fetch: f }, async (s) => {
    await s.post("/api/subscribe", { ...sub, requestedAt: "2099-01-01T00:00:00.000Z" });
    const requestedAt = Date.parse(JSON.parse(f.calls[0].init.body).requestedAt);
    assert.ok(requestedAt >= before && requestedAt <= Date.now());
  });
});
