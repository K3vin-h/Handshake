# Handshake

Learn ASL fingerspelling with live webcam feedback and an AI coach.

## Run
```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY (optional — mock mode without it)
npm run dev            # http://localhost:5173
```

- `#/record`: record letter templates (do this first)
- `#/`: lesson demo: sign L-I-L-Y, earn XP, get coached after two misses

See `CLAUDE.md` for the plan, ownership, and interfaces.

## Optional integrations

`#/stats` shows the practice plan, match stats and notification consent form. Missing integration configuration leaves local practice available.

- Configuration: [.env.example](.env.example) (server-only secrets).
- Tiger Data: [server/DATABASE.md](server/DATABASE.md).
- Maritime planner and local fallback: [agent/README.md](agent/README.md).
- n8n consent and workflow setup: [n8n/README.md](n8n/README.md).
- Vultr/HTTPS deployment: [deploy/README.md](deploy/README.md), [setup.sh](deploy/setup.sh).
- Submission evidence: [docs/devpost-tracks.md](docs/devpost-tracks.md).
- Devpost draft: [docs/devpost-draft.md](docs/devpost-draft.md).

External services require separate setup and live verification; placeholders are not evidence of deployment.
