x`# Sponsor Tracks Spec
2026-11-07 · Handshake · Status: draft

## Problem & Goal

Handshake already fits the Gemini, design, impact and beginner tracks. This spec adds six sponsor/MLH tracks,
each through a real user-facing use, not a logo:

| Track | What it does in Handshake |
|---|---|
| Vultr + GoDaddy Registry | The app runs on a Vultr VM at a GoDaddy Registry domain over HTTPS (the webcam needs HTTPS off localhost). |
| Tiger Data | Every practice attempt goes into a TimescaleDB hypertable. `time_bucket` gives the daily accuracy chart and weakest letters. |
| Databricks | The recognizer is trained as a Databricks job with MLflow tracking (three MLP sizes compared, per-letter recall) and exports `model.json`. |
| Maritime | A "practice planner" agent on Maritime (Gemini function calling) reads your Tiger Data stats and plans today's session. |
| n8n | (a) Lesson-complete webhook → message to the person you're learning for. (b) Weekly recap email to the learner. |
| Entire | The repo and Claude Code sessions are pushed to Entire (Sessions, Graph, Brain). Setup and write-up only, no app code. |

Every integration stays **off** until its env vars are set. Without them, the app behaves exactly as today, like
Gemini's mock mode.

## Track Coverage

Every track in the HackCamp list, with its status. "Opt in" means ticking it in Devpost and adding the evidence listed.

| Track                                | Status                         | Evidence for Devpost                                                                                             |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| nwChoice                             | Automatic                      | none                                                                                                             |
|                                      |                                |                                                                                                                  |
| Best Problem-Solution Fit (beginner) | Already targeted               | problem statement + solution description                                                                         |
| Best Design                          | Already targeted               | Figma link                                                                                                       |
| Community Impact                     | Already targeted               | impact statement (Deaf and hard-of-hearing communities); the n8n "notify the person" flow is the concrete impact |
| Best Use of Gemini API               | Already targeted, strengthened | Gemini coach/words plus the Maritime planner agent (Gemini function calling)                                |
| Best Use of Tiger Data               | **New: U1, U2, U8**            | schema.sql + the accuracy chart                                                                                  |
| Best Use of Vultr                    | **New: U9**                    | live URL on the Vultr VM                                                                                         |
| Best Domain from GoDaddy Registry    | **New: U9**                    | the eligible domain, same URL                                                                                    |
| Best Use of Databricks               | **New: U10**                   | MLflow run screenshot + `report.txt`                                                                             |
| Best Agent on Maritime               | **New: U6**                    | agent deployed on Maritime + a short demo clip of the planner card                                               |
| Best use of n8n                      | **New: U3**                    | workflow screenshots (notify + weekly recap)                                                                     |
| Best Use of Entire                   | **New: U11**                   | Entire repo link; Sessions/Graph/Brain screenshots                                                               |
| Best Project Built with Freebuff     | Out: no code                   | Opt in only if a teammate genuinely builds a piece with it, and write what it did                                |
| Best Use of Lovable                  | Out                            | the frontend is hand-built, and claiming Lovable would be false                                                  |
| Best Use of Auth0                    | Out                            | dropped in `CLAUDE.md`; identity is an anonymous UUID to keep PII out of the database                            |
| Best Use of Solana                   | Out                            | no fit with the product                                                                                          |
| Best Use of DeepSpace                | Out                            | not researched; no known fit                                                                                     |
| Best Hardware                        | Out                            | the webcam is not a hardware component                                                                           |

Out-of-scope rows can be pulled in later as their own spec. Don't claim a track in Devpost unless its unit shipped.

## Non-goals

- Auth or accounts. The identity is an anonymous UUID.
- Moving `/api/coach` into the agent (it's on the latency-critical demo path).
- Continuous aggregates, retention policies and dashboards beyond one chart.
- Storing emails or names in our own database.
- Changing the CLAUDE.md interfaces of `src/cv` or the existing two Gemini endpoints (`/api/coach`, `/api/words`).

## Users & Flows

1. **Practice (Tiger Data).** The learner signs a letter → `recordAttempt` updates local progress as today, then `reportAttempt`

   and fire-and-forgets `POST /api/attempts`. If there's no DB, the network fails or the request is rate-limited:
    nothing visible happens and local progress is unaffected.
2. **Stats (**`#/stats`**).** It shows a 14-day accuracy line, the 5 weakest letters, the planner card and notification settings.
   - Empty (no DB or no attempts): "Practice a lesson to see your accuracy here."
   - Loading: skeleton text "Loading your stats…".
   - Error: same as empty, logged to the console.
