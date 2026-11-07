#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 24.04 Vultr VM. Run as root:
#   bash setup.sh <domain> <git-repo-url>
# scp your .env to /root/handshake.env first (the clone needs an empty /opt/handshake), or the script stops and tells you.
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain> <repo-url>}"
REPO="${2:?usage: setup.sh <domain> <repo-url>}"
APP=/opt/handshake
[[ $EUID -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ && "$DOMAIN" == *.* ]] || { echo "Invalid domain" >&2; exit 1; }
[[ "$REPO" == https://* ]] || { echo "Use an HTTPS repository URL without embedded credentials" >&2; exit 1; }
[[ -f /root/handshake.env ]] || { echo "Missing /root/handshake.env" >&2; exit 1; }

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
git pull --ff-only
npm ci
npm run build
chown -R handshake:handshake "$APP"

cat > /etc/systemd/system/handshake.service <<UNIT
[Unit]
Description=Handshake
After=network.target

[Service]
User=handshake
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/env SERVE_STATIC=1 PORT=8787 CACHE_EXPORT_ENABLED=0 /usr/bin/node server/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8787\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile

systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile
systemctl enable handshake
systemctl restart handshake
systemctl restart caddy

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Done. Check: curl -I https://$DOMAIN"
