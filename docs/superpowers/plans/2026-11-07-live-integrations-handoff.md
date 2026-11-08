# Live Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the assigned task. Each agent owns only its assigned files. The lead integrates and verifies changes. Do not launch write-heavy subagents.

**Goal:** Ship verified consent-gated n8n email workflows, the Maritime planner, and a Vercel-hosted frontend with an HTTPS Vultr API deployment and phone-camera evidence.

**Architecture:** n8n owns subscriptions and email delivery; Express forwards authenticated events. Maritime hosts the existing planner; Vultr hosts the API behind Caddy (the database is Tiger Data Cloud); Vercel hosts the static frontend and rewrites `/api/*` to the Vultr API (`frontend/vercel.json`). n8n runs on n8n Cloud with a Gmail SMTP credential (dedicated Gmail account + app password) configured inside n8n Cloud, never in this repo. No GoDaddy, domain purchase or Figma. Deploy the app before enabling integrations, then add their URLs and tokens in one coordinated configuration pass.

**Tech Stack:** Existing React/Express app, Vercel, n8n Cloud, Gmail SMTP, Node 24+, Maritime, Ubuntu 24.04, systemd, Caddy.

**Spec:** `n8n/README.md`, `agent/README.md`, `backend/deploy/README.md`; read these and repository `CLAUDE.md` before starting.

## Global Constraints

- You are not alone in the codebase. Do not revert others' edits. Use separate worktrees for implementation; report the exact commit/file handoff to the lead. Do not push or merge unless asked.
- No credentials, confirmation tokens, email addresses or environment files in commits, screenshots, tool output, or task reports. Supply secrets through the hosting secret manager or a secure local file.
- Keep Gemini/Maritime free of names, emails and camera frames. Never change recognition thresholds or enable unvalidated letters.
- Consult current official provider/n8n documentation before using platform-specific APIs. Record the tested n8n version; do not invent deployment commands or eligibility rules.
- Each implementation task: write a failing behavioral test, implement, run its tests, obtain security/code review, and report Tested / Not tested. The lead runs `npm test` and `npm run build` on the integrated tree.
- Only Task 7 edits production app environment settings or restarts the app after its initial deployment. Task 5 creates the initial environment file. No competing production configuration edits.
- Missing access blocks the remote step, not local workflow exports, tests, runbooks, or configuration preparation. Report exactly which account/input is missing.

## Review Focus

1. Replayed/expired confirmation links and changed contact addresses must not authorize delivery (Task 1).
2. Concurrent events and failed SMTP must not silently bypass throttles or report successful delivery (Tasks 1–2).
3. Queued recaps must recheck subscription state after unsubscribe (Task 3).
4. Cold starts, wrong tokens and unavailable Maritime must preserve local planning (Tasks 4, 7).
5. Email link scanners and phones without eligible live letters must not produce misleading verification evidence (Tasks 1, 8).

## Run order

Start **Tasks 1, 4 and 5** in parallel. Tasks 2 and 3 can prepare exports/tests in parallel, then finish integration once Task 1 freezes storage contracts. Task 6 follows Task 1. Task 7 follows Tasks 1–6. Task 8 follows Task 7.

The lead owns merging, shared schema decisions, release revision selection and final verification. Do not count a mock, export file, or enabled feature flag as proof of live delivery.

## Task 1 — n8n subscriptions, confirmation and unsubscribe

**Owner/files:** Agent A: `n8n/subscribe.json`, `n8n/contact-links.json`, `n8n/schema.md`, `n8n/README.md`, `n8n/tests/subscriptions.test.mjs` and subscription-only helpers under `n8n/lib/`. No edits to lesson/recap workflows.

**Inputs:** n8n Cloud workspace/editor access, its public HTTPS origin, Data Table access, Gmail SMTP credential (dedicated Gmail account + app password, created as an SMTP credential inside n8n Cloud), backend/webhook shared secret supplied securely. Local exports/tests do not require these accounts.

