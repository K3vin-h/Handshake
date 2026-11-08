import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "../testutil.mjs";
import { register } from "./auth.mjs";
import { hashPassword } from "../password.mjs";
import { COOKIE, hashToken } from "../session.mjs";

const APP = "https://handshake.example";
const PW = "correct-horse-battery";
const settle = () => new Promise((r) => setTimeout(r, 50));
const hex = (b) => Buffer.from(b).toString("hex");

// In-memory stand-in for backend/db.mjs with the same method contracts.
function fakeDb() {
  const users = new Map(), sessions = new Map(), resets = new Map(), states = new Map();
  let next = 1;
  const byEmail = (e) => [...users.values()].find((u) => u.email.toLowerCase() === String(e).toLowerCase()) ?? null;
  return {
    users, sessions, resets, states,
    async deleteState(userId) { states.delete(userId); },
    async createUser({ email, passwordHash = null, googleSub = null, verified = false }) {
      if (byEmail(email) || (googleSub && [...users.values()].some((u) => u.google_sub === googleSub))) return null;
      const u = { id: next++, email, password_hash: passwordHash, google_sub: googleSub, email_verified_at: verified ? new Date() : null };
      users.set(u.id, u);
      return { ...u };
    },
    async findUserByEmail(email) { const u = byEmail(email); return u ? { ...u } : null; },
    async findUserByGoogleSub(sub) { const u = [...users.values()].find((x) => x.google_sub === sub); return u ? { ...u } : null; },
    async linkGoogle(id, sub, { clearPassword = false } = {}) {
      const u = users.get(id);
      if (!u || u.google_sub) return null; // mirrors db.mjs: AND google_sub IS NULL
      Object.assign(u, { google_sub: sub, email_verified_at: new Date(), ...(clearPassword ? { password_hash: null } : {}) });
      return { ...u };
    },
    async setPassword(id, hash) { Object.assign(users.get(id), { password_hash: hash, email_verified_at: new Date() }); },
    async createSession(h, userId, expiresAt) { sessions.set(hex(h), { userId, expiresAt }); },
    async deleteSession(h) { sessions.delete(hex(h)); },
    async deleteUserSessions(userId) { for (const [k, s] of sessions) if (s.userId === userId) sessions.delete(k); },
    async createReset(h, userId, expiresAt) { resets.set(hex(h), { userId, expiresAt, used: false }); },
    async consumeReset(h, now) {
      const r = resets.get(hex(h));
      if (!r || r.used || r.expiresAt <= now) return null;
      r.used = true;
      return r.userId;
    },
  };
}

async function withApp(deps, fn) {
  const sent = [];
  let t = 1_800_000_000_000;
  const clock = { advance: (ms) => (t += ms) };
  const s = await serve((app) => {
    app.set("trust proxy", true); // test only: lets a test pick the client IP with X-Forwarded-For
    register(app, {
      db: fakeDb(),
      verifyGoogle: async (credential) => GOOGLE[credential] ?? Promise.reject(new Error("bad token")),
      isBreached: async () => false,
      sendResetEmail: async (m) => { sent.push(m); },
      googleClientId: "client-id",
      appOrigin: APP,
      now: () => t,
      ...deps,
    });
  });
  try {
    return await fn({ ...s, sent, clock, post: (url, body, headers) => s.request("POST", url, { body, headers }) });
  } finally {
    await s.close();
  }
}

const GOOGLE = {
  "g-new": { sub: "sub-new", email: "New@Gmail.com", emailVerified: true },
  "g-unverified": { sub: "sub-u", email: "u@gmail.com", emailVerified: false },
  "g-squat": { sub: "sub-squat", email: "owner@example.com", emailVerified: true },
};

