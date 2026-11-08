# Vercel + Vultr Architecture Plan

## Context

The app was one Express process serving the Vite build and the API. The decided target splits it by service. Nothing below is deployed or verified; this plan documents the target and who does what.

| Service | Purpose |
|---|---|
| Vercel | Frontend and public website (React/Vite static build) |
| Vultr | Backend API (Express) |
| Tiger Data Cloud | Database (TimescaleDB) |
| n8n Cloud | Email automation (webhooks + workflows) |
| Maritime | AI agent hosting (the /plan planner in `agent/`) |
| Gemini | AI model (coach, words, planner) |
| Gmail | SMTP for n8n emails and testing (dedicated Gmail account + app password configured as an SMTP credential inside n8n Cloud; never in this repo) |

Out: GoDaddy / GoDaddy Registry / "Best Domain" target (no domain purchased), Figma (no Figma file or link).

Target layout (being implemented by a separate session; the old paths `src/`, `public/`, `server/`, `deploy/` map to `frontend/src/`, `frontend/public/`, `backend/`, `backend/deploy/`):

```
Handshake/
├── frontend/   → Vercel (Root Directory = frontend): src/ public/ tests/ index.html vite.config.ts tsconfig.json components.json vercel.json package.json
├── backend/    → Vultr VM: index.mjs app.mjs gemini.mjs db.mjs integrations.mjs limit.mjs validate.mjs precache.mjs precache.json migrate.mjs routes/ schema.sql DATABASE.md README.md deploy/ package.json
├── agent/      → Maritime (own Dockerfile + package.json)
├── n8n/        → n8n Cloud (workflow exports, SQL, tests)
├── training/   → offline ML; writes frontend/public/model/model.json
├── docs/  hackathon-kit/ (untouched)  .env.example  package.json (root scripts: dev, build, test)
```

Wiring: the browser calls relative `/api/*`. Production: Vercel rewrites `/api/:path*` to the Vultr API origin (`frontend/vercel.json`; destination is a placeholder until the VM exists), so no CORS. Local: Vite proxies `/api` to http://localhost:8787. The API host has no purchased domain; any hostname that resolves to the VM IP works with Caddy automatic HTTPS (e.g. `<ip-with-dashes>.sslip.io`).

Out of scope: any live deployment claim, changing privacy/honesty rules, prize evidence capture.

## Execution order

1. Folder move and code/config changes (other session; sequential, one checkout).
2. Docs updated to the new layout (this plan's companion edit).
3. In parallel, user-owned setup: Gmail app password + n8n Cloud import; Maritime deploy; Vultr VM.
4. After the VM URL exists: set the `frontend/vercel.json` destination, create the Vercel project, deploy.
5. Verification and prize evidence.

## Task 1 — Folder move and code/config (other session; status: in progress, not verified by this docs pass)

Files: move `src/ public/ index.html vite.config.ts tsconfig.json components.json` into `frontend/`; `server/` → `backend/`; `deploy/` → `backend/deploy/`.

- [ ] dotenv path in `backend/` loads the repo-root `.env` (one `.env.example`, sectioned by service).
- [ ] `SERVE_STATIC` removed; static serving removed from `backend/index.mjs`. New env: `HOST` (bind address; `127.0.0.1` on the VM behind Caddy) and `TRUST_PROXY_HOPS` (2 in production). Frontend needs no env vars.
- [ ] `frontend/vercel.json` rewrites `/api/:path*` to the Vultr API origin (placeholder).
- [ ] `backend/deploy/setup.sh` is API-only (Caddy + systemd, no `dist/`).
- [ ] Per-deployable `package.json` (`frontend/`, `backend/`, `agent/`, `n8n/`); root `package.json` only convenience scripts: `npm run dev` (web :5173 + API :8787), `npm run build` (frontend), `npm test` (frontend + backend + agent + deploy tests), `npm run test:n8n`.
- [ ] `training/` writes to `frontend/public/model/model.json`.

## Task 2 — User setup (human; not done)

- [ ] Gmail: dedicated account, app password, create an SMTP credential inside n8n Cloud (never in this repo).
- [ ] n8n Cloud: import `n8n/*.json`, select credentials, set variables, activate webhooks, copy webhook URLs into the backend `.env` (`N8N_SUBSCRIBE_URL`, `N8N_EVENT_URL`, `N8N_SECRET`).
- [ ] Maritime: deploy `agent/` (see `agent/README.md`), copy `MARITIME_AGENT_URL`/`MARITIME_AGENT_TOKEN` into the backend `.env`.
- [ ] Vultr: create the VM, run `backend/deploy/setup.sh` (see `backend/deploy/README.md`), apply `backend/migrate.mjs` against the Tiger Data Cloud service (`DATABASE_URL`, `sslmode=require`).
- [ ] Vercel: connect the repo, Root Directory `frontend`, set the `frontend/vercel.json` rewrite destination to the Vultr API origin, deploy.

## Open items

- [NEEDS: verify Let's Encrypt works for the chosen hostname (e.g. sslip.io)]
- [NEEDS: verify with a real request that req.ip is the visitor's IP with `TRUST_PROXY_HOPS=2` behind Vercel + Caddy]
- [NEEDS: confirm with organizers whether Best Design and Most Accessible Design are still eligible without a Figma file]
- [NEEDS: verify Gmail SMTP limits and that n8n Cloud accepts the Gmail SMTP credential]

## Verification (run after the move; none run by this docs pass)

- `npm run build` → frontend builds to `frontend/dist`.
- `npm test` and `npm run test:n8n` → pass (record real counts in `docs/evidence/status.md`).
- `npm run dev`, then `curl -s localhost:5173/api/features` → JSON via the Vite proxy; `curl -s localhost:8787/api/features` → JSON directly.
- After deploy: `curl -s https://<vercel-url>/api/features` → JSON through the Vercel rewrite; `curl -m 5 http://<vm-ip>:8787/` fails from outside; phone opens the Vercel URL and shows the camera prompt.
- `rg -n -i 'figma|godaddy|SERVE_STATIC' docs CLAUDE.md README.md` shows only removal notes and `[NEEDS]` items.
