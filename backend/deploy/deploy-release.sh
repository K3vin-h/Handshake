#!/bin/bash
# Installed by an administrator as /usr/local/sbin/handshake-deploy, root:root 0755.
# Never execute a deployment helper from the fetched application revision as root.
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
APP=/opt/handshake
RELEASES=/opt/handshake-releases
STATE=/var/lib/handshake-deploy
SEED=090f6dc04d22038a34f2428592fbb287a51a429b
REPO_URL=https://github.com/rhgiang/Handshake.git

valid_sha() { [[ "${1:-}" =~ ^[a-f0-9]{40}$ ]]; }
fail() { printf '%s\n' "$*" >&2; return 1; }

active_sha() {
  local target sha
  target=$(readlink "$APP/backend") || return 1
  sha=${target#"$RELEASES/"}; sha=${sha%/backend}
  valid_sha "$sha" && [[ "$target" == "$RELEASES/$sha/backend" ]] || return 1
  printf '%s\n' "$sha"
}

atomic_replace() {
  python3 - "$1" "$2" <<'PY'
import os, sys
os.replace(sys.argv[1], sys.argv[2])
PY
}

write_state() {
  printf '%s\n' "$2" > "$STATE/.$1.$$" || return 1
  atomic_replace "$STATE/.$1.$$" "$STATE/$1"
}

point_release() {
  valid_sha "$1" && [[ -d "$RELEASES/$1/backend" ]] || return 1
  ln -s "$RELEASES/$1/backend" "$APP/.backend.next.$$" || return 1
  atomic_replace "$APP/.backend.next.$$" "$APP/backend"
}

fetch_production() {
  local tip
  git -c core.hooksPath=/dev/null --git-dir="$STATE/repo.git" fetch --no-tags origin \
    '+refs/heads/production:refs/heads/production' || return 1
  tip=$(git --git-dir="$STATE/repo.git" rev-parse refs/heads/production) || return 1
  [[ "$tip" == "$1" ]] || { fail 'Refusing stale SHA: requested commit is not the production tip.'; return 1; }
  git --git-dir="$STATE/repo.git" merge-base --is-ancestor "$SEED" "$1" || return 1
  # This rollout deliberately excludes main's account schema. A schema rollout needs
  # an administrator's separate migration review and an explicit helper update.
  git --git-dir="$STATE/repo.git" diff --quiet "$SEED" "$1" -- \
    backend/schema.sql backend/schema.accounts.sql || {
      fail 'Schema differs from the approved baseline; deployment requires manual review.'; return 1;
    }
}

build_release() (
  set -euo pipefail
  local sha=$1 stage cleanup
  if [[ -d "$RELEASES/$sha/backend" ]]; then
    [[ ! -L "$RELEASES/$sha" && "$(readlink "$RELEASES/$sha/.env")" == "$APP/.env" ]]
    return
  fi
  # Archive only backend code; reject links/submodules before privileged extraction.
  if git --git-dir="$STATE/repo.git" ls-tree -r "$sha" -- backend | \
      awk '$1 == "120000" || $1 == "160000" { found=1 } END { exit !found }'; then
    fail 'Backend symlinks/submodules require manual review.'; exit 1
  fi
  stage=$(mktemp -d "$RELEASES/.stage.XXXXXXXX") || exit 1
  printf -v cleanup 'rm -rf -- %q' "$stage"
  trap "$cleanup" EXIT
  git --git-dir="$STATE/repo.git" archive --format=tar "$sha" backend | \
    tar --no-same-owner -xf - -C "$stage" || exit 1
  [[ -f "$stage/backend/package.json" && -f "$stage/backend/package-lock.json" ]] || exit 1
  chown -R handshake-build:handshake-build "$stage" || exit 1
  # The builder has no production env access; lifecycle scripts are never executed.
  timeout 300 runuser -u handshake-build -- env -i \
    HOME=/var/lib/handshake-build PATH=/usr/bin:/bin \
    /usr/bin/npm ci --prefix "$stage/backend" --omit=dev --ignore-scripts \
    --cache /var/lib/handshake-build/npm-cache --no-audit --no-fund || exit 1
  chown -hR root:root "$stage" || exit 1
  find "$stage" -type d -exec chmod 755 {} + || exit 1
  find "$stage" -type f -exec chmod a+r,go-w {} + || exit 1
  # env.mjs resolves relative to the real release directory, not the stable symlink.
  ln -s "$APP/.env" "$stage/.env" || exit 1
  mv -- "$stage" "$RELEASES/$sha" || exit 1
  trap - EXIT
)

restart_service() { systemctl restart handshake.service; }

healthy() {
  local attempt
  for attempt in {1..12}; do
    if systemctl is-active --quiet handshake.service && \
       curl --silent --show-error --fail --connect-timeout 3 --max-time 5 \
        --resolve 45-63-35-253.sslip.io:443:127.0.0.1 \
        https://45-63-35-253.sslip.io/api/features | \
       /usr/bin/node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);if(!["stats","notify","agent"].every(k=>typeof j[k]==="boolean"))process.exitCode=1}catch{process.exitCode=1}})'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_pending() {
  local prior
  prior=$(cat "$STATE/pending") || return 1
  valid_sha "$prior" || return 1
  point_release "$prior" && restart_service && healthy || {
    fail 'CRITICAL: recovery health check failed; pending state retained for the administrator.'; return 1;
  }
  rm -- "$STATE/pending"
}