const cookieOf = (r) => (r.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${COOKIE}=`));
const tokenOf = (r) => cookieOf(r).split(";")[0].slice(COOKIE.length + 1);

async function addUser(db, { email, password = PW, verified = false, googleSub = null }) {
  return db.createUser({ email, passwordHash: password ? await hashPassword(password) : null, googleSub, verified });
}

// signup
test("signup: 201, HttpOnly session cookie, public user only, hash is not the password", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/signup", { email: "Ryan@Example.com", password: PW });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body, { user: { email: "ryan@example.com", hasPassword: true, google: false } });
    assert.match(cookieOf(r), /HttpOnly/);
    assert.match(cookieOf(r), /SameSite=Lax/);
    assert.doesNotMatch(cookieOf(r), /Secure/);
    const stored = [...db.users.values()][0];
    assert.notEqual(stored.password_hash, PW);
    assert.match(stored.password_hash, /^scrypt\$/);
    assert.ok(!stored.password_hash.includes(PW));
    assert.equal(db.sessions.size, 1);
    assert.ok(db.sessions.has(hex(hashToken(tokenOf(r)))), "session stored by token hash, not the token");
  });
});

test("signup: duplicate email in a different case is 409", async () => {
  await withApp({}, async (s) => {
    assert.equal((await s.post("/api/auth/signup", { email: "a@example.com", password: PW })).status, 201);
    const r = await s.post("/api/auth/signup", { email: "A@EXAMPLE.COM", password: PW });
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { error: "email_taken" });
  });
});

test("signup: 9-character password is 400 weak_password", async () => {
  await withApp({}, async (s) => {
    const r = await s.post("/api/auth/signup", { email: "a@example.com", password: "123456789" });
    assert.deepEqual([r.status, r.body], [400, { error: "weak_password" }]);
  });
});

test("signup: bad email is 400 bad_request", async () => {
  await withApp({}, async (s) => {
    for (const email of ["nope", "", null, ["a@b.co"]]) {
      const r = await s.post("/api/auth/signup", { email, password: PW });
      assert.deepEqual([r.status, r.body], [400, { error: "bad_request" }]);
    }
  });
});

// login
test("login: right password is 200 with a session cookie", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/login", { email: "A@example.com", password: PW });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { user: { email: "a@example.com", hasPassword: true, google: false } });
    assert.match(cookieOf(r), /HttpOnly/);
    assert.equal(db.sessions.size, 1);
  });
});

test("login: wrong password and unknown email give the same 401 body", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const wrong = await s.post("/api/auth/login", { email: "a@example.com", password: "wrong-password-1" });
    const unknown = await s.post("/api/auth/login", { email: "nobody@example.com", password: PW });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, { error: "invalid_credentials" });
    assert.deepEqual([unknown.status, unknown.body], [wrong.status, wrong.body]);
    assert.equal(cookieOf(wrong), undefined);
    assert.equal(cookieOf(unknown), undefined);
    assert.equal(db.sessions.size, 0);
  });
});

test("login: a Google-only user (no password hash) is 401", async () => {
  const db = fakeDb();
  await addUser(db, { email: "g@example.com", password: null, googleSub: "sub-g", verified: true });
  await withApp({ db }, async (s) => {
    for (const password of ["", PW, "handshake-dummy-password"]) {
      const r = await s.post("/api/auth/login", { email: "g@example.com", password });
      assert.deepEqual([r.status, r.body], [401, { error: "invalid_credentials" }]);
    }
  });
});

test("login rate limit: 11th attempt for one email is 429 even from different IPs", async () => {
  await withApp({}, async (s) => {
    for (let i = 1; i <= 10; i++) {
      const email = i % 2 ? "victim@example.com" : "VICTIM@example.com";
      const r = await s.post("/api/auth/login", { email, password: "wrong-password-1" }, { "X-Forwarded-For": `10.0.0.${i}` });
      assert.equal(r.status, 401, `attempt ${i}`);
    }
    const r = await s.post("/api/auth/login", { email: "victim@example.com", password: PW }, { "X-Forwarded-For": "10.0.0.99" });
    assert.deepEqual([r.status, r.body], [429, { error: "rate_limited" }]);
    // another email from a fresh IP is unaffected
    const other = await s.post("/api/auth/login", { email: "other@example.com", password: PW }, { "X-Forwarded-For": "10.0.1.1" });
    assert.equal(other.status, 401);
  });
});

// google
test("google: bad token is 401 invalid_token", async () => {
  await withApp({}, async (s) => {
    for (const credential of ["garbage", 42, "x".repeat(5000)]) {
      const r = await s.post("/api/auth/google", { credential });
      assert.equal(r.status, typeof credential === "string" && credential.length <= 4096 ? 401 : 400);
    }
    assert.deepEqual((await s.post("/api/auth/google", { credential: "garbage" })).body, { error: "invalid_token" });
  });
});

test("google: unverified email (emailVerified false) is 401 and creates nothing", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/google", { credential: "g-unverified" });
    assert.deepEqual([r.status, r.body], [401, { error: "invalid_token" }]);
    assert.equal(db.users.size, 0);
    assert.equal(db.sessions.size, 0);
  });
});

test("google: new user is isNew true; same sub again is the same user with isNew false", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    const first = await s.post("/api/auth/google", { credential: "g-new" });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { user: { email: "new@gmail.com", hasPassword: false, google: true }, isNew: true });
    assert.ok(cookieOf(first));
    const again = await s.post("/api/auth/google", { credential: "g-new" });
    assert.deepEqual(again.body, { user: { email: "new@gmail.com", hasPassword: false, google: true }, isNew: false });
    assert.equal(db.users.size, 1);
    assert.ok([...db.users.values()][0].email_verified_at);
  });
});

test("google linking: unverified password account is linked and its password cleared", async () => {
  const db = fakeDb();
  const squatter = await addUser(db, { email: "owner@example.com", verified: false });
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/google", { credential: "g-squat" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { user: { email: "owner@example.com", hasPassword: false, google: true }, isNew: false });
    const u = db.users.get(squatter.id);
    assert.equal(u.google_sub, "sub-squat");
    assert.equal(u.password_hash, null);
    assert.equal(db.users.size, 1);
    const login = await s.post("/api/auth/login", { email: "owner@example.com", password: PW });
    assert.equal(login.status, 401, "the squatter's password no longer works");
  });
});

test("google linking: verified password account is linked and keeps its password", async () => {
  const db = fakeDb();
  const owner = await addUser(db, { email: "owner@example.com", verified: true });
  const hash = owner.password_hash;
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/google", { credential: "g-squat" });
    assert.deepEqual(r.body, { user: { email: "owner@example.com", hasPassword: true, google: true }, isNew: false });
    const u = db.users.get(owner.id);
    assert.equal(u.google_sub, "sub-squat");
    assert.equal(u.password_hash, hash);
    assert.equal((await s.post("/api/auth/login", { email: "owner@example.com", password: PW })).status, 200);
  });
});

test("google linking: an unverified account's existing sessions are revoked; the owner's new session lives", async () => {
  const db = fakeDb();
  const squatter = await addUser(db, { email: "owner@example.com", verified: false });
  await withApp({ db }, async (s) => {
    const squat = await s.post("/api/auth/login", { email: "owner@example.com", password: PW });
    const squatKey = hex(hashToken(tokenOf(squat)));
    assert.ok(db.sessions.has(squatKey));
    const owner = await s.post("/api/auth/google", { credential: "g-squat" });
    assert.equal(owner.status, 200);
    assert.ok(!db.sessions.has(squatKey), "squatter's session no longer resolves");
    const ownerSession = db.sessions.get(hex(hashToken(tokenOf(owner))));
    assert.equal(ownerSession?.userId, squatter.id);
    assert.equal(db.sessions.size, 1);
  });
});

test("google linking: a verified account's existing sessions are kept", async () => {
  const db = fakeDb();
  await addUser(db, { email: "owner@example.com", verified: true });
  await withApp({ db }, async (s) => {
    const before = await s.post("/api/auth/login", { email: "owner@example.com", password: PW });
    const key = hex(hashToken(tokenOf(before)));
    assert.equal((await s.post("/api/auth/google", { credential: "g-squat" })).status, 200);
    assert.ok(db.sessions.has(key));
    assert.equal(db.sessions.size, 2);
  });
});

test("google linking: an email match already tied to another Google id is 401 and is not relinked", async () => {
  const db = fakeDb();
  const existing = await addUser(db, { email: "owner@example.com", googleSub: "other", verified: true });
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/auth/google", { credential: "g-squat" }); // sub-squat, same email
    assert.deepEqual([r.status, r.body], [401, { error: "invalid_token" }]);
    assert.equal(cookieOf(r), undefined);
    assert.equal(db.users.get(existing.id).google_sub, "other");
    assert.equal(db.sessions.size, 0);
  });
});

// forgot
test("forgot: 202 with identical bodies with and without an account; one email only for the account", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const known = await s.post("/api/auth/forgot", { email: "A@example.com" });
    const unknown = await s.post("/api/auth/forgot", { email: "nobody@example.com" });
    const invalid = await s.post("/api/auth/forgot", { email: "nope" });
    assert.equal(known.status, 202);
    assert.deepEqual([unknown.status, unknown.body], [known.status, known.body]);
    assert.deepEqual([invalid.status, invalid.body], [known.status, known.body]);
    await settle();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].to, "a@example.com");
    assert.equal(db.resets.size, 1);
    const token = s.sent[0].link.split("/#/reset/")[1];
    assert.ok(!db.resets.has(token), "reset token is stored hashed");
    assert.ok(db.resets.has(hex(hashToken(token))));
  });
});

test("forgot: link starts with appOrigin and ignores a forged Host header", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    // Origin matches the forged Host, so the CSRF check passes and the route really runs.
    const r = await s.post("/api/auth/forgot", { email: "a@example.com" },
      { Host: "evil.example", Origin: "http://evil.example", "X-Forwarded-Host": "evil.example" });
    assert.equal(r.status, 202);
    await settle();
    assert.equal(s.sent.length, 1);
    assert.ok(s.sent[0].link.startsWith(`${APP}/#/reset/`), s.sent[0].link);
    assert.doesNotMatch(s.sent[0].link, /evil/);
  });
});