**Produces — shared contract:**
- Existing Header Auth subscribe POST body from `n8n/README.md`; successful response only after persistence, non-2xx on storage or required confirmation-send failure. Unsubscribe action deletes the entire learner subscription.
- Versioned table definition: existing learner/name/email fields plus `contactConfirmedAt`, `contactToken` (confirmation only), `contactTokenCreatedAt`, separate `unsubscribeToken`, `lastSentAt`. Tokens are cryptographically random, unguessable, server-generated; redact logs and exports. Confirmation consumes its token; unsubscribe remains usable after confirmation. Tokens rotate when the address changes. Define exact field types/null representation in `schema.md` for Agents B/C.
- Define suppression/throttle storage shared with Agent B; unsubscribe must prevent an old pending request or queued event from restoring a removed contact. Do not overload the confirmation token as a permanent unsubscribe token.

- [ ] Add failing behavioral tests for new/changed/removed contact, repeat confirmation, seven-day expiry, old-token rejection after address change, omitted email clearing, and unsubscribe replay.
- [ ] Implement importable workflows, including actual n8n token generation, storage, email and response nodes. Confirm link validates then consumes the token; invalid/reused/expired token changes nothing. Unsubscribe clears the contact fields and both tokens without requiring the app. Verify scanner behavior and document that GET unsubscribe can be triggered by mail scanners; confirmation should require an explicit action on the landing page to avoid scanner-triggered consent, documenting this refinement to the README's GET contract.
- [ ] Enforce at most one confirmation per normalized address per 24 hours and 20 confirmations per hour globally, across learners. Define concurrency handling; do not claim strict limits from a racy read/increment implementation. No lesson email before confirmation.
- [ ] Use the fixed confirmation wording from the README, append the confirmation URL; do not use arbitrary learner-supplied message text. Export no credential secrets.
- [ ] Import into the target n8n version, verify nodes and error responses. Publish exact row schema, webhook URLs, credential placeholders and commands for local tests to Agents B/C and the lead. Update `n8n/README.md` to match implementation.

## Task 2 — n8n lesson-complete workflow

**Owner/files:** Agent B: `n8n/lesson-complete.json`, `n8n/tests/lesson-complete.test.mjs`, lesson-only helpers under `n8n/lib/lesson-*`. Read Task 1's schema; do not edit it.

**Consumes:** authenticated event `{learnerId,lessonId,lessonTitle,xp}`, subscription/confirmation state, unsubscribe URL and throttle contract from Task 1.

**Produces:** importable workflow and tested email template. Canonical lesson titles come from a fixed server-controlled ID map; unknown IDs send nothing. Ignore event `lessonTitle` for email content.

- [ ] Test unconfirmed/missing contact sends nothing; confirmed contact sends fixed plain text with a working unsubscribe link; malformed or unauthenticated request is rejected.
- [ ] Implement ten-minute per-learner throttling, duplicate-event handling and state recheck immediately before sending. Test concurrent events and SMTP failure. Update `lastSentAt` only after send success; document best-effort delivery limits rather than promising exactly-once email.
- [ ] Verify completion response waits for processing and upstream failure is visible. Import and connect to Task 1's tables; supply workflow URL securely to lead.

## Task 3 — n8n recap workflow

**Owner/files:** Agent C: `n8n/weekly-recap.json`, `n8n/tests/weekly-recap.test.mjs`, recap-only helpers under `n8n/lib/recap-*`.

**Consumes:** Task 1 subscription schema and `APP_URL/api/stats/<learnerId>` from the final HTTPS app.

**Produces:** scheduled workflow with documented timezone/schedule and a manual test trigger disabled for public access.

- [ ] Test weighted match share using unequal attempt counts, zero attempts, failed stats fetch and malformed response. Read the actual API response shape from `backend/db.mjs` and route tests before implementing.
- [ ] Schedule weekly delivery; clearly label the data as the last 14 days unless implementing a real seven-day filter from available data. Never average daily percentages.
- [ ] Re-read subscription/email immediately before sending; removed subscriptions send nothing, including queued runs. Use fixed plain text and a stop link that actually stops recaps. Coordinate a separate learner unsubscribe token/endpoint with Agent A before implementation; contact unsubscribe alone must not be represented as stopping learner recaps.
- [ ] Keep learner recap email limited to the operator's own test inbox until learner-email ownership confirmation exists. Document this remaining limitation prominently; do not claim contact double opt-in also confirms learnerEmail.
- [ ] Import workflow, verify manual test and scheduled configuration, provide the lead redacted execution evidence.