3. **Planner (Maritime).** On `#/stats` load the client builds `candidates`: the next lesson (same rule as `nextLesson`: the first **demo-scope** lesson not completed, so stretch lessons are never planned as "next") plus the 4 most recently completed lessons (review options, any `scope`),

   next lesson first. Each is sent as `{ id, letters }` (`teaches`, or the letters of the lesson's words,
    uppercase A–Z only; titles are never sent because they contain names). It also sends `knownLetters` (single letters the learner has attempted, or that completed lessons teach) and
    `weakLetters` (`weakItems` limited to single letters in `knownLetters`) → `POST /api/plan` → the server calls the Maritime agent (8 s timeout) →
    the agent calls `get_stats` and `get_practice_words({ focus })` → it returns `{ lessonId, focus, words, tip }`.
    The card shows "Today: lesson 2.2 · focus D, I · try LID, DIAL" plus a Start link to `#/lesson/<id>`.
   - No candidates (the curriculum has no lessons): the card shows "Nothing to plan yet. Start a lesson from Home."
   No request is made.
   - Agent unset, timeout or a reply that fails the guard → server-side local plan: `candidates[0]`, focus = `weakLetters` ∩ `knownLetters`
   (≤3), no words, a fixed tip, `source: "local"`. The card looks the same, and a small "planned by: agent | local" label is shown for honesty.
