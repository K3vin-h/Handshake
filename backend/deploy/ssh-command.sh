#!/bin/bash
# Root-owned forced command. No eval, shell arguments, PTY, or arbitrary sudo.
set -euo pipefail
PATH=/usr/bin:/bin
export PATH

parse_command() {
  [[ "${1:-}" =~ ^(deploy|rollback)\ ([a-f0-9]{40})$ ]] || return 1
  printf '%s %s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
}

main() {
  local action sha parsed
  parsed=$(parse_command "${SSH_ORIGINAL_COMMAND:-}") || {
    printf '%s\n' 'Only deploy <40-character SHA> or rollback <40-character SHA> is permitted.' >&2
    return 1
  }
  read -r action sha <<< "$parsed"
  exec /usr/bin/sudo -n /usr/local/sbin/handshake-deploy "$action" "$sha"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main; fi