test("forgot: with no appOrigin it answers 202 and sends nothing", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db, appOrigin: null }, async (s) => {
    const r = await s.post("/api/auth/forgot", { email: "a@example.com" });
    assert.deepEqual([r.status, r.body], [202, { ok: true }]);
    await settle();
    assert.equal(s.sent.length, 0);
    assert.equal(db.resets.size, 0);
    assert.equal((await s.request("GET", "/api/auth/config")).body.resetEmail, false);
  });
});

// reset
async function resetToken(s, email = "a@example.com") {
  await s.post("/api/auth/forgot", { email });
  await settle();
  return s.sent.at(-1).link.split("/#/reset/")[1];
}

test("reset: valid token sets the password and deletes that user's sessions", async () => {
  const db = fakeDb();
  const u = await addUser(db, { email: "a@example.com" });
  const other = await addUser(db, { email: "b@example.com" });
  await withApp({ db }, async (s) => {
    await s.post("/api/auth/login", { email: "a@example.com", password: PW });
    await s.post("/api/auth/login", { email: "b@example.com", password: PW });
    assert.equal(db.sessions.size, 2);
    const token = await resetToken(s);
    const r = await s.post("/api/auth/reset", { token, password: "a-brand-new-password" });
    assert.equal(r.status, 204);
    assert.equal([...db.sessions.values()].filter((x) => x.userId === u.id).length, 0);
    assert.equal([...db.sessions.values()].filter((x) => x.userId === other.id).length, 1);
    assert.notEqual(db.users.get(u.id).password_hash, "a-brand-new-password");
    assert.equal((await s.post("/api/auth/login", { email: "a@example.com", password: PW })).status, 401);
    assert.equal((await s.post("/api/auth/login", { email: "a@example.com", password: "a-brand-new-password" })).status, 200);
  });
});

