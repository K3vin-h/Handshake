#!/usr/bin/env bash
# Shared by setup.sh and local tests; never reads secrets or changes the host.
validate_deployment() {
  local domain="${1:-}" repo="${2:-}" revision="${3:-}" label
  [[ ${#domain} -le 253 && "$domain" == *.* && "$domain" != *..* ]] || { echo 'Invalid domain' >&2; return 1; }
  local labels
  IFS=. read -r -a labels <<< "$domain"
  for label in "${labels[@]}"; do
    [[ ${#label} -le 63 && "$label" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$ ]] || { echo 'Invalid domain label' >&2; return 1; }
  done
  [[ "$domain" != *. ]] || { echo 'Invalid domain' >&2; return 1; }
  [[ "$repo" =~ ^https://[a-zA-Z0-9.-]+/[a-zA-Z0-9_./-]+$ ]] || { echo 'Use a credential-free HTTPS repository URL' >&2; return 1; }
  [[ "$revision" =~ ^[a-fA-F0-9]{40}$ ]] || { echo 'Supply a reviewed full 40-character commit SHA' >&2; return 1; }
}
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  validate_deployment "$@"
fi
