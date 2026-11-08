import { test } from "node:test";
import assert from "node:assert/strict";
import { readCookie, cookieHeader, clearCookie, hashToken, newToken, sameOrigin, requireUser, COOKIE } from "./session.mjs";

const mkRes = () => {
  const r = { code: 200, body: null };
  r.status = (c) => ((r.code = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const run = async (mw, req) => {
  const res = mkRes();
  let nexted = false;
  await mw(req, res, () => { nexted = true; });
  return { res, nexted };
};

test("readCookie finds one among several", () => {
  assert.equal(readCookie("a=1; hs_session=tok; b=2", "hs_session"), "tok");
});
test("readCookie ignores a similarly named cookie", () => {
  assert.equal(readCookie("xhs_session=no; hs_session2=no", "hs_session"), null);
});
test("readCookie returns null on bad % escape", () => {
  assert.equal(readCookie("hs_session=%E0%A4%A", "hs_session"), null);
});

test("cookieHeader flags", () => {
  const c = cookieHeader("t");
  for (const s of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) assert.ok(c.includes(s), s);
  assert.ok(!c.includes("Secure"));
  assert.ok(cookieHeader("t", { secure: true }).includes("; Secure"));
});
test("clearCookie has Max-Age=0", () => assert.ok(clearCookie(false).includes("Max-Age=0")));

test("hashToken deterministic, 32 bytes; newToken random", () => {
  assert.deepEqual(hashToken("x"), hashToken("x"));
  assert.equal(hashToken("x").length, 32);
  assert.notEqual(newToken(), newToken());
});

test("sameOrigin allows GET and POST without Origin", async () => {
  assert.equal((await run(sameOrigin, { method: "GET", headers: { origin: "http://evil.com", host: "a.com" } })).nexted, true);
  assert.equal((await run(sameOrigin, { method: "POST", headers: { host: "a.com" } })).nexted, true);
});
test("sameOrigin allows matching host", async () => {
  assert.equal((await run(sameOrigin, { method: "POST", headers: { origin: "http://a.com:5173", host: "a.com:5173" } })).nexted, true);
});
test("sameOrigin 403 on mismatch or non-URL", async () => {
  for (const origin of ["http://evil.com", "not a url"]) {
    const { res, nexted } = await run(sameOrigin, { method: "POST", headers: { origin, host: "a.com" } });
    assert.equal(nexted, false);
    assert.equal(res.code, 403);
    assert.deepEqual(res.body, { error: "forbidden" });
  }
});

test("requireUser 401 with no cookie or unknown session", async () => {
  const db = { sessionUser: async () => null };
  for (const cookie of [undefined, `${COOKIE}=nope`]) {
    const { res, nexted } = await run(requireUser(db), { headers: { cookie } });
    assert.equal(nexted, false);
    assert.equal(res.code, 401);
    assert.deepEqual(res.body, { error: "unauthenticated" });
  }
});
test("requireUser sets req.user for a known session", async () => {
  const db = { sessionUser: async (h) => (Buffer.compare(h, hashToken("good")) === 0 ? { id: 7 } : null) };
  const req = { headers: { cookie: `${COOKIE}=good` } };
  const { nexted } = await run(requireUser(db), req);
  assert.equal(nexted, true);
  assert.deepEqual(req.user, { id: 7 });
});

// Behind the Vercel rewrite the API sees Host = API host and X-Forwarded-Host = the Vercel host.
const proxied = (trust, headers) => ({ method: "POST", app: { get: (k) => (k === "trust proxy" ? trust : undefined) }, headers });
test("sameOrigin ignores X-Forwarded-Host when trust proxy is off", async () => {
  for (const trust of [undefined, false, 0]) {
    const { res, nexted } = await run(sameOrigin, proxied(trust, { origin: "https://evil.com", host: "api.example", "x-forwarded-host": "evil.com" }));
    assert.equal(nexted, false, String(trust));
    assert.equal(res.code, 403);
  }
  // Host still decides, exactly as before
  assert.equal((await run(sameOrigin, proxied(false, { origin: "https://api.example", host: "api.example", "x-forwarded-host": "evil.com" }))).nexted, true);
});
test("sameOrigin uses the first X-Forwarded-Host when trust proxy is on", async () => {
  assert.equal((await run(sameOrigin, proxied(1, { origin: "https://app.vercel.app", host: "api.example", "x-forwarded-host": "app.vercel.app" }))).nexted, true);
  assert.equal((await run(sameOrigin, proxied(1, { origin: "https://app.vercel.app", host: "api.example", "x-forwarded-host": "app.vercel.app, evil.com" }))).nexted, true);
  assert.equal((await run(sameOrigin, proxied(1, { origin: "https://evil.com", host: "api.example", "x-forwarded-host": "app.vercel.app, evil.com" }))).nexted, false);
  // no forwarded host: Host decides
  assert.equal((await run(sameOrigin, proxied(1, { origin: "https://api.example", host: "api.example" }))).nexted, true);
});
test("sameOrigin 403 when trust proxy is on but Origin matches neither", async () => {
  const { res, nexted } = await run(sameOrigin, proxied(1, { origin: "https://evil.com", host: "api.example", "x-forwarded-host": "app.vercel.app" }));
  assert.equal(nexted, false);
  assert.equal(res.code, 403);
  // once a forwarded host is present, Host is not a second chance
  assert.equal((await run(sameOrigin, proxied(1, { origin: "https://api.example", host: "api.example", "x-forwarded-host": "app.vercel.app" }))).nexted, false);
});
