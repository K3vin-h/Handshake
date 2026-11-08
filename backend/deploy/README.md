# Vultr API deployment

The backend (Express API) runs on one Vultr VM; the database is Tiger Data Cloud. The frontend is **not** here: it is hosted on Vercel. Lesson, coach, stats and notify calls go from the browser straight to this API over HTTPS (`VITE_API_BASE_URL`; CORS allows only the origins in `ALLOWED_ORIGIN`). **Account calls** (`/api/auth/*`, `/api/me*`) stay relative and go through the Vercel `/api` rewrite in `frontend/vercel.json`, so the browser sees one origin for the session cookie and the Origin check. No domain purchase is needed.

## MANUAL: accounts need the Vercel rewrite destination

`frontend/vercel.json` ships with the placeholder `https://REPLACE_WITH_API_HOST/api/:path*`. **Until a human replaces `REPLACE_WITH_API_HOST` with the real API hostname (the one passed to `setup.sh`, e.g. `203-0-113-10.sslip.io`) and redeploys Vercel, sign-up, log-in, reset and sync are unavailable in production** (the rewrite points nowhere). Everything else keeps working because it uses `VITE_API_BASE_URL`.

How it fits together: Vercel forwards `/api/*` with `Host` = the API host and `X-Forwarded-Host` = the Vercel host. Caddy keeps that `X-Forwarded-Host` (`header_up` in the generated Caddyfile) and Express, with `TRUST_PROXY_HOPS=1`, lets `sameOrigin` compare the browser's `Origin` with it. Without `TRUST_PROXY_HOPS` the header is ignored and every account POST from the Vercel site gets 403. `X-Forwarded-Host` is not trustworthy on its own (anyone calling the API host directly can set it); it is only used for this CSRF check, and a browser on another site cannot set it without a CORS preflight, which the API refuses. `[NEEDS: verify on the live stack that Vercel sends X-Forwarded-Host and Caddy passes it through: a sign-up from the Vercel URL returns 200, not 403]`. Also set on the VM: `APP_ORIGIN=<exact Vercel URL>` (reset links must point at the public site). `COOKIE_SECURE=1` is pinned by the service command (`NODE_ENV=production` alone also makes the cookie `Secure`).

`setup.sh` targets a dedicated fresh Ubuntu 24.04 VM, run as root. It installs Node 24 and Caddy, installs the backend's production dependencies, runs Express as `handshake` on loopback port 8787, and configures automatic HTTPS in Caddy. It changes Caddy and the firewall; review before running on an existing server. VM provisioning is not automated.

## Required operator inputs