## Task 4 — Maritime planner deployment

**Owner/files:** Agent D: `agent/**` and `docs/evidence/maritime.md`. Do not edit root environment files or backend/app code; report required changes to the lead.

**Inputs:** Maritime account/project deployment access, Gemini key, final public app origin from Task 5. Deployment preparation and local tests can start before the app exists.

**Produces:** live `/health` and authenticated `/plan`; securely supplied `MARITIME_AGENT_URL` and `MARITIME_AGENT_TOKEN` (same secret as agent `AGENT_TOKEN`).

- [ ] Check current official Maritime deployment instructions; verify `agent/Dockerfile` and local tests. Test missing/wrong token rejection and bounded request deadline.
- [ ] Deploy the reviewed agent revision, configure `AGENT_TOKEN`, `GEMINI_API_KEY`, `APP_URL` through secrets. Do not claim the generic container is on Maritime without checking the actual host.
- [ ] Verify public health, successful authenticated plan, wrong-token failure, and only allowed lesson candidates/known letters in the response. Confirm service logs contain no secrets or names.
- [ ] Pass the live URL and secret location privately to Task 7; provide redacted deployment evidence and a reproducible health check. Capture planner clip after app integration, coordinated with Task 8.

## Task 5 — Vultr VM (backend only), base HTTPS API deployment, then Vercel frontend

**Owner/files:** Agent E: `backend/deploy/**` and `docs/evidence/deployment.md`. This agent alone provisions/boots the VM. No edits to n8n or agent source.

**Inputs:** authorized Vultr account/budget/region, SSH public key/access, a hostname that resolves to the VM IP (e.g. `<ip-with-dashes>.sslip.io`; nothing is purchased), a Vercel account with access to the repository, reviewed repository revision and private-repo read access if required, secure app environment file. User performs login/payment/2FA steps as needed; do not invent access.

**Produces:** working public HTTPS API origin on Vultr, a Vercel frontend URL whose `/api/*` reaches it, and privately handed-off SSH access for Task 7.