test("reset: the same token twice, the second is 400 invalid_token", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const token = await resetToken(s);
    assert.equal((await s.post("/api/auth/reset", { token, password: "a-brand-new-password" })).status, 204);
    const r = await s.post("/api/auth/reset", { token, password: "another-new-password" });
    assert.deepEqual([r.status, r.body], [400, { error: "invalid_token" }]);
  });
});

test("reset: an expired token (over 30 minutes) is 400", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const token = await resetToken(s);
    s.clock.advance(30 * 60_000 + 1);
    const r = await s.post("/api/auth/reset", { token, password: "a-brand-new-password" });
    assert.deepEqual([r.status, r.body], [400, { error: "invalid_token" }]);
  });
});

test("reset: weak password is 400 weak_password and does not use up the token", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const token = await resetToken(s);
    const r = await s.post("/api/auth/reset", { token, password: "short" });
    assert.deepEqual([r.status, r.body], [400, { error: "weak_password" }]);
    assert.equal((await s.post("/api/auth/reset", { token, password: "a-brand-new-password" })).status, 204);
  });
});

// breached / obvious passwords
test("signup: breached password is 400 breached_password and creates no user", async () => {
  const db = fakeDb();
  await withApp({ db, isBreached: async () => true }, async (s) => {
    const r = await s.post("/api/auth/signup", { email: "a@example.com", password: PW });
    assert.deepEqual([r.status, r.body], [400, { error: "breached_password" }]);
    assert.equal(db.users.size, 0);
  });
});

