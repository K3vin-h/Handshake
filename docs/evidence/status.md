# Live integration execution status

This file records local preparation separately from live deployment and prize evidence.

## Accounts removed (guest-only)

Account/auth (email/password, Google, `/api/auth`, `/api/me`, session cookies) was removed. Guests keep profile, progress and mistakes in `localStorage`. Tiger Data remains anonymous practice storage only (`attempts` hypertable + `#/stats`); no names or emails in Tiger.

| Task | Current status | Evidence |
|---|---|---|
| 1. Subscription / confirmation links | Local exports and SQL tests passed; live import/delivery blocked | `n8n/` |
| 2. Lesson email workflow | Local export and SQL tests passed; live runtime blocked | `n8n/lesson.sql` |
| 3. Recap workflow | Local export and SQL tests passed; live runtime blocked | `n8n/` |
| 4. Maritime | Local runtime tests and deployment preparation complete; live blocked | `maritime.md` |
| 5. Vultr (API) + Vercel (frontend) | Local preflight tests and deployment preparation complete; live blocked | `deployment.md` |
| 6. Confirmation UI | Copy updated; browser host unavailable | `frontend/src/components/NotifySettings.tsx` |
| 7. Live integration / real email | Blocked on accounts, endpoints and controlled inboxes | `n8n.md` |
| 8. Physical phone | Blocked on public HTTPS URL and physical phone | `phone.md` |

## Decisions while executing

- Subscription state uses a separate PostgreSQL notification database rather than n8n Data Tables so reservation limits and mutations can be atomic. This adds a database credential prerequisite; it must never silently reuse the attempt database.
- Express supplies a server-generated requestedAt timestamp on subscribe and Stop. PostgreSQL keeps ordering state after deletion so delayed older subscribe requests cannot undo Stop; later explicit consent can subscribe again. The initial single app server and database clocks must be synchronized. Browser timestamps are ignored. Clock skew and an already in-flight SMTP send remain documented limits; this is not a strict distributed revocation guarantee.
- Contact confirmation uses an explicit POST action after the GET landing page to avoid mail scanners granting consent. Contact and learner unsubscribe tokens are distinct from consumed confirmation tokens.
- Deployment uses a reviewed full commit SHA. Uncommitted worktree files are not assumed to exist in a remote clone.
- Review found a root-only apt-keyring permission risk from umask077; setup now uses022 for public package artifacts while validating/copying the environment file as mode600.

## Access blockers

No authenticated Maritime/Vultr/n8n integration was discovered. Missing: service URLs/account access or secure credential locations; VM decision, budget and SSH access, Vercel project; final reviewed published revision; Gmail SMTP credential in n8n Cloud and operator-controlled inboxes; physical phone. No accounts were created, resources purchased, infrastructure modified, secrets printed or real messages sent.

## Final local verification

- `npm test`: 107 passed, 0 failed on the final run. An earlier concurrent run failed the pre-existing `aborts stalled attempts and respects the total deadline` wall-clock assertion under load; isolated retry passed9/9 Gemini tests, then the full suite passed unchanged.
- `npm run test:n8n`: 22 passed, 0 failed on the final serial run. Uses real PostgreSQL WASM functions and executes exported expressions; not the n8n runtime.
- `npm run build`: passed; existing large-bundle warning remains.
- `bash -n backend/deploy/setup.sh backend/deploy/preflight.sh`, both generator syntax checks and `git diff --check`: passed.
- Separate code, security and database reviews completed. Fixed apt artifact permissions, confirmation/SMTP acknowledgement race, stale request ordering watermark, response expression syntax, and unchanged-Save delivery lease race.
- Browser verification could not start because the browser access host was unavailable. No keyboard/phone-camera verification or real mail screenshots exist.
- n8n import compatibility, form-urlencoded confirmation parsing, multi-row item linking, SMTP error routing, separate-connection PostgreSQL concurrency and deployed privileges remain live verification gates. SMTP cannot be atomic with database state; an already-in-flight message and crash-after-send duplicates remain documented limits. Recaps are restricted to the configured operator inbox until learner-email confirmation is implemented.

No commits or pushes were made. All implementation agents finished their scoped local artifacts; remote tasks remain blocked on the inputs above.
