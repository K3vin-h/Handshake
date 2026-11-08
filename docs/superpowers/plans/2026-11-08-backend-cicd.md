# Backend CI/CD implementation plan

**Goal:** Prepare automatic, tested deployment from `production`, initially based on
`090f6dc04d22038a34f2428592fbb287a51a429b`, without changing production access.

**Architecture:** GitHub tests the event SHA before a secret-bearing deployment job.
A dedicated forced-command SSH account invokes one root-owned helper via scoped sudo.
The helper fetches only production, rejects stale/non-descendant SHAs, builds backend
releases as an unprivileged build user, and atomically switches the backend symlink.
The existing environment and Caddy config are preserved. Failed activation restores
and checks the prior release; failed/interrupted operations retain recovery state.

**Scope:** workflow, root deployment helper, forced-command wrapper, behavioral tests,
and one-time setup/rollback documentation. No app behavior, n8n, DB schemas, secrets,
commits, pushes, or live access changes.

- [x] Write behavioral tests for request validation, exact branch-tip selection,
  failed builds, successful activation, health rollback, stale rollback and recovery.
- [x] Implement root helper and forced-command wrapper; run local fixture tests.
- [x] Add SHA-pinned Actions workflow with test dependency, minimal permissions,
  repository-level Actions secrets, an explicit production-push guard, strict host
  verification and concurrency control.
- [x] Document release-layout conversion, read-only Git access, key verification,
  narrowly scoped sudo, branch setup, test commands and rollback.
- [x] Run backend tests and syntax/workflow validation; request independent code and
  security reviews; resolve findings. Report remote tests still required.

Review focus: no environment writes or root npm execution; exact tested SHA;
failed activation must remain a failed deployment; interrupted activation must be
recoverable; stale workflows and rollback requests must not overwrite newer releases.