- Authorized Vultr account, spending limit, region/plan, SSH access and verified VM host key.
- An **API hostname** that resolves to the VM IP. No purchase needed: a free `<ip-with-dashes>.sslip.io` name works (VM `203.0.113.10` → `203-0-113-10.sslip.io`). `[NEEDS: verify Let's Encrypt issues a certificate for the chosen hostname]`. Any hostname you control also works.
- The reviewed release's full 40-character Git SHA, available to the VM's origin; uncommitted worktree changes cannot deploy. Coordinate any push through the lead.
- A minimal `.env` prepared securely (start from the repo-root `.env.example`). Do not copy the entire developer `.env`. Include only what the backend needs: `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL` (the Tiger Data Cloud connection string). Omit all `N8N_*` and `MARITIME_*` settings until those services are deployed and verified. `SNAPSHOT_ENABLED`, `CACHE_EXPORT_ENABLED`, `HOST`, `TRUST_PROXY_HOPS` and `COOKIE_SECURE` are pinned by the service command. For accounts add `APP_ORIGIN=<exact Vercel URL>` (plus `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `RESEND_FROM` if used). Set `ALLOWED_ORIGIN` to the Vercel URL once it exists (step 6).
- A Tiger Data Cloud service (TimescaleDB 2.13+). The database is not on this VM; `schema.sql` is applied to it with `npm run db:migrate`. Never include database admin passwords in `.env`.

## Initial deployment

1. Create the Ubuntu VM in the Vultr console with an authorized SSH key. Keep console access for firewall recovery.
2. Check the API hostname resolves to the VM IP (`dig +short <hostname>`). If you use your own hostname, inspect AAAA too: remove stale IPv6 or configure valid IPv6 routing.
3. Transfer the curated `.env` to `/root/handshake.env`, owned by root and mode 600. Never paste its contents into logs or reports.
4. Copy **both** `setup.sh` and `preflight.sh` into the same directory on the VM. Review them, then run:

   ```sh
   bash setup.sh <api-hostname> https://github.com/rhgiang/Handshake.git <full-reviewed-commit-sha>
   ```

   Private repos need a separately provisioned read-only Git credential; never embed it in the URL. The script fetches the pinned SHA, refuses tracked local edits or a mismatched origin, and checks out detached HEAD. Reruns use the supplied revision, never an implicit branch tip.
5. Apply the schema with `npm run db:migrate` as documented in `../DATABASE.md`. Add n8n and Maritime settings later in one coordinated pass, then restart `handshake`.
6. In Vercel: import the repo, set **Root Directory = `frontend`**, set the Environment Variable `VITE_API_BASE_URL=https://<api-hostname>` (public, not a secret), edit `frontend/vercel.json` to replace `REPLACE_WITH_API_HOST` with `<api-hostname>` (see the MANUAL section above), and deploy. Then set `ALLOWED_ORIGIN=<exact Vercel URL>` and `APP_ORIGIN=<exact Vercel URL>` (comma-separated for several origins) in the VM `.env` and restart `handshake`. The camera needs the Vercel HTTPS origin.

## Verification and handoff

On the VM, record `git -C /opt/handshake rev-parse HEAD`, `systemctl is-active handshake caddy`, `ss -ltn` (8787 must bind loopback) and `ufw status`. The current SSH connection's server port is preserved; from the console, port 22 is assumed. Existing explicit UFW allow rules are not removed: check for accidental exposure.

From a separate machine:

```sh
curl --fail --show-error https://<api-hostname>/api/features
curl --connect-timeout 5 http://<vm-ip>:8787/api/features   # must fail
curl -i -X OPTIONS -H 'Origin: https://<vercel-url>' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: Content-Type' https://<api-hostname>/api/subscribe   # CORS preflight
```

Require valid public TLS, expected feature states (n8n/Maritime initially disabled), failure to connect to port 8787 externally, and a CORS preflight from the Vercel origin that returns 204 with `Access-Control-Allow-Origin` set to that origin (an origin not in `ALLOWED_ORIGIN` must get no CORS headers). A successful service restart alone is not HTTPS evidence.

Rate limits are per visitor IP. Browsers call the API directly, so the chain is Caddy then Express and the service sets `TRUST_PROXY_HOPS=1`. `[NEEDS: verify with a real request that req.ip is the visitor's IP]`; if all visitors share one IP, check the hop count. Exception: account calls arrive through the Vercel rewrite, so for them `req.ip` is a Vercel egress IP shared by many users. Account routes therefore have no per-IP limits: only per-email limits on login and forgot, and a per-user limit on state sync. Sign-up and Google sign-in are unlimited. Raising the hop count would not fix this (Caddy replaces X-Forwarded-For from untrusted senders) and would let direct callers spoof their IP.

Open the Vercel HTTPS URL on a physical phone and record camera permission/feed/denial recovery; this remains human verification. Do not enable unvalidated letters to produce a camera screenshot. Use the existing camera demo route if live letters are unavailable.

Give the Maritime step the public API origin (`APP_URL`) and the final integration step the revision and existing secure SSH mechanism. Never include private SSH keys, `.env` contents, email addresses or tokens in evidence. Review `journalctl -u handshake` privately before sharing redacted excerpts.

## Local checks and official references

```sh
npm --prefix backend test            # includes deploy/tests
bash -n backend/deploy/setup.sh backend/deploy/preflight.sh
```

These validate inputs and syntax; they do not emulate Ubuntu package installation, systemd, DNS, firewall or ACME.

Reviewed 2026-11-07: [Vultr provisioning](https://docs.vultr.com/products/compute/instances/cloud-compute/provisioning), [Vultr SSH](https://docs.vultr.com/products/compute/instances/cloud-compute/connection/openssh), [Caddy Ubuntu packages](https://caddyserver.com/docs/install#debian-ubuntu-raspbian). Caddy's official Cloudsmith package source matches the script.

## Automatic updates

For production-only GitHub Actions, restricted SSH access, retained backend releases,
and rollback, see [CICD.md](CICD.md). The one-time `setup.sh` bootstrap is not the
CI/CD update command. Do not rerun it after converting to the release layout.