test("signup: obvious passwords are 400 weak_password, without asking the breach API", async () => {
  const db = fakeDb();
  let asked = 0;
  await withApp({ db, isBreached: async () => { asked++; return false; } }, async (s) => {
    const r = await s.post("/api/auth/signup", { email: "marathon@example.com", password: "my-MARATHON-2024" });
    assert.deepEqual([r.status, r.body], [400, { error: "weak_password" }]);
    assert.equal((await s.post("/api/auth/signup", { email: "b@example.com", password: "handshake-rocks" })).status, 400);
    assert.equal(db.users.size, 0);
    assert.equal(asked, 0);
  });
});

test("signup: succeeds when the breach check fails open", async () => {
  await withApp({ isBreached: async () => false }, async (s) => {
    assert.equal((await s.post("/api/auth/signup", { email: "a@example.com", password: PW })).status, 201);
  });
});

test("reset: breached or obvious password is 400 and does not use up the token", async () => {
  const db = fakeDb();
  let breached = true;
  await addUser(db, { email: "a@example.com" });
  await withApp({ db, isBreached: async () => breached }, async (s) => {
    const token = await resetToken(s);
    const r = await s.post("/api/auth/reset", { token, password: PW });
    assert.deepEqual([r.status, r.body], [400, { error: "breached_password" }]);
    assert.equal([...db.resets.values()][0].used, false);
    assert.deepEqual((await s.post("/api/auth/reset", { token, password: "handshake-pass-1" })).body, { error: "weak_password" });
    assert.equal([...db.resets.values()][0].used, false);
    breached = false;
    assert.equal((await s.post("/api/auth/reset", { token, password: "a-brand-new-password" })).status, 204);
  });
});

// squatter's saved state
test("google linking: unverified account's saved state is deleted; verified account keeps its state", async () => {
  const db = fakeDb();
  const squatter = await addUser(db, { email: "owner@example.com", verified: false });
  db.states.set(squatter.id, { profile: { you: "Evil" } });
  const real = await addUser(db, { email: "new@gmail.com", verified: true });
  db.states.set(real.id, { profile: { you: "Real" } });
  await withApp({ db }, async (s) => {
    assert.equal((await s.post("/api/auth/google", { credential: "g-squat" })).status, 200);
    assert.equal(db.states.has(squatter.id), false);
    assert.equal((await s.post("/api/auth/google", { credential: "g-new" })).status, 200);
    assert.deepEqual(db.states.get(real.id), { profile: { you: "Real" } });
  });
});

