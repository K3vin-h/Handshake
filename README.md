# Handshake

Learn ASL fingerspelling with live webcam feedback and an AI coach, built around the one person you want to talk to: your own name, the alphabet, greetings, then a conversation with them. MediaPipe sees your hands; Gemini explains your mistakes.

## Run
```bash
npm run install:all     # root, frontend, backend and agent (n8n is separate, see below)
cp .env.example .env    # optional: nothing is required to run, see "Configuration"
npm run dev             # web http://localhost:5173, API http://localhost:8787
```
Open http://localhost:5173. On the first visit you go through onboarding (your name, theirs, your signing hand), or click "Use demo profile (Ryan → Lily)". Everything works as a guest with no keys: coaching and "How to form this letter" use canned replies until `GEMINI_API_KEY` is set, and accounts stay off until a database is configured.

The webcam works over plain http on `localhost`. Close other apps or tabs that hold the camera, or the app shows "Device in use".

Layout: `frontend/` (Vercel), `backend/` (Vultr API), Tiger Data Cloud (database), `agent/` (Maritime), `n8n/` (n8n Cloud), `training/` (letter model, Python). In production the browser calls the Vultr HTTPS API directly: set `VITE_API_BASE_URL` (public) on Vercel and `ALLOWED_ORIGIN` (CORS) on the API; no Vercel rewrite. See `CLAUDE.md` for the plan, ownership and interfaces.

## Screens
Player-facing: `#/` home, `#/path` levels, `#/lesson/<id>`, `#/progress`, `#/settings`, `#/stats` (practice plan, match stats, notification consent), `#/camera-demo` (the camera with the coach, nothing scored), and the account screens below. Without a saved profile, any of these shows onboarding first.

Developer tools (the "Dev tools" menu exists only under `npm run dev`; the routes work in every build): `#/record` (record letter templates), `#/record-signs`, `#/sign-diagrams`, `#/demo` (the letter test page: sign L-I-L-Y, earn XP, get coached after two misses), `#/curriculum`, `#/lesson-preview`, `#/components`.

## Guests only
There is no sign-in. Profile, progress and mistakes stay in the browser (`localStorage`). Optional Tiger Data stores anonymous practice attempts (letter/sign id, pass/fail, error codes, random learner id) — never names or emails. Gemini only ever receives letters and error codes, never names or video.

## Configuration
[.env.example](.env.example) is the one file for every service, sectioned by service; copy it to the repo-root `.env` (the backend reads it; the frontend needs no env vars). Leave `HOST`, `TRUST_PROXY_HOPS` and `ALLOWED_ORIGIN` empty for local development.

## Tests and build
- `npm run build` builds the frontend; `npm test` runs the frontend, backend and agent suites.
- On Windows run `npm test` from Git Bash: two backend deploy-script tests start `bash`, which PowerShell may not have on its PATH.
- Two tests (`Complete reads saved completion…` and `onboarding offers names…`) start a Vite server and can time out on a machine that is short of memory; rerun them alone before suspecting a code change.
- n8n has its own package: `npm ci --prefix n8n`, then `npm run test:n8n`. Those SQL and workflow-expression checks do not replace live n8n/SMTP testing.

## Optional integrations

`#/stats` shows the practice plan, match stats and notification consent form. Missing integration configuration leaves local practice available.

- Tiger Data Cloud (TimescaleDB, the database): [backend/DATABASE.md](backend/DATABASE.md).
- Maritime planner and local fallback: [agent/README.md](agent/README.md).
- n8n consent and workflow setup: [n8n/README.md](n8n/README.md).
- Vultr API deployment (Vercel hosts the frontend; see [plan](docs/superpowers/plans/2026-11-07-vercel-vultr-architecture.md)): [backend/deploy/README.md](backend/deploy/README.md), [setup.sh](backend/deploy/setup.sh).
- Submission evidence: [docs/devpost-tracks.md](docs/devpost-tracks.md). Devpost draft: [docs/devpost-draft.md](docs/devpost-draft.md). Track deployment and prize evidence in [docs/evidence/status.md](docs/evidence/status.md).

External services require separate setup and live verification; placeholders are not evidence of deployment.
