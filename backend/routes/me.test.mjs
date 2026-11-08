import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "../testutil.mjs";
import { register } from "./me.mjs";
import { COOKIE, hashToken } from "../session.mjs";

const hex = (b) => Buffer.from(b).toString("hex");
function fakeDb() {
  const users = new Map([[1, { id: 1, email: "a@b.co", password_hash: "x", google_sub: null }]]);
  const states = new Map();
  return {
    users, states,
    async sessionUser(h) { return hex(h) === hex(hashToken("tok")) ? users.get(1) ?? null : null; },
    async getState(id) { return states.get(id) ?? null; },
    async saveState(id, profile, progress, baseRev) {
      const cur = states.get(id);
      if ((cur?.rev ?? 0) !== baseRev) return { conflict: true, state: cur ?? null };
      states.set(id, { profile, progress, rev: baseRev + 1 });
      return { rev: baseRev + 1 };
    },
    async deleteUser(id) { users.delete(id); states.delete(id); },
  };
}
async function withApp(fn, db = fakeDb()) {
  const s = await serve((app) => {
    register(app, { db });
    app.use((error, _req, res, _next) => { // mirrors backend/index.mjs
      if (error.type === "entity.parse.failed") return res.status(400).json({ error: "bad_request" });
      if (error.type === "entity.too.large") return res.status(413).json({ error: "body_too_large" });
      res.status(error.status || 500).json({ error: "server_error" });
    });
  });
  try { return await fn(s, db); } finally { await s.close(); }
}
const cookie = { Cookie: `${COOKIE}=tok` };
const body = (baseRev, xp = 1) => ({
  profile: { userName: "Ryan", theirName: "Lily", leftHanded: false },
  progress: { xp, streakDays: 0, lastActiveDay: null, completed: [], items: {} },
  baseRev,
});

test("401 without a cookie", () => withApp(async (s) => {
  assert.equal((await s.request("GET", "/api/me")).status, 401);
  assert.equal((await s.request("PUT", "/api/me/state", { body: body(0) })).status, 401);
}));
test("503 without db", async () => {
  const s = await serve((app) => register(app, { db: null }));
  try { assert.equal((await s.request("GET", "/api/me")).status, 503); } finally { await s.close(); }
});
test("GET returns user and state", () => withApp(async (s) => {
  const r = await s.request("GET", "/api/me", { headers: cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { user: { email: "a@b.co", hasPassword: true, google: false }, state: null });
}));
test("save: rev 1, then 2, stale baseRev conflicts with server state", () => withApp(async (s) => {
  const put = (b) => s.request("PUT", "/api/me/state", { body: b, headers: cookie });
  assert.deepEqual((await put(body(0))).body, { rev: 1 });
  assert.deepEqual((await put(body(1, 5))).body, { rev: 2 });
  const c = await put(body(1, 9));
  assert.equal(c.status, 409);
  assert.equal(c.body.error, "conflict");
  assert.equal(c.body.state.rev, 2);
  assert.equal(c.body.state.progress.xp, 5);
}));
test("invalid body 400", () => withApp(async (s) => {
  const b = body(0); b.progress.xp = -1;
  assert.equal((await s.request("PUT", "/api/me/state", { body: b, headers: cookie })).status, 400);
}));
test("oversize body 413", () => withApp(async (s) => {
  const b = body(0); b.pad = "x".repeat(110_000);
  const r = await s.request("PUT", "/api/me/state", { body: b, headers: cookie });
  assert.equal(r.status, 413);
  assert.deepEqual(r.body, { error: "body_too_large" });
}));
test("cross-origin PUT 403", () => withApp(async (s) => {
  const r = await s.request("PUT", "/api/me/state", { body: body(0), headers: { ...cookie, Origin: "https://evil.example" } });
  assert.equal(r.status, 403);
}));
test("delete removes user, clears cookie, then GET is 401", () => withApp(async (s, db) => {
  const r = await s.request("DELETE", "/api/me", { headers: cookie });
  assert.equal(r.status, 204);
  assert.match(String(r.headers["set-cookie"]), /Max-Age=0/);
  assert.equal(db.users.size, 0);
  assert.equal((await s.request("GET", "/api/me", { headers: cookie })).status, 401);
}));