// logout
test("logout: 204, clears the cookie, deletes the session", async () => {
  const db = fakeDb();
  await addUser(db, { email: "a@example.com" });
  await withApp({ db }, async (s) => {
    const login = await s.post("/api/auth/login", { email: "a@example.com", password: PW });
    assert.equal(db.sessions.size, 1);
    const r = await s.request("POST", "/api/auth/logout", { headers: { Cookie: `${COOKIE}=${tokenOf(login)}` } });
    assert.equal(r.status, 204);
    assert.match(cookieOf(r), new RegExp(`^${COOKIE}=;.*Max-Age=0`));
    assert.equal(db.sessions.size, 0);
  });
});

// origin
test("origin: a cross-site POST is 403 forbidden on every auth route", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    for (const url of ["signup", "login", "google", "logout", "forgot", "reset"]) {
      const r = await s.post(`/api/auth/${url}`, { email: "a@example.com", password: PW }, { Origin: "https://evil.example" });
      assert.deepEqual([r.status, r.body], [403, { error: "forbidden" }], url);
    }
    assert.equal(db.users.size, 0);
    // same origin passes
    const ok = await s.post("/api/auth/signup", { email: "a@example.com", password: PW }, { Origin: s.base });
    assert.equal(ok.status, 201);
  });
});

// off state
test("db null: every POST is 503 accounts_unavailable and config reports accounts false", async () => {
  await withApp({ db: null }, async (s) => {
    const bodies = { signup: { email: "a@example.com", password: PW }, login: { email: "a@example.com", password: PW },
      google: { credential: "g-new" }, forgot: { email: "a@example.com" }, reset: { token: "t", password: PW } };
    for (const [url, body] of Object.entries(bodies)) {
      const r = await s.post(`/api/auth/${url}`, body);
      assert.deepEqual([r.status, r.body], [503, { error: "accounts_unavailable" }], url);
    }
    assert.equal((await s.post("/api/auth/logout")).status, 204); // logout has nothing to do without a db
    const c = await s.request("GET", "/api/auth/config");
    assert.deepEqual(c.body, { accounts: false, googleClientId: null, resetEmail: false });
  });
});

test("config reports accounts, the Google client id and reset email when set up", async () => {
  await withApp({}, async (s) => {
    assert.deepEqual((await s.request("GET", "/api/auth/config")).body, { accounts: true, googleClientId: "client-id", resetEmail: true });
  });
});

// logs
test("logs never contain emails, passwords or tokens, even when the db fails", async (t) => {
  const logs = [];
  for (const m of ["log", "error", "warn", "info"]) t.mock.method(console, m, (...a) => logs.push(a.map(String).join(" ")));
  const broken = fakeDb();
  for (const k of ["createUser", "findUserByEmail", "findUserByGoogleSub", "consumeReset", "createSession"]) {
    broken[k] = async () => { throw new Error("db down for secret@example.com " + PW); };
  }
  const sendFail = async () => { throw new Error("resend rejected secret@example.com"); };
  await withApp({ db: broken, sendResetEmail: sendFail }, async (s) => {
    assert.equal((await s.post("/api/auth/signup", { email: "secret@example.com", password: PW })).status, 503);
    assert.equal((await s.post("/api/auth/login", { email: "secret@example.com", password: PW })).status, 503);
    assert.equal((await s.post("/api/auth/google", { credential: "g-new" })).status, 503);
    assert.equal((await s.post("/api/auth/reset", { token: "secret-token", password: PW })).status, 503);
    assert.equal((await s.post("/api/auth/forgot", { email: "secret@example.com" })).status, 202);
    await settle();
  });
  const db = fakeDb();
  await addUser(db, { email: "secret@example.com" });
  await withApp({ db, sendResetEmail: sendFail }, async (s) => {
    await s.post("/api/auth/forgot", { email: "secret@example.com" });
    await settle();
  });
  assert.ok(logs.length >= 5, `expected failure logs, got ${logs.length}`);
  const all = logs.join("\n");
  assert.doesNotMatch(all, /secret|@|horse|token|new@gmail/i);
});
