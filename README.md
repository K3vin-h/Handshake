# Handshake

Learn ASL fingerspelling with live webcam feedback and an AI coach.

## Run
```bash
npm run install:all
cp .env.example .env   # add GEMINI_API_KEY (optional — mock mode without it)
npm run dev            # http://localhost:5173
```

Layout: `frontend/` (Vercel), `backend/` (Vultr API), Tiger Data Cloud (database), `agent/` (Maritime), `n8n/` (n8n Cloud), `training/`. In production the browser calls the Vultr HTTPS API directly: set `VITE_API_BASE_URL` (public) on Vercel and `ALLOWED_ORIGIN` (CORS) on the API; no Vercel rewrite. Root `npm run dev` starts web :5173 + API :8787; `npm run build` builds the frontend; `npm test` runs frontend, backend, agent and deploy tests.

- `#/record`: record letter templates (do this first)
- `#/`: lesson demo: sign L-I-L-Y, earn XP, get coached after two misses

See `CLAUDE.md` for the plan, ownership, and interfaces.

## Optional integrations

`#/stats` shows the practice plan, match stats and notification consent form. Missing integration configuration leaves local practice available.

- Configuration: [.env.example](.env.example) (one file, sectioned by service; copy to the repo-root `.env`; the backend reads it; the frontend needs no env vars).
- Tiger Data Cloud (TimescaleDB, the database): [backend/DATABASE.md](backend/DATABASE.md).
- Maritime planner and local fallback: [agent/README.md](agent/README.md).
- n8n consent and workflow setup: [n8n/README.md](n8n/README.md).
- Vultr API deployment (Vercel hosts the frontend; see [plan](docs/superpowers/plans/2026-11-07-vercel-vultr-architecture.md)): [backend/deploy/README.md](backend/deploy/README.md), [setup.sh](backend/deploy/setup.sh).
- Submission evidence: [docs/devpost-tracks.md](docs/devpost-tracks.md).
- Devpost draft: [docs/devpost-draft.md](docs/devpost-draft.md).

External services require separate setup and live verification; placeholders are not evidence of deployment.

Local integration checks: `npm test` includes planner and deployment-preflight tests. For notification SQL and workflow-expression checks, first run `npm ci --prefix n8n`, then `npm run test:n8n`; these do not replace live n8n/SMTP testing. Track deployment and prize evidence in [docs/evidence/status.md](docs/evidence/status.md).
