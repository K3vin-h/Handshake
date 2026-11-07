# Sponsor Tracks Implementation Plan

> **For agentic workers:** execute with superpowers:subagent-driven-development (recommended) or superpowers:executing-plans, task by task, in a worktree (`sponsor-tracks`). Steps use `- [ ]` checkboxes for tracking. Commit via `git-manager`.

**Spec:** docs/superpowers/specs/2026-11-07-sponsor-tracks-spec.md
**Goal:** Add Tiger Data, Maritime, n8n, Vultr + GoDaddy, Databricks and Entire to Handshake, each off until its env vars are set.
**Architecture:** One server module per integration (`register(app, deps)`), wired by `server/integrations.mjs` from env. A separate `agent/` package runs on Maritime. The client gets a `#/stats` page and two fire-and-forget reporters. Deploy, training and n8n live in their own folders.
**Tech stack:** Express 5, `pg`, Node 26 `node --test`, `@google/genai`, React 19 + TypeScript, Caddy + systemd, Databricks + MLflow, n8n.

## Context
- **Merged and working today:** Vite + React app, `server/index.mjs` with `/api/path|coach|words` (`/api/path` is removed by the starter plan and group-3 Task 2), `src/lib/{api,curriculum,progress}.ts`, `training/train.py`.
- **Hard prerequisite (Task 0 checks it):** the starter plan and group-3 Task 2 are merged: `server/app.mjs` exports `createApp`, `src/lib/profile.ts` exports `loadProfile` and `DEMO_PROFILE`, `package.json` has `"test": "node --test ..."`, and `/api/path` is removed (names never reach Gemini).
- **Delivers:** the six units in the spec (U0–U11).
- **Out of scope:** Auth0, Solana, Lovable, DeepSpace, Freebuff, hardware (spec → Track Coverage). `LessonPlayer` itself (plan 2).
- **Real chain for every mutation here:** per-IP `rateLimit` (first, so junk requests can't flood us) → JSON body shape/regex validation (`server/validate.mjs`) → write/forward. There is no auth and no ownership check; the spec's Security section accepts that.

## File Map
| File | Responsibility |
|---|---|
| `server/limit.mjs` | Fixed-window per-IP rate limit middleware |
| `server/validate.mjs` | Shared regexes and small validators |
| `server/testutil.mjs` | `serve(setup)` test helper: bare Express app on a free port |
| `server/db.mjs`, `server/schema.sql`, `server/migrate.mjs` | Tiger Data pool, queries, schema, one-shot migration |
| `server/db.smoke.mjs` | Manual check against the real Tiger Cloud DB |
| `server/routes/attempts.mjs` | `POST /api/attempts`, `GET /api/stats/:learnerId` |
| `server/routes/notify.mjs` | `POST /api/subscribe`, `POST /api/lesson-complete` → n8n |
| `server/routes/plan.mjs` | `POST /api/plan` → Maritime agent, guard, local fallback |
| `server/integrations.mjs` | Reads env, builds clients, registers all routes + `GET /api/features` |
| `server/index.mjs` (modify) | Call `registerIntegrations`, serve `dist/` in production |
| `agent/plan.mjs`, `agent/server.mjs`, `agent/package.json`, `agent/Dockerfile` | Maritime planner agent |
| `src/lib/learner.ts` | Anonymous learner UUID |
| `src/lib/track.ts` | `reportAttempt`, `reportLessonComplete`, notify flag |
| `src/lib/planInput.ts` | `buildPlanRequest` (candidates, known/weak letters) |
| `src/lib/api.ts` (modify) | `getFeatures`, `getStats`, `planToday`, `subscribe` |
| `src/screens/StatsPage.tsx`, `src/components/{AccuracyChart,NotifySettings,PlanCard}.tsx` | `#/stats` UI |
| `src/App.tsx`, `src/styles.css` (modify) | Route, nav link, `.visually-hidden` |
| `deploy/setup.sh` | Vultr VM bootstrap: Node, Caddy, systemd, ufw |
| `training/train.py` (modify), `training/test_train_smoke.py`, `training/databricks/train_job.py` | `main(argv)` refactor, smoke test, Databricks notebook |
| `n8n/README.md` (+ exported workflow JSON) | Workflow build notes and exports |
| `docs/devpost-tracks.md` | Per-track Devpost evidence checklist |
| `.env.example`, `README.md` (modify) | New env vars, run notes |

## Execution Order
1. **Task 0** (sequential, first): prerequisites, deps, test glob.
2. **Task 1** (sequential): `limit` + `validate` + `testutil`. Tasks 2–4 import them.
3. **Tasks 2, 3, 4** (parallel, disjoint files) → **Task 5** (wires them, edits `index.mjs`).
4. **Tasks 6 → 7** (client, sequential), **Task 8** (agent), **Task 9** (deploy), **Task 10** (Databricks): each independent of the server tasks. They only share the HTTP contract in the spec.
5. **Tasks 11, 12** are human setup (n8n, Entire). **Task 13** (call-site wiring + Devpost doc) last. Wiring needs `LessonPlayer`.
6. Run `/check` after Task 5 (server unit), after Task 7 (client unit), and before `/ship`. Security-sensitive: Tasks 3, 4, 5, 9 get `security-reviewer` (user data: emails and names → `model: "opus"` per the global rules).

**Reporting rule (CLAUDE.md):** every task report ends with "Tested (what you ran, what you saw) / Not tested", and never says "works". Commit after each working step; no push to main unless asked.

## Parallel agent split
| Agent | Tasks | Exclusive files | Verify |
|---|---|---|---|
| S | 1 → (2, 3, 4) → 5 | `server/**` (except `index.mjs` which only Task 5 touches), `.env.example` | `npm test` |
| C | 6 → 7 | `src/lib/{learner,track,planInput,api}.ts`, `src/screens/StatsPage.tsx`, `src/components/{AccuracyChart,NotifySettings,PlanCard}.tsx`, `src/App.tsx`, `src/styles.css` | `npm test && npm run build` |
| A | 8 | `agent/**` | `node --test agent/plan.test.mjs` |
| D | 9 | `deploy/**` | `bash -n deploy/setup.sh` |
| M | 10 | `training/train.py`, `training/test_train_smoke.py`, `training/databricks/**` | `python3 training/test_train_smoke.py` |

`package.json` is only edited in Task 0, before the split.

---

## Task 0 — Prerequisites, dependency, test glob

**Files:** Modify `package.json`.

- [ ] **Step 1: Check prerequisites** (all must pass, otherwise stop and finish the starter/group-3 work first)
```bash
cd "/Users/shibah/Documents/VS Code/hackcamp/Handshake"
test -f server/app.mjs && grep -q "export function createApp" server/app.mjs && echo "createApp ok"
grep -q "export function loadProfile" src/lib/profile.ts && grep -q "DEMO_PROFILE" src/lib/profile.ts && echo "profile ok"
grep -q '"test"' package.json && echo "test script ok"
! grep -n "userName" server/index.mjs server/app.mjs && echo "no names on the server"
```
Expected: four `ok`/message lines, no grep match output for `userName`.
- [ ] **Step 2: Install `pg`** — `npm install pg`
- [ ] **Step 3: Add the agent test glob.** In `package.json` change the `test` script so it ends with the agent glob, e.g.
`"test": "node --test \"src/**/*.test.ts\" \"server/**/*.test.mjs\" \"agent/**/*.test.mjs\""`
(keep whatever globs the starter already put there, add only the last one).
- [ ] **Step 4: Verify** — `npm test` → still passes (the new glob matches nothing yet).
- [ ] **Step 5: Commit** — `chore: add pg and agent test glob`

---

## Task 1 — Rate limit, validators, test helper (U0)

**Files:** Create `server/limit.mjs`, `server/validate.mjs`, `server/testutil.mjs` · Test `server/limit.test.mjs`, `server/validate.test.mjs`

- [ ] **Step 1: Write the failing tests**

`server/limit.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./limit.mjs";

function run(mw, ip = "1.1.1.1") {
  let status = 200;
  let body = null;
  let nexted = false;
  const res = {
    status(c) {
      status = c;
      return this;
    },
    json(b) {
      body = b;
      return this;
    },
  };
  mw({ ip }, res, () => {
    nexted = true;
  });
  return { status, body, nexted };
}

test("blocks the request after max hits in the window", () => {
  const mw = rateLimit({ windowMs: 1000, max: 2, now: () => 0 });
  assert.ok(run(mw).nexted);
  assert.ok(run(mw).nexted);
  const third = run(mw);
  assert.equal(third.nexted, false);
  assert.equal(third.status, 429);
  assert.deepEqual(third.body, { error: "rate_limited" });
});

test("allows again after the window passes", () => {
  let t = 0;
  const mw = rateLimit({ windowMs: 1000, max: 1, now: () => t });
  assert.ok(run(mw).nexted);
  assert.equal(run(mw).nexted, false);
  t = 1000;
  assert.ok(run(mw).nexted);
});

test("counts each IP separately", () => {
  const mw = rateLimit({ windowMs: 1000, max: 1, now: () => 0 });
  assert.ok(run(mw, "1.1.1.1").nexted);
  assert.ok(run(mw, "2.2.2.2").nexted);
});
```
`server/validate.test.mjs`
```js
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
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test server/limit.test.mjs server/validate.test.mjs` → FAIL: `Cannot find module './limit.mjs'`
- [ ] **Step 3: Implement**

`server/limit.mjs`
```js
// Fixed-window per-IP limiter. In production Express trusts one proxy hop (Caddy), so req.ip is the real client.
export function rateLimit({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  return (req, res, next) => {
    const t = now();
    if (hits.size > 5000) for (const [ip, h] of hits) if (t - h.start >= windowMs) hits.delete(ip);
    const h = hits.get(req.ip);
    if (!h || t - h.start >= windowMs) {
      hits.set(req.ip, { start: t, n: 1 });
      return next();
    }
    if (++h.n > max) return res.status(429).json({ error: "rate_limited" });
    next();
  };
}
```
`server/validate.mjs`
```js
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ITEM_RE = /^[A-Z][A-Z0-9_-]{0,19}$/; // letters and sign ids; "fs:LILY" (may be a name) never matches
export const CODE_RE = /^[a-z]+:[a-z]+$/;
export const LESSON_RE = /^\d+\.\d+$/;
export const NAME_RE = /^[\p{L} '-]{1,40}$/u;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;

export const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
export const isLetters = (a, max) => Array.isArray(a) && a.length <= max && a.every((c) => typeof c === "string" && /^[A-Z]$/.test(c));
```
`server/testutil.mjs`
```js
import express from "express";

// Starts a bare Express app on a free port. `setup(app)` registers the routes under test.
export async function serve(setup) {
  const app = express();
  app.use(express.json());
  setup(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = async (res) => ({ status: res.status, body: res.status === 204 ? null : await res.json() });
  return {
    base,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections?.();
        server.close(r);
      }),
    post: async (url, body) =>
      read(await fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    get: async (url) => read(await fetch(base + url)),
  };
}
```
- [ ] **Step 4: Run, confirm PASS** — same command → all tests PASS
- [ ] **Step 5: Commit** — `feat: rate limit and shared validators`

---

## Task 2 — Tiger Data: schema, db, attempts routes (U1, U2)

**Files:** Create `server/schema.sql`, `server/migrate.mjs`, `server/db.mjs`, `server/db.smoke.mjs`, `server/routes/attempts.mjs` · Test `server/routes/attempts.test.mjs`

- [ ] **Step 1: Write the failing test** `server/routes/attempts.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { serve } from "../testutil.mjs";
import { register } from "./attempts.mjs";

const id = randomUUID();
const NOW = 1_800_000_000_000;

function fakeDb({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    insertAttempts: async (learnerId, rows) => {
      if (fail) throw new Error("db down");
      calls.push({ learnerId, rows });
    },
    stats: async () => ({ daily: [{ day: "2026-11-07", attempts: 3, accuracy: 0.5 }], items: [] }),
  };
}

async function withApp(deps, fn) {
  const s = await serve((app) => register(app, { now: () => NOW, ...deps }));
  try {
    return await fn(s);
  } finally {
    await s.close();
  }
}

test("stores a valid batch and answers 204", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/attempts", {
      learnerId: id,
      attempts: [{ item: "L", correct: true }, { item: "I", correct: false, codes: ["thumb:placement"] }],
    });
    assert.equal(r.status, 204);
    assert.equal(db.calls.length, 1);
    assert.equal(db.calls[0].learnerId, id);
    assert.deepEqual(db.calls[0].rows.map((x) => x.item), ["L", "I"]);
    assert.deepEqual(db.calls[0].rows[1].codes, ["thumb:placement"]);
  });
});

test("rejects the whole batch when an item is a fingerspelled word", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    const r = await s.post("/api/attempts", { learnerId: id, attempts: [{ item: "L", correct: true }, { item: "fs:LILY", correct: true }] });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body, { error: "bad_request" });
    assert.equal(db.calls.length, 0);
  });
});

test("rejects a bad learner id, an empty batch and a bad code", async () => {
  await withApp({ db: fakeDb() }, async (s) => {
    assert.equal((await s.post("/api/attempts", { learnerId: "x", attempts: [{ item: "L", correct: true }] })).status, 400);
    assert.equal((await s.post("/api/attempts", { learnerId: id, attempts: [] })).status, 400);
    assert.equal((await s.post("/api/attempts", { learnerId: id, attempts: [{ item: "L", correct: true, codes: ["DROP TABLE"] }] })).status, 400);
  });
});

test("replaces an old or future timestamp with now and keeps a recent one", async () => {
  const db = fakeDb();
  await withApp({ db }, async (s) => {
    await s.post("/api/attempts", {
      learnerId: id,
      attempts: [{ item: "L", correct: true, ts: 1 }, { item: "I", correct: true, ts: NOW + 99_999 }, { item: "O", correct: true, ts: NOW - 60_000 }],
    });
    const [old, future, recent] = db.calls[0].rows.map((r) => r.ts.getTime());
    assert.equal(old, NOW);
    assert.equal(future, NOW);
    assert.equal(recent, NOW - 60_000);
  });
});

test("answers 204 without a db (off state) and when the db fails", async () => {
  await withApp({ db: null }, async (s) => {
    assert.equal((await s.post("/api/attempts", { learnerId: id, attempts: [{ item: "L", correct: true }] })).status, 204);
  });
  await withApp({ db: fakeDb({ fail: true }) }, async (s) => {
    assert.equal((await s.post("/api/attempts", { learnerId: id, attempts: [{ item: "L", correct: true }] })).status, 204);
  });
});

test("stats returns the db result, or empty lists without a db", async () => {
  await withApp({ db: fakeDb() }, async (s) => {
    const r = await s.get(`/api/stats/${id}`);
    assert.equal(r.body.daily[0].attempts, 3);
    assert.equal((await s.get("/api/stats/nope")).status, 400);
  });
  await withApp({ db: null }, async (s) => {
    assert.deepEqual((await s.get(`/api/stats/${id}`)).body, { daily: [], items: [] });
  });
});
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test server/routes/attempts.test.mjs` → FAIL: `Cannot find module './attempts.mjs'`
- [ ] **Step 3: Implement**

`server/schema.sql`
```sql
CREATE TABLE IF NOT EXISTS attempts (
  ts         timestamptz NOT NULL DEFAULT now(),
  learner_id uuid        NOT NULL,
  item       text        NOT NULL,
  correct    boolean     NOT NULL,
  codes      text[]      NOT NULL DEFAULT '{}'
);
SELECT create_hypertable('attempts', by_range('ts'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS attempts_learner_ts ON attempts (learner_id, ts DESC);
```
`server/migrate.mjs`
```js
// One-shot: node server/migrate.mjs  (needs DATABASE_URL in .env)
import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env first.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  console.log("schema applied");
} finally {
  await pool.end();
}
```
`server/db.mjs`
```js
import pg from "pg";

const WINDOW = "interval '14 days'";

// Tiger Data (TimescaleDB). All values go through $n placeholders.
export function createDb(url) {
  const pool = new pg.Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 3000 });
  pool.on("error", (e) => console.error("pg pool error:", e.message));
  return {
    async insertAttempts(learnerId, rows) {
      const values = [];
      const tuples = rows.map((r, i) => {
        values.push(r.ts, learnerId, r.item, r.correct, r.codes);
        const o = i * 5;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`;
      });
      await pool.query(`INSERT INTO attempts (ts, learner_id, item, correct, codes) VALUES ${tuples.join(", ")}`, values);
    },
    async stats(learnerId) {
      const daily = await pool.query(
        `SELECT to_char(time_bucket('1 day', ts), 'YYYY-MM-DD') AS day, count(*)::int AS attempts, avg(correct::int)::float AS accuracy
         FROM attempts WHERE learner_id = $1 AND ts > now() - ${WINDOW} GROUP BY 1 ORDER BY 1`,
        [learnerId],
      );
      const items = await pool.query(
        `SELECT item, count(*)::int AS attempts, avg(correct::int)::float AS accuracy
         FROM attempts WHERE learner_id = $1 AND ts > now() - ${WINDOW}
         GROUP BY item HAVING count(*) >= 3 ORDER BY accuracy ASC, attempts DESC LIMIT 5`,
        [learnerId],
      );
      return { daily: daily.rows, items: items.rows };
    },
    close: () => pool.end(),
  };
}
```
`server/routes/attempts.mjs`
```js
import { rateLimit } from "../limit.mjs";
import { UUID_RE, ITEM_RE, CODE_RE } from "../validate.mjs";

