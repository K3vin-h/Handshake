# Practice planner

Separate service intended for Maritime deployment (the `/plan` planner agent; the backend on Vultr calls it through `/api/plan`). No Maritime deployment has been performed in this checkout.

The agent calls Gemini with `get_stats` and `get_practice_words` tools, bounded to four turns and a seven-second request deadline. Tools use the request's anonymous id and known letters; model-provided ids cannot change them. The app validates the resulting lesson, focus and words and falls back locally on timeout, invalid output, or missing configuration. It only chooses among the next lesson and completed reviews; it cannot unlock lessons or change recognition thresholds.

Run from this directory with Node 24+:

```sh
npm install
# Supply these through your shell or hosting secret manager:
# AGENT_TOKEN, GEMINI_API_KEY, APP_URL (public HTTPS app origin)
# Optional GEMINI_MODEL and PORT (default 8080)
npm start
```

`Dockerfile` builds the standalone service. Configure the same `AGENT_TOKEN` as the app's `MARITIME_AGENT_TOKEN`, and set `MARITIME_AGENT_URL` to the service's `/plan` URL. `/health` is public; POST `/plan` requires the bearer token. Keep APP_URL operator-controlled. Agent receives UUID, lesson ids, letter sets and aggregate stats, never profile names, emails or camera frames.

[NEEDS: verify Maritime's current deployment procedure, deploy service, capture agent URL and planner demo clip].

## Deployment runbook (official procedure checked 2026-11-07)

Sources: [container contract](https://maritime.sh/docs/frameworks/custom),
[public web agents](https://maritime.sh/docs/web-apps),
[CLI reference](https://maritime.sh/docs/cli), and
[configuration](https://maritime.sh/docs/configuration).

Use a **public web agent** for the existing authenticated HTTP planner. This mode does not
require a `/chat` endpoint. Application bearer authentication remains required on `/plan`.
The service explicitly binds `0.0.0.0` and reads Maritime's injected `PORT`; do not configure
`PORT` in the hosted environment. Docker includes CA certificates for outbound Gemini/app TLS.
No durable files are needed by this stateless planner.

1. Obtain verified Maritime account access to an approved existing resource and confirm available
   credit/budget. Creating resources or enabling a plan requires the operator's budget decision.
   Do not treat a claim-later account as a substitute for the project's authorized account.
2. Use this directory as the entire Docker build context, with `Dockerfile` at its root. A repo
   deployment of the project root would select the wrong context. The dashboard supports ZIP upload;
   package only `Dockerfile`, `package.json`, `package-lock.json`, `server.mjs`, and `plan.mjs`.
   Alternatively build/publish a reviewed image through an authorized registry and select that image.
   Record the exact source revision and artifact hash. Do not deploy uncommitted changes by claiming
   that a remote GitHub revision includes them.
3. In the agent's secret environment settings, supply `AGENT_TOKEN`, `GEMINI_API_KEY`, and the final
   public HTTPS app origin as `APP_URL`. Optionally supply the approved `GEMINI_MODEL`.
   Set Public visibility so the app server can reach the URL without a browser share cookie.
   Never include secrets in ZIPs, CLI arguments, screen captures or logs.
4. Inspect build/deployment status and the actual Maritime agent Overview URL. Only record the
   resulting `https://<agent-id>.mtm.sh` origin after a successful deployment. Set the backend's
   `MARITIME_AGENT_URL` to that origin plus `/plan`; its token must equal `AGENT_TOKEN`.
   The release owner alone changes app production settings.
5. Check `GET <origin>/health` returns 200 and JSON `{ "ok": true }`; check POST `/plan` without
   a token and with a deliberately wrong token each returns 401. For an authenticated test, use a
   secure HTTP client that reads the bearer value from the secret manager without echoing it.
   Use an anonymous test UUID and request, for example:

   ```json
   {"learnerId":"11111111-1111-4111-8111-111111111111","candidates":[{"id":"1.3","letters":["L","I"]}],"knownLetters":["L","I"]}
   ```

   Verify the response lesson is `1.3`, all focus letters are known, and words contain only known
   letters. If output fails the app's stricter response guard, record fallback rather than success.
   Check deployed logs locally with secrets redacted before sharing. Repeat after idle wake and
   verify unavailable/wrong-token integration falls back locally through the app.
6. Record time, revision/artifact hash, actual host, status codes, redacted response and log review.
   Coordinate the final planner clip with the integrated app tester.

Local verification: `node --test agent/*.test.mjs` from the project root. These tests use fake
Gemini/tool responses and a local production server with dummy credentials. They are not proof
of Maritime deployment, live Gemini output, app integration, or cold-start latency.
