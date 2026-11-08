# Maritime planner evidence

Status: **local preparation verified; remote deployment pending** (2026-11-07).

## Tested

- `node --test agent/*.test.mjs`: 7 passed, 0 failed on Node v26.8.1.
- Production entry point started locally with dummy credentials and an injected port;
  public health returned 200; missing/wrong bearer returned 401. No live Gemini key was used.
- Authenticated malformed UUID/candidate request returned 400 before planner invocation.
  Regression was observed failing (502 instead of 400), then passing after validation.
- Tool-loop tests verify model-supplied IDs/letter sets cannot replace request scope,
  unknown tools return errors and generation stops after four turns.
- A stalled fake model honored the shared abort signal and rejected after about 32 ms with a
  30 ms test deadline; production default is seven seconds. This tests signal plumbing,
  not live provider/network cancellation or Maritime wake latency.
- Dependency lock generation (`npm install --package-lock-only --ignore-scripts --prefix agent`)
  reported 0 vulnerabilities. Dockerfile reviewed for CA certificates, deterministic install,
  non-root runtime, exec-form startup, context secrecy and provider-injected port.

## Access check and blockers

No Maritime tool/connector was available. No `maritime` CLI executable, Maritime-named process
credentials, or standard `~/.maritime` / `~/.config/maritime` auth directory was present.
Browser login was not inspected; this does not assert that the operator lacks an account.
No resources were created, no billing was enabled and no credentials were printed.

Required before remote execution: authenticated verified Maritime account/project access, an
approved existing resource with confirmed allowance/budget, secret-manager Gemini key and agent
bearer token, final public HTTPS `APP_URL`, and a reviewed deploy artifact/revision.
The release owner must install `MARITIME_AGENT_URL` / `MARITIME_AGENT_TOKEN` after verification.

## Not tested

Docker CLI exists but `docker info` failed (daemon unavailable), so the image was not built or run.
No remote deployment, public Maritime health, live authenticated plan, deployed-log review,
idle wake, production fallback or planner clip has been verified. No live URL or secret location
is available to hand off yet. See [runbook](../../agent/README.md#deployment-runbook-official-procedure-checked-2026-11-07).

## Official references

Procedure checked against Maritime's [container contract](https://maritime.sh/docs/frameworks/custom),
[public web agents](https://maritime.sh/docs/web-apps), [CLI reference](https://maritime.sh/docs/cli)
and [secret configuration](https://maritime.sh/docs/configuration). This planner uses public web
HTTP hosting with its own bearer gate; it does not claim Maritime chat-channel integration.