const DAY = 86_400_000;
const bad = (res) => res.status(400).json({ error: "bad_request" });

export function register(app, { db, now = Date.now }) {
  app.post("/api/attempts", rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
    const { learnerId, attempts } = req.body ?? {};
    if (!UUID_RE.test(learnerId) || !Array.isArray(attempts) || attempts.length < 1 || attempts.length > 50) return bad(res);
    const t = now();
    const rows = [];
    for (const a of attempts) {
      const codes = a?.codes ?? [];
      const valid =
        typeof a?.item === "string" && ITEM_RE.test(a.item) && typeof a.correct === "boolean" &&
        Array.isArray(codes) && codes.length <= 5 && codes.every((c) => typeof c === "string" && CODE_RE.test(c));
      if (!valid) return bad(res);
      const fresh = Number.isFinite(a.ts) && a.ts <= t && t - a.ts <= DAY;
      rows.push({ ts: new Date(fresh ? a.ts : t), item: a.item, correct: a.correct, codes });
    }
    if (db) {
      try {
        await db.insertAttempts(learnerId, rows);
      } catch (e) {
        console.error("attempts insert failed:", e.message); // practice must never fail because the DB did
      }
    }
    res.sendStatus(204);
  });

  app.get("/api/stats/:learnerId", rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
    if (!UUID_RE.test(req.params.learnerId)) return bad(res);
    if (!db) return res.json({ daily: [], items: [] });
    try {
      res.json(await db.stats(req.params.learnerId));
    } catch (e) {
      console.error("stats failed:", e.message);
      res.json({ daily: [], items: [] });
    }
  });
}
```
`server/db.smoke.mjs`
```js
// Manual check: node server/db.smoke.mjs  (after node server/migrate.mjs). Exits 1 on failure.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createDb } from "./db.mjs";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env first.");
  process.exit(1);
}
const db = createDb(process.env.DATABASE_URL);
const id = randomUUID();
const ts = new Date();
try {
  await db.insertAttempts(id, [
    { ts, item: "L", correct: true, codes: [] },
    { ts, item: "L", correct: false, codes: ["thumb:placement"] },
    { ts, item: "L", correct: true, codes: [] },
  ]);
  const s = await db.stats(id);
  console.log(JSON.stringify(s));
  if (s.daily[0]?.attempts !== 3 || s.items[0]?.item !== "L") process.exit(1);
  console.log("db smoke ok");
} finally {
  await db.close();
}
```
- [ ] **Step 4: Run, confirm PASS** — `node --test server/routes/attempts.test.mjs` → PASS (6 tests)
- [ ] **Step 5 (human, needs a Tiger Cloud free service): real DB.** Create the service, put its connection string in `.env` as `DATABASE_URL`, then `node server/migrate.mjs && node server/db.smoke.mjs` → prints `schema applied`, a JSON line with `"attempts":3`, and `db smoke ok`.
- [ ] **Step 6: Commit** — `feat: tiger data attempts and stats`

---

## Task 3 — n8n forwarding routes (U3)

**Files:** Create `server/routes/notify.mjs` · Test `server/routes/notify.test.mjs`

- [ ] **Step 1: Write the failing test** `server/routes/notify.test.mjs`
```js
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
    assert.deepEqual(JSON.parse(f.calls[0].init.body), {
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

test("unsubscribe forwards only the action and learner id", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    const r = await s.post("/api/subscribe", { action: "unsubscribe", learnerId: id });
    assert.deepEqual(r.body, { ok: true });
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { action: "unsubscribe", learnerId: id });
  });
});