- [ ] Choose the API hostname (any name resolving to the VM IP with Caddy automatic HTTPS, e.g. a free sslip.io name). [NEEDS: verify Let's Encrypt works for the chosen hostname]
- [ ] Create a fresh Ubuntu 24.04 VM, review `backend/deploy/setup.sh`, confirm the hostname resolves to its IP. Review any published AAAA record so it cannot break HTTPS.
- [ ] Select a reviewed release revision actually available to the VM; `git clone`/`git pull` cannot deploy uncommitted worktree changes. Check the deployed revision explicitly. Coordinate any authorized push through the lead.
- [ ] Transfer secrets securely to `/root/handshake.env`, mode 600; never commit, print or screenshot its contents. Keep snapshots/cache export off. Initially leave n8n/Maritime off until their verified endpoints exist.
- [ ] Run the reviewed setup script on the fresh VM. Verify services, HTTPS certificate, `/api/features` (the API no longer serves the frontend), and port 8787 inaccessible externally. Set `HOST=127.0.0.1` and `TRUST_PROXY_HOPS=2`. Preserve SSH access when setting firewall rules. The database is the Tiger Data Cloud service (`DATABASE_URL`, `sslmode=require`); apply `backend/schema.sql` with `npm run db:migrate`.
- [ ] **Vercel frontend:** connect the repository to a Vercel project, set Root Directory to `frontend`, edit the destination in `frontend/vercel.json` (`/api/:path*` → `https://<api-hostname>/api/:path*`; currently a placeholder), and deploy. Check `https://<vercel-url>/api/features` returns JSON through the rewrite. [NEEDS: verify with a real request that `req.ip` seen by Express is the visitor's IP, not a proxy's]
- [ ] Record URL, revision, checks and redacted screenshots. Give Task 4 the public API origin and Task 7 access through the existing secure mechanism.

## Task 6 — Notification UI matches confirmation state

**Owner/files:** Agent F: `frontend/src/components/NotifySettings.tsx`, notification-specific tests, and narrowly scoped API response typing only if agreed with the lead. Do not edit other agents' workflow files.

**Consumes:** Task 1 confirmation behavior; existing `/api/subscribe` response remains `{ok,reason?}` unless explicitly coordinated.

- [ ] Test the saved message: saving a contact means confirmation requested, never confirmation completed. Tell users to use their own address for recap while learner-email verification is absent.
- [ ] Update explanatory/status copy to say contact must confirm before lesson updates; existing Stop behavior must preserve enabled state on failed deletion. No new claim that the app can observe confirmation state without an API supporting that claim.
- [ ] Run UI tests/build and keyboard check. Report pending state honestly when confirmation is throttled or unavailable; coordinate any API contract change rather than assuming delivery from a row write.

## Task 7 — Integrate production settings and prove real email

**Owner:** Lead/release agent; `docs/evidence/n8n.md`, secure production environment, final config documentation. No overlapping deployment agent changes during this task.

**Requires:** Tasks 1–6, final reviewed code deployed, n8n Cloud and Gmail SMTP account access and two consenting test inboxes (learner and contact; both may be operator-owned).

- [ ] Run the integrated `npm test` and `npm run build`. Run workflow-specific tests separately if outside npm's globs. Import all versioned workflows, configure credentials, activate production webhooks.
- [ ] Set `N8N_SUBSCRIBE_URL`, `N8N_EVENT_URL`, `N8N_SECRET`, `MARITIME_AGENT_URL`, `MARITIME_AGENT_TOKEN` securely; restart once and verify `/api/features` and planner behavior. Never put these secrets in VITE variables.
- [ ] Test consent unchecked sends nothing; wrong webhook secret rejects; Save sends only the confirmation; a lesson before confirmation sends nothing; explicit confirmation permits one lesson email; duplicate within ten minutes sends none; changed address requires fresh confirmation.
- [ ] Test expired/reused tokens, contact unsubscribe without the app, app Stop, and a queued recap after Stop. Test SMTP/webhook outage is reported as failure. Test confirmation address/global rate limits without sending dozens of real messages; use controlled sink credentials for load checks.
- [ ] Send one real recap to the operator's inbox, verify weighted counts and window label; restore production schedule after manual test.
- [ ] Capture redacted n8n canvas/execution screenshots, confirmation email, delivered lesson email containing unsubscribe, recap email and post-unsubscribe suppression. Preserve timestamps and workflow versions, redact tokens/addresses. A mocked inbox or successful HTTP response is not delivery evidence.
- [ ] Verify invalid/unavailable Maritime falls back locally, then restore healthy configuration. Record actual planner response/clip with no profile data.

## Task 8 — Real phone camera and submission evidence

**Owner:** Human tester with a physical phone, assisted by an agent maintaining `docs/evidence/phone.md` and final evidence index. No production/source edits; report defects to the owning agent.

**Requires:** Task 7 URL, phone/camera access, final revision; a human-validated letter only if demonstrating live grading.

- [ ] Record device, OS/browser, URL, deployed revision, time and network. Test on the actual HTTPS origin, not localhost or a desktop mobile emulator.
- [ ] Test fresh camera permission, visible feed/tracking, portrait/landscape, permission denial/recovery, and completion/progress reload. With `PRACTICEABLE` empty, lessons may deliberately avoid requesting a camera: use the existing camera demo route and label it a camera/tracking check, not proof of live grading. Do not enable a letter merely to get a screenshot.
- [ ] Test notification confirmation/unsubscribe links in the phone mail/browser flow. Capture a short clip with permission and no secrets or identifiable bystanders.
- [ ] Record pass/fail per check, observed errors and exact screenshots/clips. Do not mark phone testing passed from desktop automation. Link actual n8n, Maritime and deployment evidence; leave any missing proof explicitly pending.

## Copy/paste agent prompt

“Implement Task [NUMBER] from `docs/superpowers/plans/2026-11-07-live-integrations-handoff.md`. Read its referenced contracts and `CLAUDE.md`. You own only the files listed for that task. You are not alone in the codebase: preserve others' edits, do not edit shared files without coordinating with the lead, and do not push/merge unless asked. Complete local artifacts and tests even if live accounts are missing. Report deliverables, tests with observed results, exact blocked account/input, and handoff URLs or secret locations without exposing secret values. Do not mark a remote step complete without live evidence.”