interrupted() {
  trap '' HUP INT TERM
  printf '%s\n' 'Deployment interrupted; attempting recovery.' >&2
  restore_pending || true
  exit 1
}

deploy_release() {
  local sha=$1 prior
  valid_sha "$sha" || return 1
  [[ ! -e "$STATE/pending" ]] || { fail 'Interrupted deployment exists: recover with rollback first.'; return 1; }
  prior=$(active_sha) || return 1
  fetch_production "$sha" || return 1
  if [[ "$prior" == "$sha" ]]; then healthy; return; fi
  build_release "$sha" || return 1
  write_state pending "$prior" || return 1
  trap interrupted HUP INT TERM
  if point_release "$sha" && restart_service && healthy; then
    write_state previous "$prior" || return 1
    rm -- "$STATE/pending" || return 1
    trap - HUP INT TERM
    printf 'Deployment healthy: %s (previous: %s)\n' "$sha" "$prior"
  else
    restore_pending || true
    trap - HUP INT TERM
    fail 'Deployment FAILED; recovery attempted. Inspect service status before retrying.'
    return 1
  fi
}

rollback_release() {
  local expected=$1 current target
  valid_sha "$expected" || return 1
  current=$(active_sha) || return 1
  [[ "$current" == "$expected" ]] || { fail 'Refusing stale rollback: active SHA differs.'; return 1; }
  if [[ -f "$STATE/pending" ]]; then target=$(cat "$STATE/pending");
  else target=$(cat "$STATE/previous"); fi
  valid_sha "$target" || return 1
  if point_release "$target" && restart_service && healthy; then
    write_state previous "$current" || return 1
    rm -f -- "$STATE/pending"
    printf 'Rollback healthy: %s (was: %s)\n' "$target" "$current"
  else
    point_release "$current" && restart_service && healthy || \
      fail 'CRITICAL: neither release passed health checks; administrator intervention required.'
    fail 'Rollback FAILED.'
    return 1
  fi
}

main() {
  [[ $EUID -eq 0 ]] || { fail 'Run through the installed scoped sudo command.'; return 1; }
  [[ $# -eq 2 ]] && valid_sha "$2" || return 1
  [[ "$1" == deploy || "$1" == rollback ]] || return 1
  # Lock covers fetching, building, activation and recovery, including manual calls.
  exec 9> "$STATE/lock"
  flock -n 9 || { fail 'Another deployment/rollback holds the server lock.'; return 1; }
  [[ -f "$APP/.env" && ! -L "$APP/.env" && -L "$APP/backend" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$APP/.env")" == root:handshake:640 ]] || return 1
  [[ "$(git --git-dir="$STATE/repo.git" remote get-url origin)" == "$REPO_URL" ]] || return 1
  if [[ "$1" == deploy ]]; then deploy_release "$2"; else rollback_release "$2"; fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