test("lesson-complete forwards to the event webhook and validates fields", async () => {
  const f = fakeFetch();
  await withApp({ n8n, fetch: f }, async (s) => {
    const r = await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", lessonTitle: "Spell RYAN", xp: 20 });
    assert.deepEqual(r.body, { ok: true });
    assert.equal(f.calls[0].url, n8n.eventUrl);
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { learnerId: id, lessonId: "1.2", lessonTitle: "Spell RYAN", xp: 20 });
    assert.equal((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "x", lessonTitle: "t", xp: 20 })).status, 400);
    assert.equal((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", lessonTitle: "t", xp: 5000 })).status, 400);
    assert.equal(f.calls.length, 1);
  });
});

test("answers ok:false when n8n is off, down, or rejects", async () => {
  await withApp({ n8n: null, fetch: fakeFetch() }, async (s) => {
    assert.deepEqual((await s.post("/api/subscribe", sub)).body, { ok: false, reason: "disabled" });
    assert.deepEqual((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", lessonTitle: "t", xp: 1 })).body, { ok: false, reason: "disabled" });
  });
  await withApp({ n8n, fetch: fakeFetch({ throws: true }) }, async (s) => {
    assert.deepEqual((await s.post("/api/subscribe", sub)).body, { ok: false, reason: "upstream" });
  });
  await withApp({ n8n, fetch: fakeFetch({ ok: false }) }, async (s) => {
    assert.deepEqual((await s.post("/api/lesson-complete", { learnerId: id, lessonId: "1.2", lessonTitle: "t", xp: 1 })).body, { ok: false, reason: "upstream" });
  });
});
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test server/routes/notify.test.mjs` → FAIL: `Cannot find module './notify.mjs'`
- [ ] **Step 3: Implement** `server/routes/notify.mjs`
```js
import { rateLimit } from "../limit.mjs";
import { UUID_RE, LESSON_RE, NAME_RE, isEmail } from "../validate.mjs";

const bad = (res) => res.status(400).json({ error: "bad_request" });
const limit = () => rateLimit({ windowMs: 60_000, max: 10 });

// Names and emails leave the server only here, only for n8n, only with consent (the client form requires the checkbox).
export function register(app, { n8n, fetch: f = fetch }) {
  async function forward(url, body) {
    try {
      const r = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Handshake-Secret": n8n.secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      return r.ok ? { ok: true } : { ok: false, reason: "upstream" };
    } catch (e) {
      console.error("n8n forward failed:", e.message);
      return { ok: false, reason: "upstream" };
    }
  }

  app.post("/api/subscribe", limit(), async (req, res) => {
    const b = req.body ?? {};
    if (!UUID_RE.test(b.learnerId)) return bad(res);
    let payload;
    if (b.action === "unsubscribe") {
      payload = { action: "unsubscribe", learnerId: b.learnerId };
    } else if (b.action === "subscribe") {
      const names = ["userName", "theirName"].filter((k) => b[k] !== undefined);
      const emails = ["learnerEmail", "contactEmail"].filter((k) => b[k] !== undefined);
      const valid =
        b.consent === true && emails.length > 0 &&
        names.every((k) => typeof b[k] === "string" && NAME_RE.test(b[k])) && emails.every((k) => isEmail(b[k]));
      if (!valid) return bad(res);
      payload = { action: "subscribe", learnerId: b.learnerId };
      for (const k of [...names, ...emails]) payload[k] = b[k];
    } else {
      return bad(res);
    }
    if (!n8n) return res.json({ ok: false, reason: "disabled" });
    res.json(await forward(n8n.subscribeUrl, payload));
  });

  app.post("/api/lesson-complete", limit(), async (req, res) => {
    const { learnerId, lessonId, lessonTitle, xp } = req.body ?? {};
    const valid =
      UUID_RE.test(learnerId) && LESSON_RE.test(lessonId) &&
      typeof lessonTitle === "string" && lessonTitle.length >= 1 && lessonTitle.length <= 80 &&
      Number.isInteger(xp) && xp >= 0 && xp <= 1000;
    if (!valid) return bad(res);
    if (!n8n) return res.json({ ok: false, reason: "disabled" });
    res.json(await forward(n8n.eventUrl, { learnerId, lessonId, lessonTitle, xp }));
  });
}
```
- [ ] **Step 4: Run, confirm PASS** — same command → PASS (5 tests)
- [ ] **Step 5: Commit** — `feat: n8n subscribe and lesson-complete forwarding`

---

## Task 4 — Plan route with Maritime agent proxy (U4)

**Files:** Create `server/routes/plan.mjs` · Test `server/routes/plan.test.mjs`

- [ ] **Step 1: Write the failing test** `server/routes/plan.test.mjs`
```js
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
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test server/routes/plan.test.mjs` → FAIL: `Cannot find module './plan.mjs'`
- [ ] **Step 3: Implement** `server/routes/plan.mjs`
```js
import { rateLimit } from "../limit.mjs";
import { UUID_RE, LESSON_RE, isLetters } from "../validate.mjs";

const LOCAL_TIP = "Short, steady practice beats a long session. Take your time with each handshape.";
const MAX_TIP = 200;
const AGENT_TIMEOUT_MS = 8000;
const bad = (res) => res.status(400).json({ error: "bad_request" });

function localPlan({ candidates, knownLetters, weakLetters }) {
  const known = new Set(knownLetters);
  return { lessonId: candidates[0].id, focus: weakLetters.filter((l) => known.has(l)).slice(0, 3), words: [], tip: LOCAL_TIP, source: "local" };
}

// The agent is an LLM: accept its reply only if it picks a real candidate and stays inside what the learner knows.
function guardAgentPlan(raw, { candidates, knownLetters }) {
  if (!raw || typeof raw !== "object") return null;
  const known = new Set(knownLetters);
  const { lessonId, focus, words, tip } = raw;
  if (!candidates.some((c) => c.id === lessonId)) return null;
  if (!isLetters(focus, 3) || !focus.every((l) => known.has(l))) return null;
  if (!Array.isArray(words) || words.length > 6) return null;
  if (!words.every((w) => typeof w === "string" && /^[A-Z]{2,8}$/.test(w) && [...w].every((c) => known.has(c)))) return null;
  if (typeof tip !== "string" || !tip.trim()) return null;
  return { lessonId, focus, words, tip: tip.slice(0, MAX_TIP), source: "agent" };
}

export function register(app, { agent, fetch: f = fetch }) {
  app.post("/api/plan", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
    const { learnerId, candidates, knownLetters, weakLetters = [] } = req.body ?? {};
    const valid =
      UUID_RE.test(learnerId) && Array.isArray(candidates) && candidates.length >= 1 && candidates.length <= 20 &&
      candidates.every((c) => c && LESSON_RE.test(c.id) && isLetters(c.letters, 26)) &&
      isLetters(knownLetters, 26) && isLetters(weakLetters, 26);
    if (!valid) return bad(res);
    // Rebuild each candidate so no extra client field (a title, a name) can reach the agent.
    const input = { candidates: candidates.map((c) => ({ id: c.id, letters: c.letters })), knownLetters, weakLetters };
    if (!agent) return res.json(localPlan(input));
    try {
      const r = await f(agent.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.token}` },
        body: JSON.stringify({ learnerId, candidates: input.candidates, knownLetters }),
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`agent ${r.status}`);
      res.json(guardAgentPlan(await r.json(), input) ?? localPlan(input));
    } catch (e) {
      console.error("planner agent failed:", e.message);
      res.json(localPlan(input));
    }
  });
}
```
- [ ] **Step 4: Run, confirm PASS** — same command → PASS (7 tests)
- [ ] **Step 5: Commit** — `feat: practice plan route with maritime agent proxy`

---

## Task 5 — Wire integrations, features endpoint, static serving (U5)

**Files:** Create `server/integrations.mjs` · Modify `server/index.mjs`, `.env.example` · Test `server/integrations.test.mjs`

- [ ] **Step 1: Write the failing test** `server/integrations.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { serve } from "./testutil.mjs";
import { registerIntegrations } from "./integrations.mjs";

const id = randomUUID();

test("with no env: every feature is off and every route still answers", async () => {
  const s = await serve((app) => registerIntegrations(app, {}));
  try {
    assert.deepEqual((await s.get("/api/features")).body, { stats: false, notify: false, agent: false });
    assert.equal((await s.post("/api/attempts", { learnerId: id, attempts: [{ item: "L", correct: true }] })).status, 204);
    assert.deepEqual((await s.get(`/api/stats/${id}`)).body, { daily: [], items: [] });
    const sub = await s.post("/api/subscribe", { action: "subscribe", learnerId: id, consent: true, contactEmail: "a@b.co" });
    assert.deepEqual(sub.body, { ok: false, reason: "disabled" });
    const plan = await s.post("/api/plan", { learnerId: id, candidates: [{ id: "1.1", letters: ["A"] }], knownLetters: ["A"] });
    assert.equal(plan.body.source, "local");
  } finally {
    await s.close();
  }
});

test("with env set: every feature is on", async () => {
  let integrations;
  const s = await serve((app) => {
    integrations = registerIntegrations(app, {
      DATABASE_URL: "postgres://u:p@127.0.0.1:1/db",
      N8N_SUBSCRIBE_URL: "http://n8n.test/sub",
      N8N_EVENT_URL: "http://n8n.test/evt",
      N8N_SECRET: "x",
      MARITIME_AGENT_URL: "http://agent.test/plan",
      MARITIME_AGENT_TOKEN: "t",
    });
  });
  try {
    assert.deepEqual((await s.get("/api/features")).body, { stats: true, notify: true, agent: true });
  } finally {
    await s.close();
    await integrations.db?.close();
  }
});
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test server/integrations.test.mjs` → FAIL: `Cannot find module './integrations.mjs'`
- [ ] **Step 3: Implement** `server/integrations.mjs`
```js
import { createDb } from "./db.mjs";
import { register as registerAttempts } from "./routes/attempts.mjs";
import { register as registerNotify } from "./routes/notify.mjs";
import { register as registerPlan } from "./routes/plan.mjs";

// Each integration is null unless its env vars are set, so the app runs exactly as before without them.
export function registerIntegrations(app, env = process.env) {
  const db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  const n8n =
    env.N8N_SUBSCRIBE_URL && env.N8N_EVENT_URL && env.N8N_SECRET
      ? { subscribeUrl: env.N8N_SUBSCRIBE_URL, eventUrl: env.N8N_EVENT_URL, secret: env.N8N_SECRET }
      : null;
  const agent = env.MARITIME_AGENT_URL && env.MARITIME_AGENT_TOKEN ? { url: env.MARITIME_AGENT_URL, token: env.MARITIME_AGENT_TOKEN } : null;

  if (env.SERVE_STATIC) app.set("trust proxy", 1); // one hop: Caddy
  registerAttempts(app, { db });
  registerNotify(app, { n8n });
  registerPlan(app, { agent });
  app.get("/api/features", (_req, res) => res.json({ stats: !!db, notify: !!n8n, agent: !!agent }));
  return { db };
}
```
- [ ] **Step 4: Run, confirm PASS** — same command → PASS (2 tests)
- [ ] **Step 5: Edit `server/index.mjs`.** It currently builds the app with group-3's `createApp(...)` and then calls `app.listen`. Make these changes (keep every existing line otherwise):
  1. Add imports at the top: `import express from "express";`, `import path from "node:path";`, `import { fileURLToPath } from "node:url";`, `import { registerIntegrations } from "./integrations.mjs";`
  2. Directly after the `const app = createApp(...)` line add:
```js
registerIntegrations(app);
if (process.env.SERVE_STATIC) {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
```
  3. Change the `app.listen(port, ...)` call to bind loopback in production: `app.listen(port, process.env.SERVE_STATIC ? "127.0.0.1" : undefined, () => { ...existing log... })`.
- [ ] **Step 6: Append to `.env.example`**
```
# Optional integrations. Each is off until its variables are set.
DATABASE_URL=            # Tiger Data (Tiger Cloud) connection string, sslmode=require
N8N_SUBSCRIBE_URL=       # n8n production webhook: subscribe/unsubscribe
N8N_EVENT_URL=           # n8n production webhook: lesson complete
N8N_SECRET=              # shared secret sent as X-Handshake-Secret
MARITIME_AGENT_URL=      # https://<your-agent>/plan
MARITIME_AGENT_TOKEN=    # bearer token the agent expects
SERVE_STATIC=            # set to 1 in production: serve dist/, bind 127.0.0.1, trust one proxy
```
- [ ] **Step 7: Verify** —
  - `npm test` → PASS.
  - Dev still works with no env: `node server/index.mjs` prints the API line; `curl -s localhost:8787/api/features` → `{"stats":false,"notify":false,"agent":false}`; stop it.
  - Production mode: `npm run build && SERVE_STATIC=1 node server/index.mjs`; `curl -sI localhost:8787/` → `200`, and `curl -s localhost:8787/#/stats -o /dev/null -w "%{http_code}"` → `200`; stop it.
- [ ] **Step 8: Commit** — `feat: wire integrations, features endpoint and static serving`
- [ ] **Step 9: `/check`** (server unit) with `security-reviewer` on Tasks 3, 4, 5 (`model: "opus"`: emails and names).

---

## Task 6 — Client libs (U7)

**Files:** Create `src/lib/learner.ts`, `src/lib/track.ts`, `src/lib/planInput.ts` · Modify `src/lib/api.ts` · Test `src/lib/track.test.ts`, `src/lib/planInput.test.ts`

Note: under `node --test`, relative imports need `.ts` extensions, and `progress.ts`/`curriculum.ts` can't be imported at runtime, so these files only use type imports from them.

- [ ] **Step 1: Write the failing tests**

`src/lib/track.test.ts`
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { reportAttempt, reportLessonComplete } from "./track.ts";

const ID = "11111111-1111-4111-8111-111111111111";

function spy(reject = false) {
  const calls: { url: string; body: any }[] = [];
  const send = async (url: string, body: unknown) => {
    calls.push({ url, body });
    if (reject) throw new Error("offline");
  };
  return { calls, send };
}

test("sends a letter attempt with the learner id and codes", () => {
  const { calls, send } = spy();
  reportAttempt("L", false, ["thumb:placement"], send, ID);
  assert.equal(calls[0].url, "/api/attempts");
  assert.equal(calls[0].body.learnerId, ID);
  assert.deepEqual(calls[0].body.attempts[0].item, "L");
  assert.equal(calls[0].body.attempts[0].correct, false);
  assert.deepEqual(calls[0].body.attempts[0].codes, ["thumb:placement"]);
});

test("skips fingerspelled word items", () => {
  const { calls, send } = spy();
  reportAttempt("fs:LILY", true, [], send, ID);
  assert.equal(calls.length, 0);
});

test("never throws when the network fails", async () => {
  const { send } = spy(true);
  assert.doesNotThrow(() => reportAttempt("L", true, [], send, ID));
  await new Promise((r) => setTimeout(r, 0)); // let the swallowed rejection settle
});

test("lesson complete is sent only when notifications are on", () => {
  const off = spy();
  reportLessonComplete("1.2", "Spell RYAN", 20, off.send, ID, false);
  assert.equal(off.calls.length, 0);
  const on = spy();
  reportLessonComplete("1.2", "Spell RYAN", 20, on.send, ID, true);
  assert.equal(on.calls[0].url, "/api/lesson-complete");
  assert.deepEqual(on.calls[0].body, { learnerId: ID, lessonId: "1.2", lessonTitle: "Spell RYAN", xp: 20 });
});
```
`src/lib/planInput.test.ts`
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlanRequest, lessonLetters } from "./planInput.ts";
import type { Unit } from "./curriculum.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const lesson = (id: string, title: string, steps: any[], teaches?: string[]) => ({ id, title, summary: "", scope: "demo", grading: "auto", xp: 10, steps, teaches });
const units = [
  {
    id: "u1", title: "Introduce yourself", goal: "",
    lessons: [
      lesson("1.1", "Your letters", [{ kind: "learn", letter: "A" }, { kind: "practice", letter: "Y", reps: 3 }], ["A", "Y"]),
      lesson("1.2", "Spell RYAN", [{ kind: "spell", word: "RYAN", showReference: true }]),
      lesson("1.3", "Checkpoint", [{ kind: "contrast", letters: ["I", "L"] }]),
    ],
  },
] as Unit[];

test("lessonLetters collects letters from steps, sorted and unique", () => {
  assert.deepEqual(lessonLetters(units[0].lessons[1]), ["A", "N", "R", "Y"]);
  assert.deepEqual(lessonLetters(units[0].lessons[2]), ["I", "L"]);
});

test("a new learner gets only the next lesson and no known letters", () => {
  const req = buildPlanRequest(units, { completed: [], items: {} }, [], ID)!;
  assert.deepEqual(req.candidates, [{ id: "1.1", letters: ["A", "Y"] }]);
  assert.deepEqual(req.knownLetters, []);
});

test("after a lesson: next lesson first, then completed lessons, known letters from attempts and teaches", () => {
  const req = buildPlanRequest(units, { completed: ["1.1"], items: { L: { attempts: 2 }, "fs:LILY": { attempts: 3 }, HELLO: { attempts: 1 } } }, ["L", "Q"], ID)!;
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.2", "1.1"]);
  assert.deepEqual(req.knownLetters, ["A", "L", "Y"]);
  assert.deepEqual(req.weakLetters, ["L"]);
});

test("review lessons follow completion order, not curriculum order", () => {
  const req = buildPlanRequest(units, { completed: ["1.3", "1.1"], items: {} }, [], ID)!;
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.2", "1.1", "1.3"]);
});

test("stretch lessons are never picked as the next lesson", () => {
  const mixed = [{ id: "u", title: "", goal: "", lessons: [lesson("2.1", "", []), { ...lesson("2.2", "", []), scope: "stretch" }, lesson("3.1", "", [])] }] as Unit[];
  const req = buildPlanRequest(mixed, { completed: ["2.1"], items: {} }, [], ID)!;
  assert.equal(req.candidates[0].id, "3.1");
});

test("returns at most 4 review lessons, never titles, and null with no lessons", () => {
  const many = [{ id: "u", title: "", goal: "", lessons: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"].map((id) => lesson(id, `Secret title ${id}`, [])) }] as Unit[];
  const req = buildPlanRequest(many, { completed: ["1.1", "1.2", "1.3", "1.4", "1.5"], items: {} }, [], ID)!;
  assert.equal(req.candidates.length, 5);
  assert.deepEqual(req.candidates.map((c) => c.id), ["1.6", "1.5", "1.4", "1.3", "1.2"]);
  assert.equal(JSON.stringify(req).includes("Secret title"), false);
  assert.equal(buildPlanRequest([], { completed: [], items: {} }, [], ID), null);
});
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test src/lib/track.test.ts src/lib/planInput.test.ts` → FAIL: `Cannot find module` for `track.ts` / `planInput.ts`
- [ ] **Step 3: Implement**

`src/lib/learner.ts`
```ts
const KEY = "handshake.learner.v1";
let memory: string | null = null; // used when localStorage is blocked

/** Anonymous id for stats. Contains no name or email. */
export function learnerId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memory ??= crypto.randomUUID());
  }
}
```
`src/lib/track.ts`
```ts
import { learnerId } from "./learner.ts";

// Fire-and-forget reporting. Local progress (progress.ts) stays the source of truth; nothing here may block or throw.
type Send = (url: string, body: unknown) => Promise<unknown>;

const ITEM_RE = /^[A-Z][A-Z0-9_-]{0,19}$/; // letters and sign ids; "fs:LILY" words can contain names, so they are skipped
const NOTIFY_KEY = "handshake.notify.v1";

const defaultSend: Send = (url, body) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

function fire(send: Send, url: string, body: unknown) {
  try {
    void send(url, body).catch(() => {});
  } catch {
    /* never block signing */
  }
}

export function reportAttempt(item: string, correct: boolean, codes: string[] = [], send: Send = defaultSend, id: string = learnerId()) {
  if (!ITEM_RE.test(item)) return;
  fire(send, "/api/attempts", { learnerId: id, attempts: [{ item, correct, codes, ts: Date.now() }] });
}

export function isNotifyOn(): boolean {
  try {
    return localStorage.getItem(NOTIFY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotifyOn(on: boolean) {
  try {
    if (on) localStorage.setItem(NOTIFY_KEY, "1");
    else localStorage.removeItem(NOTIFY_KEY);
  } catch {
    /* ignore */
  }
}

export function reportLessonComplete(
  lessonId: string, lessonTitle: string, xp: number, send: Send = defaultSend, id: string = learnerId(), on: boolean = isNotifyOn(),
) {
  if (!on) return;
  fire(send, "/api/lesson-complete", { learnerId: id, lessonId, lessonTitle, xp });
}
```
`src/lib/planInput.ts`
```ts
import type { Lesson, Unit } from "./curriculum.ts";

export type PlanRequest = {
  learnerId: string;
  candidates: { id: string; letters: string[] }[];
  knownLetters: string[];
  weakLetters: string[];
};
type ProgressLike = { completed: string[]; items: Record<string, { attempts: number }> };

const MAX_REVIEW = 4;
const isLetter = (s: string) => /^[A-Z]$/.test(s);

/** Letters a lesson touches. Titles are never used: they contain the learner's names. */
export function lessonLetters(l: Lesson): string[] {
  const out = new Set<string>(l.teaches ?? []);
  for (const s of l.steps) {
    if (s.kind === "learn" || s.kind === "practice") out.add(s.letter);
    else if (s.kind === "contrast") s.letters.forEach((c) => out.add(c));
    else if (s.kind === "spell") [...s.word.toUpperCase()].forEach((c) => out.add(c));
  }
  return [...out].filter(isLetter).sort();
}

/**
 * Candidates = next lesson (unlocked by definition) + the most recently completed lessons to review.
 * Same rules as flatLessons/nextLesson in curriculum.ts/progress.ts, inlined because those files import
 * ../cv without a .ts extension and so can't load under `node --test`.
 */
export function buildPlanRequest(units: Unit[], p: ProgressLike, weak: string[], learnerId: string): PlanRequest | null {
  const all = units.flatMap((u) => u.lessons);
  const next = all.find((l) => l.scope === "demo" && !p.completed.includes(l.id)); // same as nextLesson: stretch lessons are never "next"
  const byId = new Map(all.map((l) => [l.id, l]));
  // p.completed is in completion order (progress.ts completeLesson appends), so "recent" = the end of it.
  const review = [...p.completed].reverse().map((id) => byId.get(id)).filter((l): l is Lesson => !!l).slice(0, MAX_REVIEW);
  const picks = next ? [next, ...review] : review;
  if (!picks.length) return null;
  const known = new Set<string>();
  for (const [item, s] of Object.entries(p.items)) if (isLetter(item) && s.attempts > 0) known.add(item);
  for (const l of all) if (p.completed.includes(l.id)) (l.teaches ?? []).forEach((c) => known.add(c));
  return {
    learnerId,
    candidates: picks.map((l) => ({ id: l.id, letters: lessonLetters(l) })),
    knownLetters: [...known].sort(),
    weakLetters: weak.filter((w) => known.has(w)),
  };
}
```
- [ ] **Step 4: Run, confirm PASS** — same command → PASS (9 tests)
- [ ] **Step 5: Extend `src/lib/api.ts`.** Append (the existing `post` stays):
```ts
async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

export type Features = { stats: boolean; notify: boolean; agent: boolean };
export type Stats = {
  daily: { day: string; attempts: number; accuracy: number }[];
  items: { item: string; attempts: number; accuracy: number }[];
};
export type Plan = { lessonId: string; focus: string[]; words: string[]; tip: string; source: "agent" | "local" };

export const getFeatures = () => get<Features>("/api/features");
export const getStats = (learnerId: string) => get<Stats>(`/api/stats/${learnerId}`);
export const planToday = (req: import("./planInput").PlanRequest) => post<Plan>("/api/plan", req);

export type SubscribeBody =
  | { action: "subscribe"; learnerId: string; consent: true; userName?: string; theirName?: string; learnerEmail?: string; contactEmail?: string }
  | { action: "unsubscribe"; learnerId: string };
export const subscribe = (body: SubscribeBody) => post<{ ok: boolean; reason?: string }>("/api/subscribe", body);
```
- [ ] **Step 6: Verify** — `npm run build` → no type errors; `npm test` → PASS.
- [ ] **Step 7: Commit** — `feat: client reporters, plan input and api helpers`

---

## Task 7 — Stats page UI (U8)

**Files:** Create `src/components/AccuracyChart.tsx`, `src/components/PlanCard.tsx`, `src/components/NotifySettings.tsx`, `src/screens/StatsPage.tsx` · Modify `src/App.tsx`, `src/styles.css`

- [ ] **Step 1: `src/components/AccuracyChart.tsx`**
```tsx
import type { Stats } from "../lib/api";

const W = 320;
const H = 120;
const PAD = 16;

export function AccuracyChart({ daily }: { daily: Stats["daily"] }) {
  if (!daily.length) return <p>Practice a lesson to see how often you match the reference.</p>;
  const x = (i: number) => (daily.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (daily.length - 1));
  const y = (a: number) => H - PAD - a * (H - 2 * PAD);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby="acc-title">
        <title id="acc-title">Share of attempts that matched the reference, last 14 days</title>
        <text x="0" y={y(1) + 4} fontSize="10" fill="currentColor">100%</text>
        <text x="0" y={y(0) + 4} fontSize="10" fill="currentColor">0%</text>
        {daily.length > 1 && (
          <polyline points={daily.map((d, i) => `${x(i)},${y(d.accuracy)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
        )}
        {daily.map((d, i) => (
          <circle key={d.day} cx={x(i)} cy={y(d.accuracy)} r="3" fill="currentColor" />
        ))}
      </svg>
      <table className="visually-hidden">
        <caption>Share of attempts that matched the reference, by day</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Attempts</th><th scope="col">Matched</th></tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}><td>{d.day}</td><td>{d.attempts}</td><td>{Math.round(d.accuracy * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
```
- [ ] **Step 2: `src/components/PlanCard.tsx`**
```tsx
import type { Plan } from "../lib/api";

type Props = { plan: Plan | null; hasCandidates: boolean; failed: boolean };

export function PlanCard({ plan, hasCandidates, failed }: Props) {
  if (!hasCandidates) return <section><h2>Today</h2><p>Nothing to plan yet. Start a lesson from Home.</p></section>;
  if (failed) return <section><h2>Today</h2><p>Couldn't plan today's session. Continue with your next lesson from Home.</p></section>;
  if (!plan) return <section><h2>Today</h2><p>Planning your session…</p></section>;
  return (
    <section aria-labelledby="plan-h">
      <h2 id="plan-h">Today</h2>
      <p>
        Lesson {plan.lessonId}
        {plan.focus.length > 0 && <> · focus {plan.focus.join(", ")}</>}
        {plan.words.length > 0 && <> · try {plan.words.join(", ")}</>}
      </p>
      <p>{plan.tip}</p>
      <a href={`#/lesson/${plan.lessonId}`}>Start</a>
      <p><small>planned by: {plan.source}</small></p>
    </section>
  );
}
```
- [ ] **Step 3: `src/components/NotifySettings.tsx`**
```tsx
import { useState } from "react";
import { subscribe } from "../lib/api";
import { learnerId } from "../lib/learner";
import { isNotifyOn, setNotifyOn } from "../lib/track";

type Props = { enabled: boolean; userName: string; theirName: string };

export function NotifySettings({ enabled, userName, theirName }: Props) {
  const [contactEmail, setContactEmail] = useState("");
  const [learnerEmail, setLearnerEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [on, setOn] = useState(isNotifyOn);
  const [status, setStatus] = useState("");

  if (!enabled) return <section><h2>Notifications</h2><p>Notifications aren't set up on this server.</p></section>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await subscribe({
        action: "subscribe", learnerId: learnerId(), consent: true, userName, theirName,
        ...(contactEmail && { contactEmail }), ...(learnerEmail && { learnerEmail }),
      });
      if (!r.ok) throw new Error(r.reason);
      setNotifyOn(true);
      setOn(true);
      setStatus("Saved. You can stop notifications any time.");
    } catch {
      setStatus("Couldn't save. Check the emails and try again.");
    }
  }

  async function stop() {
    try {
      const r = await subscribe({ action: "unsubscribe", learnerId: learnerId() });
      if (!r.ok) throw new Error(r.reason);
      setNotifyOn(false);
      setOn(false);
      setStatus("Notifications stopped.");
    } catch {
      setStatus("Couldn't stop notifications. Try again.");
    }
  }

  return (
    <section aria-labelledby="notify-h">
      <h2 id="notify-h">Notifications</h2>
      <form onSubmit={save}>
        <label>
          Email of the person you're learning for (optional)
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Your email for a weekly recap (optional)
          <input type="email" value={learnerEmail} onChange={(e) => setLearnerEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Send my first name, their first name and these emails to our n8n automation
        </label>
        <button type="submit" disabled={!consent || !(contactEmail || learnerEmail)}>Save</button>
        {on && <button type="button" onClick={stop}>Stop notifications</button>}
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </section>
  );
}
```
- [ ] **Step 4: `src/screens/StatsPage.tsx`**
```tsx
import { useEffect, useMemo, useState } from "react";
import { AccuracyChart } from "../components/AccuracyChart";
import { NotifySettings } from "../components/NotifySettings";
import { PlanCard } from "../components/PlanCard";
import { getFeatures, getStats, planToday, type Features, type Plan, type Stats } from "../lib/api";
import { buildCurriculum } from "../lib/curriculum";
import { learnerId } from "../lib/learner";
import { buildPlanRequest } from "../lib/planInput";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { loadProgress, weakItems } from "../lib/progress";

const NO_FEATURES: Features = { stats: false, notify: false, agent: false };

export function StatsPage() {
  const [profile] = useState(() => loadProfile() ?? DEMO_PROFILE);
  const units = useMemo(() => buildCurriculum(profile), [profile]);
  const progress = useMemo(() => loadProgress(), []);
  const planReq = useMemo(() => buildPlanRequest(units, progress, weakItems(progress, 5), learnerId()), [units, progress]);

  const [features, setFeatures] = useState<Features | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planFailed, setPlanFailed] = useState(false);

  useEffect(() => {
    getFeatures().then(setFeatures).catch(() => setFeatures(NO_FEATURES));
    getStats(learnerId()).then(setStats).catch((e) => {
      console.error(e);
      setStats({ daily: [], items: [] });
    });
    if (planReq)
      planToday(planReq).then(setPlan).catch((e) => {
        console.error(e);
        setPlanFailed(true);
      });
  }, [planReq]);

  return (
    <div className="page">
      <h1>Your stats</h1>
      <PlanCard plan={plan} hasCandidates={!!planReq} failed={planFailed} />
      <section aria-labelledby="acc-h">
        <h2 id="acc-h">Matches the reference</h2>
        {stats ? <AccuracyChart daily={stats.daily} /> : <p>Loading your stats…</p>}
        {stats && stats.items.length > 0 && (
          <>
            <h3>Weakest letters</h3>
            <ul>
              {stats.items.map((i) => (
                <li key={i.item}>{i.item}: matched the reference {Math.round(i.accuracy * 100)}% of {i.attempts} tries</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <NotifySettings enabled={!!features?.notify} userName={profile.userName} theirName={profile.theirName} />
    </div>
  );
}
```
- [ ] **Step 5: Route + nav in `src/App.tsx`.** Add `import { StatsPage } from "./screens/StatsPage";`, add `"#/stats": StatsPage,` to `routes`, and add `<a href="#/stats">Stats</a>` after the Curriculum link in `<nav>`.
- [ ] **Step 6: Append to `src/styles.css`**
```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```
- [ ] **Step 7: Verify** — `npm run build` → success. `npm run dev`, open `http://localhost:5173/#/stats` with no env: heading "Your stats", "Practice a lesson to see your accuracy here.", the planner card shows a lesson and "planned by: local", Notifications says "aren't set up on this server". Keyboard: Tab reaches every control with a visible focus ring.
- [ ] **Step 8: Commit** — `feat: stats page with accuracy chart, plan card and notifications`
- [ ] **Step 9: `/check`** (client unit, `react-reviewer`).

---

## Task 8 — Maritime planner agent (U6)

**Files:** Create `agent/plan.mjs`, `agent/server.mjs`, `agent/package.json`, `agent/Dockerfile` · Test `agent/plan.test.mjs`

- [ ] **Step 1: Write the failing test** `agent/plan.test.mjs`
```js
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
```
- [ ] **Step 2: Run, confirm FAIL** — `node --test agent/plan.test.mjs` → FAIL: `Cannot find module './plan.mjs'`
- [ ] **Step 3: Implement**

`agent/plan.mjs`
```js
import { Type } from "@google/genai";

const MAX_TURNS = 4;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_stats",
        description: "The learner's accuracy per day and their weakest letters over the last 14 days.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_practice_words",
        description: "Practice words that use only letters the learner knows, favouring the focus letters.",
        parameters: { type: Type.OBJECT, properties: { focus: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["focus"] },
      },
    ],
  },
];

// Gemini may wrap its JSON in prose or a markdown fence: parse from the first { to the last }.
const parseFinal = (text) => JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

/**
 * Plans one practice session. The learner id and known letters live in this closure: the model can't
 * supply or change them. The calling server re-checks the reply, so this only has to return JSON.
 */
export async function planSession({ ai, model, appUrl, learnerId, candidates, knownLetters, fetch: f = fetch }) {
  const tools = {
    get_stats: async () => (await f(`${appUrl}/api/stats/${learnerId}`)).json(),
    get_practice_words: async ({ focus = [] }) =>
      (
        await f(`${appUrl}/api/words`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knownLetters, weakLetters: focus.filter((l) => /^[A-Z]$/.test(l)).slice(0, 5) }),
        })
      ).json(),
  };
  const lessons = candidates.map((c) => `${c.id} (letters ${c.letters.join("") || "none"})`).join("; ");
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `You plan one short ASL fingerspelling practice session. Lesson options: ${lessons}. The learner knows the letters: ${knownLetters.join("")}.
Call get_stats to see their accuracy and weakest letters, then get_practice_words for their weak letters.
Pick ONE lesson id from the options (the first option is the next new lesson; the others are reviews).
Reply with only JSON: {"lessonId": string, "focus": string[] (up to 3 weak letters), "words": string[] (from get_practice_words), "tip": string (one encouraging sentence, no emojis)}.`,
        },
      ],
    },
  ];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await ai.models.generateContent({ model, contents, config: { tools: TOOLS } });
    const calls = res.functionCalls ?? [];
    if (!calls.length) return parseFinal(res.text);
    contents.push(res.candidates[0].content);
    const parts = [];
    for (const c of calls) {
      const fn = tools[c.name];
      const result = fn ? await fn(c.args ?? {}).catch((e) => ({ error: String(e.message) })) : { error: "unknown_tool" };
      parts.push({ functionResponse: { name: c.name, response: { result } } });
    }
    contents.push({ role: "user", parts });
  }
  throw new Error("agent_turn_limit");
}
```
`agent/server.mjs`
```js
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { planSession } from "./plan.mjs";

const { AGENT_TOKEN, GEMINI_API_KEY, APP_URL, GEMINI_MODEL = "gemini-2.5-flash", PORT = 8080 } = process.env;
if (!AGENT_TOKEN || !GEMINI_API_KEY || !APP_URL) {
  console.error("AGENT_TOKEN, GEMINI_API_KEY and APP_URL are required");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MAX_BODY = 20_000;

const authorized = (header = "") => {
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${AGENT_TOKEN}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

http
  .createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    if (req.method !== "POST" || req.url !== "/plan") return send(404, { error: "not_found" });
    if (!authorized(req.headers.authorization)) return send(401, { error: "unauthorized" });
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > MAX_BODY) return send(413, { error: "too_large" });
      }
      const { learnerId, candidates, knownLetters } = JSON.parse(raw);
      send(200, await planSession({ ai, model: GEMINI_MODEL, appUrl: APP_URL, learnerId, candidates, knownLetters }));
    } catch (e) {
      console.error("plan failed:", e.message);
      send(502, { error: "agent_failed" });
    }
  })
  .listen(Number(PORT), () => console.log(`planner agent on :${PORT}`));
```
`agent/package.json`
```json
{
  "name": "handshake-planner-agent",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.mjs" },
  "dependencies": { "@google/genai": "^3.0.0" }
}
```
`agent/Dockerfile`
```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY plan.mjs server.mjs ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
```
- [ ] **Step 4: Run, confirm PASS** — `node --test agent/plan.test.mjs` → PASS (4 tests)
- [ ] **Step 5: Local run against the dev server** (needs `GEMINI_API_KEY`; the app must be running with a `DATABASE_URL`, or stats come back empty, which is fine):
```bash
cd agent && npm install && AGENT_TOKEN=dev GEMINI_API_KEY=$GEMINI_API_KEY APP_URL=http://localhost:8787 node server.mjs &
curl -s -H "Authorization: Bearer dev" -H "Content-Type: application/json" localhost:8080/plan \
  -d '{"learnerId":"11111111-1111-4111-8111-111111111111","candidates":[{"id":"1.3","letters":["I","L"]}],"knownLetters":["I","L"]}'
```
Expected: JSON with `lessonId`, `focus`, `words`, `tip`. Without the header: `401`. Stop the agent.
- [ ] **Step 6 (human): deploy to Maritime.** Follow Maritime's current docs (maritime.sh) to deploy `agent/` (Docker/Node entry `server.mjs`), set secrets `AGENT_TOKEN`, `GEMINI_API_KEY`, `APP_URL` (the public app URL from Task 9). Record the exact commands in `docs/devpost-tracks.md` → Maritime. Set `MARITIME_AGENT_URL=https://<agent>/plan` and `MARITIME_AGENT_TOKEN` in the app's `.env`. Verify: the Step 5 `curl` against the Maritime URL returns plan JSON, and `#/stats` shows "planned by: agent".
- [ ] **Step 7: Commit** — `feat: maritime planner agent`

---

## Task 9 — Vultr + GoDaddy Registry deploy (U9)

**Files:** Create `deploy/setup.sh`

- [ ] **Step 1: Write `deploy/setup.sh`**
```bash
#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 Vultr VM. Run as root:
#   bash setup.sh <domain> <git-repo-url>
# scp your .env to /root/handshake.env first (the clone needs an empty /opt/handshake), or the script stops and tells you.
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain> <repo-url>}"
REPO="${2:?usage: setup.sh <domain> <repo-url>}"
APP=/opt/handshake

apt-get update
apt-get install -y curl git ufw gpg debian-keyring debian-archive-keyring apt-transport-https

# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

# Caddy (automatic HTTPS)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

id handshake >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin handshake
[ -d "$APP/.git" ] || git clone "$REPO" "$APP"
[ -f /root/handshake.env ] && cp /root/handshake.env "$APP/.env"
if [ ! -f "$APP/.env" ]; then
  echo "Missing /root/handshake.env. scp your .env there, then run this script again." >&2
  exit 1
fi
chmod 600 "$APP/.env"

cd "$APP"
git pull --ff-only
npm ci
npm run build
chown -R handshake:handshake "$APP"

cat > /etc/systemd/system/handshake.service <<UNIT
[Unit]
Description=Handshake
After=network.target

[Service]
User=handshake
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
Environment=SERVE_STATIC=1
ExecStart=/usr/bin/node server/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8787\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now handshake
systemctl restart caddy

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Done. Check: curl -I https://$DOMAIN"
```
- [ ] **Step 2: Verify the script's syntax locally** — `bash -n deploy/setup.sh` → no output. If `shellcheck` is installed: `shellcheck deploy/setup.sh` → no errors.
- [ ] **Step 3 (human): domain.** Register an MLH-eligible GoDaddy Registry TLD domain (check MLH's current list; the track page names the eligible TLDs). In its DNS settings, add an `A` record → the Vultr VM's IPv4. Check: `dig +short <domain>` shows the VM IP.
- [ ] **Step 4 (human): VM.** Create a Vultr Ubuntu 24.04 VM. `scp .env root@<ip>:/root/handshake.env`, then `scp deploy/setup.sh root@<ip>:` and `ssh root@<ip> bash setup.sh <domain> <repo-url>`. The `.env` needs `SERVE_STATIC` unset (the unit sets it), `PORT=8787`, `GEMINI_API_KEY`, and the other integration vars.
- [ ] **Step 5: Verify live** — `curl -sI https://<domain>` → `HTTP/2 200`; `curl -s https://<domain>/api/features` → JSON; open `https://<domain>/#/` on a phone and confirm the camera permission prompt appears (needs HTTPS); from outside, `curl -m 5 http://<vm-ip>:8787/` fails (loopback only, firewall closed).
- [ ] **Step 6: Commit** — `feat: vultr deploy script`
- [ ] **Step 7: `security-reviewer`** on `deploy/setup.sh` and the `index.mjs` loopback/trust-proxy change.

---

## Task 10 — Databricks training job (U10)

**Files:** Modify `training/train.py` · Create `training/test_train_smoke.py`, `training/databricks/train_job.py`

- [ ] **Step 1: Write the failing smoke test** `training/test_train_smoke.py`
```python
"""Smoke test: train.main(argv) trains on tiny synthetic recordings and returns its results.
Run: python3 training/test_train_smoke.py   (needs numpy and scikit-learn)"""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import train  # noqa: E402
from features import FEATURE_LENGTH, FEATURE_VERSION  # noqa: E402


def write_person(folder, name, seed):
    rng = np.random.default_rng(seed)
    rows = []
    for letter, centre in (("A", 0.0), ("B", 3.0)):
        for _ in range(20):
            rows.append({"letter": letter, "v": FEATURE_VERSION, "features": (rng.normal(centre, 0.3, FEATURE_LENGTH)).tolist()})
    (folder / name).write_text(json.dumps(rows))


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    rec = tmp / "recorded"
    rec.mkdir()
    write_person(rec, "one.json", 1)
    write_person(rec, "two.json", 2)
    out = tmp / "model.json"
    report = tmp / "report.txt"
    res = train.main(["--kaggle", str(tmp / "none.npz"), "--recorded", str(rec), "--out", str(out), "--report", str(report), "--hidden", "16"])
    assert set(res) == {"accuracy", "out", "report"}, res
    assert 0.9 <= res["accuracy"] <= 1.0, res
    assert Path(res["out"]).exists() and Path(res["report"]).exists()
    assert json.loads(out.read_text())["labels"] == ["A", "B"]
print("train smoke ok")
```
- [ ] **Step 2: Run, confirm FAIL** — `python3 -m venv .venv && source .venv/bin/activate && pip install numpy scikit-learn && python3 training/test_train_smoke.py` → FAIL: `TypeError`/`SystemExit` (today's `main()` takes no `argv` and always parses `sys.argv`)
- [ ] **Step 3: Refactor `training/train.py`** (four edits)
  1. `def main():` → `def main(argv=None):`
  2. After the `--out` argument line add: `    ap.add_argument("--report", default=str(HERE / "report.txt"))`
  3. `args = ap.parse_args()` → `args = ap.parse_args(argv)`
  4. Replace `(HERE / "report.txt").write_text(text)` with `report_path = Path(args.report)\n    report_path.write_text(text)`, and at the very end of `main` (after the final `print(...Exported...)`) add:
```python
    return {"accuracy": acc, "out": str(out), "report": str(report_path)}
```
- [ ] **Step 4: Run, confirm PASS** — same command → `train smoke ok`. Also `python3 training/test_parity.py` still passes if it passed before (features untouched).
- [ ] **Step 5: Create `training/databricks/train_job.py`** (a Databricks notebook in source format)
```python
# Databricks notebook source
# Trains the Handshake hand-shape recognizer with MLflow tracking.
# Setup: clone the repo into a Databricks Git folder; upload kaggle_features.npz and recorded/*.json to a Unity Catalog volume.

# COMMAND ----------
dbutils.widgets.text("training_dir", "", "Path to the repo's training/ folder (Git folder)")
dbutils.widgets.text("data_dir", "/Volumes/main/default/handshake", "Volume with kaggle_features.npz and recorded/")

# COMMAND ----------
# MAGIC %pip install scikit-learn mlflow

# COMMAND ----------
import os
import shutil
import sys

import mlflow

training_dir = dbutils.widgets.get("training_dir")
data_dir = dbutils.widgets.get("data_dir")
assert training_dir and data_dir, "Fill in both widgets"
sys.path.insert(0, training_dir)
import train  # noqa: E402  (the repo's train.py)

work = "/tmp/handshake"
os.makedirs(work, exist_ok=True)

# COMMAND ----------
# One MLflow run per network size. The best held-out accuracy wins.
best = None
for hidden in ["64", "128,64", "256,128"]:
    tag = hidden.replace(",", "-")
    with mlflow.start_run(run_name=f"mlp-{tag}"):
        result = train.main([
            "--kaggle", f"{data_dir}/kaggle_features.npz",
            "--recorded", f"{data_dir}/recorded",
            "--hidden", hidden,
            "--out", f"{work}/model-{tag}.json",
            "--report", f"{work}/report-{tag}.txt",
        ])
        mlflow.log_param("hidden", hidden)
        mlflow.log_metric("holdout_accuracy", result["accuracy"])
        mlflow.log_artifact(result["report"])
        mlflow.log_artifact(result["out"])
        if best is None or result["accuracy"] > best["accuracy"]:
            best = result

# COMMAND ----------
shutil.copy(best["out"], f"{data_dir}/model.json")
shutil.copy(best["report"], f"{data_dir}/report.txt")
print(f"Best holdout accuracy {best['accuracy']:.3f}. Download with: databricks fs cp dbfs:{data_dir}/model.json public/model/model.json")
```
- [ ] **Step 6 (human): run it.** Databricks Free Edition: create a Git folder from the GitHub repo, make a volume, upload the data (`training/data/kaggle_features.npz`, `training/data/recorded/*.json`), open the notebook, fill the widgets, Run all. Check: three runs appear under Experiments with `holdout_accuracy`; `model.json` and `report.txt` exist in the volume. Download `model.json` to `public/model/model.json`, run `npm run dev`, confirm the lesson debug panel says "trained model". Screenshot the MLflow runs for Devpost.
- [ ] **Step 7: Commit** — `feat: databricks training job with mlflow`

---

## Task 11 — n8n workflows (human, U3 second half)

**Files:** Create `n8n/README.md`; export the three workflows as `n8n/*.json`.

- [ ] **Step 1: Create an n8n Cloud workspace** (free trial or the prize plan). Create a **Header Auth** credential `handshake-secret` (name `X-Handshake-Secret`, value = `N8N_SECRET`). Create a **Data Table** `handshake_learners` with columns `learnerId` (string, unique key), `userName`, `theirName`, `learnerEmail`, `contactEmail`, `lastSentAt` (date).
- [ ] **Step 2: Workflow "Handshake subscribe"**: Webhook (POST, path `handshake-subscribe`, Header Auth credential, **Respond: "Using 'Respond to Webhook' Node"**) → Switch on `{{$json.body.action}}` → `subscribe`: Data Table **Upsert** by `learnerId` (map the other fields from `body`) | `unsubscribe`: Data Table **Delete** where `learnerId` equals `body.learnerId` → Respond to Webhook `{"ok": true}`. Activate it; copy the **production** URL into `N8N_SUBSCRIBE_URL`.
- [ ] **Step 3: Workflow "Handshake lesson complete"**: Webhook (POST, path `handshake-event`, same credential, **Respond: "Using 'Respond to Webhook' Node"**, node name `Webhook`) → Data Table **Get** (node name `Get learner`) where `learnerId` = `{{ $json.body.learnerId }}` → IF row exists AND `contactEmail` is set AND (`lastSentAt` is empty OR older than 10 minutes) → Send Email (Gmail/SMTP) to `{{ $('Get learner').item.json.contactEmail }}`, subject `{{ $('Get learner').item.json.userName }} is learning to sign with you`, body `{{ $('Get learner').item.json.userName }} just finished "{{ $('Webhook').item.json.body.lessonTitle }}" on Handshake. Say hi!` → Data Table **Update** `lastSentAt` = `{{ $now }}` → Respond to Webhook `{"ok": true}` (also connected from the IF's false branch). Later nodes read earlier data with `$('<node name>')`, because each node replaces the item. The 10-minute throttle is best-effort (the read-check-update isn't atomic if two requests land at once); the server's 10/min/IP limit is the other guard. Activate; copy the production URL into `N8N_EVENT_URL`.
- [ ] **Step 4: Workflow "Handshake weekly recap"**: Schedule Trigger (weekly) → Data Table **Get many** (node name `Get learners`) where `learnerEmail` is not empty → HTTP Request GET `https://<domain>/api/stats/{{ $json.learnerId }}` (runs once per item) → Code node "Run Once for Each Item" (below) → Send Email to `{{ $json.to }}`, subject `{{ $json.subject }}`, body `{{ $json.text }}`.
```js
// Weighted by attempts, so a day with 20 tries counts more than a day with 2.
const stats = $input.item.json; // { daily, items } from the HTTP Request node
const learner = $('Get learners').item.json;
const total = stats.daily.reduce((n, d) => n + d.attempts, 0);
const right = stats.daily.reduce((n, d) => n + d.attempts * d.accuracy, 0);
const pct = total ? Math.round((100 * right) / total) : 0;
const weak = stats.items.map((i) => i.item).join(", ") || "none yet";
return {
  json: {
    to: learner.learnerEmail,
    subject: "Your Handshake week",
    text: "You practised on " + stats.daily.length + " day(s) with " + total + " attempts and " + pct + "% matched the reference. Letters to practise: " + weak + ".",
  },
};
```
- [ ] **Step 5: Verify with curl** (production webhook URLs, `S` = the secret):
```bash
ID=11111111-1111-4111-8111-111111111111
curl -s -H "X-Handshake-Secret: $S" -H "Content-Type: application/json" "$N8N_SUBSCRIBE_URL" \
  -d "{\"action\":\"subscribe\",\"learnerId\":\"$ID\",\"userName\":\"Ryan\",\"theirName\":\"Lily\",\"contactEmail\":\"<your test email>\"}"
```
Expected `{"ok":true}` and the row in the Data Table. Without the header → `403`. Then the event webhook with `{"learnerId":"$ID","lessonId":"1.2","lessonTitle":"Spell RYAN","xp":20}` → the email arrives; sending it again within 10 minutes → no second email. Then the unsubscribe call → the row is gone. Finally the real path: set the three env vars, restart the server, complete a lesson in the app with notifications on → email arrives.
- [ ] **Step 6:** Export the three workflows (n8n → ⋯ → Download) into `n8n/`. Remove any credentials from the JSON (n8n exports only credential names) and check: `grep -il "s3cret\|password\|apikey" n8n/*.json` → no matches. Write `n8n/README.md` (what each workflow does, the Data Table columns, "import, then attach your own credentials").
- [ ] **Step 7: Commit** — `feat: n8n workflow exports`

---

## Task 12 — Entire (human, U11)

**Files:** Modify `docs/notes.md` (create if missing)

- [ ] **Step 1:** Follow the quickstart at docs.entire.io to install the Entire CLI and run `entire enable` in this repo (it hooks into Git and records Claude Code sessions on the `entire/checkpoints/v1` branch).
- [ ] **Step 2:** Create the repo on Entire and push `main` plus the checkpoints branch as the docs describe.
- [ ] **Step 3:** Use the three capabilities and capture one screenshot of each for Devpost: **Sessions** (the sessions list for this repo), **Graph** (the code map, if it's available for this repo), **Brain** (`entire brain` answering a question about the repo, e.g. "where do attempts get stored?").
- [ ] **Step 4:** In `docs/notes.md` add an "Entire" section: the exact commands you ran, the repo URL, and what Brain answered. Don't paste tokens.
- [ ] **Step 5: Verify** — the Entire repo URL opens, shows the commits, and lists at least one session.
- [ ] **Step 6: Commit** — `docs: entire setup notes`

---

## Task 13 — Call-site wiring and Devpost evidence (last)

**Files:** Modify `src/screens/LessonPlayer.tsx` (exists only after plan 2), `README.md` · Create `docs/devpost-tracks.md`

- [ ] **Step 1: Wire the reporters.** If `src/screens/LessonPlayer.tsx` exists, add `import { reportAttempt, reportLessonComplete } from "../lib/track";` and, directly after each existing call:
  - after `progress.current = recordAttempt(progress.current, d.letter, true);` → `reportAttempt(d.letter, true);`
  - after `progress.current = recordAttempt(progress.current, target, false);` → `reportAttempt(target, false, feedback.map((f) => f.code));`
  - after `progress.current = completeLesson(progress.current, lesson!.id, lesson!.xp);` → `reportLessonComplete(lesson!.id, lesson!.title, lesson!.xp);`
  
  If `LessonPlayer.tsx` doesn't exist yet, leave this step unchecked and write "Stats need LessonPlayer (plan 2)" at the top of `docs/devpost-tracks.md`; the Tiger Data, Maritime and n8n tracks can't be demoed with live data until it's done.
- [ ] **Step 2: Verify** — `grep -n "reportAttempt\|reportLessonComplete" src/screens/*.tsx` shows the three call sites; play lesson 1.1 on the deployed app, then `#/stats` shows a chart point and `node server/db.smoke.mjs`-style query (or the Tiger Cloud console) shows rows for your learner id.
- [ ] **Step 3: Create `docs/devpost-tracks.md`**: one section per track in the spec's Track Coverage table (shipped units only), each with the evidence it lists and where the artifact lives: Tiger Data (schema + chart screenshot), Vultr and GoDaddy (the URL), Databricks (MLflow screenshot, `report.txt`), Maritime (agent URL, demo clip), n8n (workflow screenshots, the email), Entire (repo URL, three screenshots), plus the Most Accessible Design notes (keyboard-only flow, contrast, `aria-live` status, chart text table, no audio). End with the Devpost privacy note: anonymous UUID, no names in Tiger Data or Gemini, names and emails only to n8n with consent, and the "UUID holder could trigger emails" risk.
- [ ] **Step 4: README.** Under "Run", add a short "Optional integrations" list pointing to `.env.example`, `deploy/setup.sh`, `agent/`, `n8n/`, `training/databricks/`.
- [ ] **Step 5: Commit** — `docs: devpost track evidence and integration notes`

---

## Verification
Run in order; each must pass.
1. `npm test` → all pass (limit, validate, attempts, notify, plan, integrations, track, planInput, agent).
2. `python3 training/test_train_smoke.py` → `train smoke ok`.
3. `npm run build` → success.
4. **Env unset:** `unset DATABASE_URL N8N_SECRET MARITIME_AGENT_URL; npm run dev` → the app behaves as before; `#/stats` shows the empty/local states; `/api/features` is all false.
5. **Env set:** with real values, `node server/db.smoke.mjs` → `db smoke ok`; `#/stats` shows the chart, "planned by: agent", and the notification form enabled; completing a lesson sends the email.
6. **Production:** `curl -sI https://<domain>` → 200; the camera prompt appears on a phone; `http://<ip>:8787` is unreachable from outside.
7. **Spec coverage:** U0→T1, U1→T2, U2→T2, U3→T3+T11, U4→T4, U5→T5, U6→T8, U7→T6, U8→T7, U9→T9, U10→T10, U11→T12; Track Coverage evidence → T13.