4. **Notify (n8n).** On `#/stats` → "Notifications" form: optional email for the person you're learning for, optional

   own email for the weekly recap, and a **required** consent checkbox ("Send my first name, their first name and these emails to
    our n8n automation"). Submit → `POST /api/subscribe { action: "subscribe", … }` → n8n **upserts** the row by `learnerId`
    (resubmitting replaces it, never duplicates) → on success the client stores `notify.v1 = true` locally.
   - "Stop notifications" button → `POST /api/subscribe { action: "unsubscribe", learnerId }` → n8n deletes the row → the client
   clears `notify.v1`.
   - Lesson completed → `reportLessonComplete` → **only if** `notify.v1` **is true** → `POST /api/lesson-complete { learnerId, lessonId, lessonTitle, xp }` →
   n8n looks up the learner. No row → drop. Throttle: at most 1 email per learner per 10 min → email: "Ryan just finished 'Spell LILY' on Handshake."
   - Weekly cron in n8n → for each row with a learner email → `GET /api/stats/<learnerId>` → recap email.
   - n8n unset → the form shows "Notifications aren't set up on this server" and is disabled (from `GET /api/features`).
5. **Deploy.** `https://<domain>` serves the built SPA and `/api/`* from one Express process behind Caddy (auto TLS).
6. **Training (Databricks).** A teammate uploads `kaggle_features.npz` and `recorded/*.json` to a UC Volume and runs the

   job. MLflow logs the params, test accuracy, per-letter recall and `report.txt`, and `model.json` is written to the volume →
    `databricks fs cp` → `public/model/model.json`.

## Design

**Chosen:** each integration is a separate server module that exports `register(app, deps)`. `server/index.mjs`
creates the app (group-3's `createApp`), then calls each `register`. A module gets its client (pg pool, fetch target)
from env in `index.mjs` and receives `null` when unconfigured. Tests build a bare Express app, register one
module with fakes, and hit it with `fetch` (the same pattern as `server/app.test.mjs`). The agent is a separate
Node package in `agent/` because Maritime deploys it on its own.

Rejected: adding every option to `createApp(...)` (it collides with group-3's file and grows one god-function);
calling n8n or the agent straight from the browser (it leaks secrets and has CORS problems); a chart library (one SVG polyline is enough).

## Units

| Unit | Purpose | Interface | Depends on |
|---|---|---|---|
| U0 `server/limit.mjs`, `server/validate.mjs` (shared regexes) | Fixed-window per-IP rate limit, no dependency | `rateLimit({ windowMs, max }) → express middleware` (429 `{error:"rate_limited"}`) | — |
| U1 `server/db.mjs` + `server/schema.sql` + `server/migrate.mjs` | Tiger Data access | `createDb(url) → { insertAttempts(learnerId, rows), stats(learnerId), close() }` | `pg` |
| U2 `server/routes/attempts.mjs` | Attempt ingest + stats | `register(app, { db })` | U0, U1 |
| U3 `server/routes/notify.mjs` | n8n forwarding | `register(app, { n8n: { subscribeUrl, eventUrl, secret } \| null, fetch })` | U0 |
| U4 `server/routes/plan.mjs` | Agent proxy + local fallback | `register(app, { agent: { url, token } \| null, fetch })` | U0 |
| U5 `GET /api/features` (inline in `server/index.mjs`) | What's enabled | `→ { stats, notify, agent }` (booleans) | — |
| U6 `agent/` | Maritime planner agent | `POST /plan` (Bearer token), body `{ learnerId, candidates, knownLetters }` (already validated by our server) → `{ lessonId, focus, words, tip }`. Tools: `get_stats()` → `GET {APP_URL}/api/stats/<learnerId>`; `get_practice_words({ focus: string[] })` → `POST {APP_URL}/api/words { knownLetters, weakLetters: focus }`. `learnerId`/`knownLetters` stay in the closure; the model never supplies them. Max 4 model turns. | `@google/genai` (own `agent/package.json`), deployed app URL |
| U7 `src/lib/learner.ts`, `src/lib/track.ts` (`reportAttempt`, `reportLessonComplete`), `src/lib/planInput.ts` (`buildPlanRequest`), `src/lib/api.ts` additions | Client side | see Data & API | progress.ts |
| U8 `src/screens/StatsPage.tsx`, `src/components/AccuracyChart.tsx`, `src/components/NotifySettings.tsx`, `src/components/PlanCard.tsx` | UI | route `#/stats` | U7 |
| U9 `deploy/` | Vultr + Caddy + systemd | `deploy/setup.sh <domain> <repo-url>` | — |
| U10 `training/databricks/train_job.py` | Databricks + MLflow training: a sweep over 3 `--hidden` configs, one MLflow run each (params, holdout accuracy, `report.txt`), the best exported as `model.json` | Databricks notebook source; paths via widgets | `train.py` refactored to `main(argv=None) → {"accuracy": float, "out": str, "report": str}` |
| U11 Entire | Sessions/Graph/Brain | `entire enable`, push, `docs/notes.md` | — |

## UI & UX

- `#/stats`, reachable from the nav as "Stats". Order: PlanCard → AccuracyChart → weakest letters list → NotifySettings.
- AccuracyChart: inline SVG, 320×120 viewBox, scales to its container width, a `<title>` and a visually-hidden `<table>` of
the same data for screen readers, axis labels 0% and 100%, one dot per day with ≥1 attempt.
- NotifySettings: real `<label>`s, `type="email"`, consent checkbox required (the submit button stays disabled until it's checked),
and success/error status in an `aria-live="polite"` region.
- Unstyled is fine. Teammate A styles it with the rest.

## Data & API

```sql
-- server/schema.sql (run once: node server/migrate.mjs)
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

| Endpoint | Body / params | Reply | Off-state |
|---|---|---|---|
| `POST /api/attempts` | `{ learnerId: uuid, attempts: { item, correct, codes?, ts? }[] }` (1–50) | `204` | `204` (no-op) |
| `GET /api/stats/:learnerId` | uuid | `{ daily: {day, attempts, accuracy}[], items: {item, attempts, accuracy}[] }` (14 days; 5 weakest items with ≥3 attempts) | `{ daily: [], items: [] }` |
| `POST /api/plan` | `{ learnerId, candidates: { id, letters }[] (1–20), knownLetters: string[], weakLetters?: string[] }` | `{ lessonId, focus: string[], words: string[], tip, source: "agent" \| "local" }` | `source: "local"` |
| `POST /api/subscribe` | `{ action: "subscribe", learnerId, consent: true, userName?, theirName?, learnerEmail?, contactEmail? }` (at least one email) or `{ action: "unsubscribe", learnerId }` | `{ ok: boolean, reason? }` | `{ ok: false, reason: "disabled" }` |
| `POST /api/lesson-complete` | `{ learnerId, lessonId, lessonTitle, xp }` | `{ ok: boolean }` (always 200) | `{ ok: false, reason: "disabled" }` |
| `GET /api/features` | — | `{ stats, notify, agent }` | all false |

Validation (server, every field): `learnerId` must match a UUID regex. `item` must match `/^[A-Z][A-Z0-9_-]{0,19}$/`: letters and sign ids
like `THANK-YOU`, so `fs:*` word items (which can be names) are **rejected**. The client (`reportAttempt`) never sends `fs:`* items, so a
batch never mixes them in. `codes`: ≤5 strings matching `/^[a-z]+:[a-z]+$/`. `ts` is
accepted only within the last 24 h, otherwise `now()`. Emails: ≤254 chars with a basic `x@y.z` check. Names: ≤40 chars matching `/^[\p{L} '-]+$/u`.
`lessonId`: `/^\d+\.\d+$/`. `lessonTitle` ≤80 chars. `xp` an integer 0–1000. `candidates[].letters` ⊆ A–Z. Bad input → `400 {error:"bad_request"}`.

Env (`.env.example`): `DATABASE_URL`, `N8N_SUBSCRIBE_URL`, `N8N_EVENT_URL`, `N8N_SECRET`, `MARITIME_AGENT_URL`,
`MARITIME_AGENT_TOKEN`, `SERVE_STATIC`. Agent env: `GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_URL`, `AGENT_TOKEN`.

## Security

There's no auth in this app, so the chain is: **rate-limit (first, so junk requests can't flood us) → validate → forward/write, with no ownership**.

- Anyone who knows a learner UUID can read that learner's stats. They're letter accuracies only, with no names or emails, and the UUID
isn't guessable. This is accepted and stated on Devpost.
- Rate limits: `/api/attempts` 120/min/IP; `/api/subscribe` and `/api/lesson-complete` 10/min/IP; `/api/plan` 20/min/IP; `/api/stats` 60/min/IP.
- Names and emails go only to n8n, only after explicit consent, and never to Gemini or Tiger Data (this keeps group-3's "Gemini never
sees names" rule). The agent receives the learner UUID, lesson ids and letters only.
- Secrets: `N8N_SECRET` is sent as the `X-Handshake-Secret` header, and both n8n webhooks check it. `AGENT_TOKEN` is a Bearer token
on the agent. `DATABASE_URL` uses `sslmode=require`. Everything lives in `.env` / the Maritime secrets. None of it is in the frontend.
- The agent's reply is guarded: `lessonId` must be one of `candidates`, `focus`/`words` must use only `knownLetters`, and
`tip` is capped at 200 chars. Otherwise → local fallback.
- SQL is always parameterized (`pg` `$1` placeholders).
- In production (`SERVE_STATIC=1`) Express listens on `127.0.0.1` only and sets `trust proxy` to 1, so the rate limit sees real IPs and
forwarded headers can't be spoofed by direct requests. The Vultr firewall (ufw) allows only ports 22, 80 and 443.
- Known risk (no auth, accepted for a hackathon, stated on Devpost): anyone holding a learner UUID could change that learner's
subscription or trigger completion emails. Mitigations: UUIDs never leave the learner's browser except to our server; email content is
a fixed template (only validated names and the lesson title are inserted); each learner stores one row in n8n (upsert); n8n sends at most
1 completion email per learner per 10 min (best-effort: not atomic if two requests land at once) and 1 recap per week; and the IP rate limit applies.

## Testing

- Unit/integration (`node --test`, `npm test`): `server/limit.test.mjs`, `server/routes/attempts.test.mjs` (fake db),
`server/routes/notify.test.mjs` (fake fetch), `server/routes/plan.test.mjs` (fake fetch, guard, timeout),
`agent/plan.test.mjs` (fake Gemini, tool loop, closure-held ids), `src/lib/track.test.ts` (fake send), `src/lib/planInput.test.ts`,
`server/validate.test.mjs`, `server/integrations.test.mjs` (env unset and set).
- Real DB: `node server/db.smoke.mjs` against Tiger Cloud inserts 3 rows and prints stats.
- Manual: deploy checklist (HTTPS camera works on a phone), n8n test webhook, Databricks run visible in MLflow,
`entire` session listed.
- Done = `npm run build && npm test` pass with all env unset **and** with env set.

## Decisions

- Tracks to add → Vultr+GoDaddy, Tiger Data, Databricks, Maritime, n8n, Entire → the user's choice.
- "Add all the tracks into the spec" → the Track Coverage table lists all 19 tracks, but only the six chosen are built. The rest are marked
out, with reasons. This is an interpretation; widening it means a new spec.
- Ownership → ignored for this work → user's choice (solo session).
- n8n → both the notify-person and weekly-recap workflows → user's choice.
- Maritime → practice-planner agent, not the coach → keeps the coach off the network-critical path.
- Identity → anonymous UUID → no PII in Tiger Data.
- Names/emails to n8n only with consent → this resolves the conflict with "never send names" (that rule applies to Gemini).

## Assumptions

- **Hard prerequisite:** the starter plan and group-3 Task 2 are merged first (`server/app.mjs` `createApp`, `npm test` = `node --test`,
and `/api/path` is removed, per the Handshake spec §4). Today's `server/index.mjs` `/api/path` still sends names to Gemini, so deploying before that merge
would break the privacy claim.
- `npm test` globs are extended to include `agent/**/*.test.mjs`.
- `LessonPlayer` (plan 2) calls `reportAttempt` / `reportLessonComplete` right after each `recordAttempt` / `completeLesson`. Until it exists
  there is no call site, so the plan wires `src/screens/LessonDemo.tsx` only if it records attempts; otherwise the wiring is a checklist item in the plan.
- Maritime runs a custom agent from a Dockerfile/Node entry. The exact CLI is confirmed from its docs at execution.
- Databricks Free Edition with serverless compute and UC Volumes. The Kaggle features are extracted locally first.
- Tiger Cloud free service. The TimescaleDB version supports `by_range` (2.13+).

## Open Questions

(none)
