#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 Vultr VM for the API only (the frontend is on Vercel). Run as root:
#   bash setup.sh <api-hostname> <git-repo-url> <commit-sha>
# <api-hostname> only has to resolve to this VM, e.g. 203-0-113-10.sslip.io; Caddy gets its HTTPS certificate for it.
# scp your .env to /root/handshake.env first (the clone needs an empty /opt/handshake), or the script stops and tells you.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/preflight.sh"
validate_deployment "$@"
DOMAIN="$1"
REPO="$2"
REVISION="$3"
APP=/opt/handshake
[[ $EUID -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'Requires Ubuntu 24.04' >&2; exit 1; }
[[ -f /root/handshake.env && ! -L /root/handshake.env ]] || { echo "Missing regular /root/handshake.env" >&2; exit 1; }
[[ "$(stat -c '%a:%u' /root/handshake.env)" == 600:0 ]] || { echo 'Environment file must be root-owned mode 600' >&2; exit 1; }
# Preserve the active SSH port, including servers configured away from port 22.
SSH_PORT="${SSH_CONNECTION:-}"
SSH_PORT="${SSH_PORT##* }"
SSH_PORT="${SSH_PORT:-22}"
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid SSH port' >&2; exit 1; }
# Package signing keys and apt sources are public and must be readable by _apt.
# The environment source is checked mode 600 above and its copy is chmod 600 below.
umask 022

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
git config --global --add safe.directory "$APP"
[[ "$(git remote get-url origin)" == "$REPO" ]] || { echo 'Existing clone has a different origin' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'Existing clone has tracked edits' >&2; exit 1; }
git fetch origin "$REVISION"
git checkout --detach "$REVISION"
[[ "$(git rev-parse HEAD)" == "${REVISION,,}" ]] || exit 1
cd "$APP/backend"
npm ci --omit=dev
cd "$APP"
chown -R handshake:handshake "$APP"

cat > /etc/systemd/system/handshake.service <<UNIT
[Unit]
Description=Handshake
After=network.target

[Service]
User=handshake
WorkingDirectory=$APP/backend
EnvironmentFile=$APP/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/env HOST=127.0.0.1 TRUST_PROXY_HOPS=2 PORT=8787 SNAPSHOT_ENABLED=0 CACHE_EXPORT_ENABLED=0 /usr/bin/node index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8787\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile

# Caddy runs as its own user and must be able to read this non-secret config.
chmod 644 /etc/caddy/Caddyfile /etc/systemd/system/handshake.service

systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile
systemctl enable handshake
systemctl restart handshake
systemctl restart caddy

ufw allow "$SSH_PORT/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

systemctl is-active --quiet handshake caddy
echo "Deployed revision: $(git rev-parse HEAD). Check: curl https://$DOMAIN/api/features"
