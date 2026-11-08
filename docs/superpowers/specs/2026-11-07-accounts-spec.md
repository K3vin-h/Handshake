# Accounts and Saved Progress: Spec

**Status:** design agreed in chat on 2026-11-07, not yet built. **Plan:** `docs/superpowers/plans/2026-11-07-accounts.md`.
**Owner:** whoever picks it up. Touches server (Teammate B's area), onboarding (B), screens and styles (Teammate A / Jayden), and `CLAUDE.md`. Tell them before merging.

## Why
We host the app on a public domain for a sponsor track, so people other than the team will use it. A learner who signs in should keep their path, names and progress on any device, instead of losing it when browser storage is cleared. Today there are no accounts: identity is an anonymous UUID and everything lives in `localStorage`.

## Decisions (from the user)
| Question | Answer |
|---|---|
| Sign-in options | Google, email + password, and "Continue without an account" (guest) |
| Forgot password | Emailed reset link, sent with **Resend** |
| What is saved on the server | **Profile + progress**: names, relationship, signing hand, practice words, completed lessons, XP, streak, per-letter mastery and mistakes |
| Look and feel | Like the Duolingo sign-up page: one card, "Continue with Google", "or", email + password, link to log in |

## Defaults I chose (change any of these, they are cheap to flip)
1. **Where it sits in onboarding:** after the learner has built their path (a final step "Save your progress"), not before it. They have already invested a minute and seen their path, which is how Duolingo does it. A returning user gets "I already have an account" on the first onboarding step.
2. **No email verification in v1.** Anyone can create an account with any address. The one real risk (squatting someone else's address, then losing it to the real owner's Google sign-in) is handled by the Google linking rule below. Verification emails are a stretch task.
3. **Sessions last 30 days**, are revocable, and are stored hashed.
4. **Minimum password length 10**, maximum 128, no composition rules.
5. **Attempt history (Tiger Data `attempts`) is not linked to the account** (the user chose "Profile + progress", not "Everything"). Stats keep using the anonymous learner UUID. Linking later means adding `learner_id` to `users`.
6. **Accounts are off when `DATABASE_URL` is unset.** The sign-up screens hide, guest mode works exactly as today, and the API answers 503 `accounts_unavailable`.

## Non-goals
Facebook/Apple sign-in, email verification, two-factor, admin tools, social features, linking attempt history, changing the email address.

## Architecture
Hand-rolled on what already exists: **Express + Postgres (Tiger Data)**, one process serving the SPA and `/api/`, behind Caddy over HTTPS in production. No new service. New dependency: `google-auth-library` (server only). Passwords use `node:crypto` scrypt. Reset emails use Resend's REST API through `fetch` (no SDK).

Rejected: hosted auth (Supabase, Clerk, Firebase Auth). Faster, but a second vendor, a second place for user data next to Tiger Data, and reset emails that would not go through Resend.

### Data (server)
New tables, added to the database by a repeatable migration (see plan Task 1). All `IF NOT EXISTS`.
```sql
users          (id uuid PK default gen_random_uuid(), email text NOT NULL, password_hash text NULL,
                google_sub text UNIQUE NULL, email_verified_at timestamptz NULL, created_at timestamptz default now())
               unique index on lower(email)
sessions       (token_hash bytea PK, user_id uuid -> users ON DELETE CASCADE, created_at, expires_at)
password_resets(token_hash bytea PK, user_id uuid -> users ON DELETE CASCADE, expires_at, used_at NULL)
user_state     (user_id uuid PK -> users ON DELETE CASCADE, profile jsonb, progress jsonb,
                rev integer default 1, updated_at timestamptz default now())
               (the client sends baseRev 0 when the server has no saved state yet; the first save creates rev 1)
```
`password_hash` is null for Google-only accounts. Tokens are random 32 bytes, base64url in the cookie or link, and only their SHA-256 is stored.

### API
All errors are `{ "error": "<code>" }`, matching the existing routes. Auth routes carry their own `express.json` limit and per-IP `rateLimit`.

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /api/auth/config` | none | `{ accounts, googleClientId, resetEmail }` | none |
| `POST /api/auth/signup` | `{ email, password }` | 201 `{ user }` + session cookie | 400 `bad_request`/`weak_password`, 409 `email_taken`, 429, 503 |
| `POST /api/auth/login` | `{ email, password }` | 200 `{ user }` + cookie | 401 `invalid_credentials`, 429 |
| `POST /api/auth/google` | `{ credential }` (Google ID token) | 200 `{ user, isNew }` + cookie | 401 `invalid_token`, 429 |
| `POST /api/auth/logout` | none | 204, cookie cleared, session deleted | none |
| `POST /api/auth/forgot` | `{ email }` | **always** 202 (no account enumeration) | 429 |
| `POST /api/auth/reset` | `{ token, password }` | 204, all sessions of that user deleted | 400 `invalid_token`/`weak_password` |
| `GET /api/me` | none | `{ user: { email, hasPassword, google }, state: { profile, progress, rev } \| null }` | 401 `unauthenticated` |
| `PUT /api/me/state` | `{ profile, progress, baseRev }` | 200 `{ rev }` | 409 `conflict` with `{ state }`, 400, 401 |
| `DELETE /api/me` | none | 204, account and all its rows removed | 401 |

`user` is `{ email, hasPassword, google }`, never the hash or the Google id.

### Security rules (each has a test in the plan)
- **Passwords:** scrypt (N=16384, r=8, p=1), 16-byte random salt per user, stored as `scrypt$N$r$p$salt$hash`, compared with `timingSafeEqual`. Login against an unknown email still runs a scrypt against a dummy hash, so timing does not reveal which emails exist. Login says only `invalid_credentials`.
- **Sessions:** httpOnly, `SameSite=Lax`, `Path=/`, 30 days, `Secure` when `SERVE_STATIC=1` (production, behind Caddy HTTPS). Never `Secure` in dev, where the site is plain http on localhost.
- **CSRF:** every non-GET route rejects a request whose `Origin` header host differs from its `Host` header (403 `forbidden`). Bodies are JSON only. SPA and API share one origin in dev (Vite proxy keeps the Host header) and in production (Caddy keeps it), so no CORS is configured.
- **Google:** the browser gets an ID token from Google Identity Services; the server verifies signature, issuer, audience (= `GOOGLE_CLIENT_ID`) and expiry with `google-auth-library`, and requires `email_verified`. Accounts are matched by Google's stable `sub`, never by email alone.
- **Google linking rule:** if a Google sign-in's verified email matches an existing password account, link them (set `google_sub`). If that password account had `email_verified_at` null, **also clear its password hash**, so a squatter who registered the address first cannot keep access. The real owner can set a new password through "Forgot password".
- **Reset tokens:** 30 minutes, single use, hashed at rest. Using one deletes every session for that user. `forgot` is rate limited per IP and per email (3 per hour) and always answers 202.
- **Rate limits (in-memory, per process):** signup 10 per hour per IP, login 10 per 10 minutes per IP and 10 per 10 minutes per email, forgot as above, state sync 60 per minute per IP.
- **Input:** email must satisfy the existing `isEmail`; names in the profile must match `NAME_RE`; progress keys must match `/^[A-Za-z0-9 :._-]{1,60}$/`; at most 200 progress items, 60 lessons completed, 12 practice words per lesson. Anything else is 400. Request bodies are capped (20 kB auth, 100 kB state).
- **Logs:** never log emails, tokens or passwords. Failures log a fixed sentence, as the existing routes do.

### Saving and merging (client)
`localStorage` stays the working copy, so the app works offline and for guests exactly as now. When signed in:
1. **On load and after sign-in:** `GET /api/me`. If `state` is null, push the local profile and progress. If not, merge, save locally, then push.
2. **After every change** to progress or profile (both `saveProgress` and `saveProfile` fire a `handshake:state` event), push after a 2 second debounce with `baseRev`. On 409, merge the returned state and retry once. Failures are silent; the next change retries.
3. **Merge rules** (pure function `mergeState(local, server)` in `src/lib/merge.ts`):
   - `profile`: the account's profile wins when the account already has state; local wins only when the account has none.
   - `progress.completed`: union. `xp`: the larger. Streak: take the side with the later `lastActiveDay` (tie: larger `streakDays`). `items`: per key, the side with more `attempts` (tie: the server's).
   - The result is never smaller than either side for completed lessons or XP.

### Screens
- `#/signup`: Duolingo-style card. "Continue with Google" button (Google's own rendered button), a divider "or", email and password fields with a show/hide toggle, "Create account", "Already have an account? Log in", and "Continue without an account".
- `#/login`: same card with "Log in" and "Forgot password?".
- `#/forgot`: one email field; always shows "If that address has an account, we sent a link."
- `#/reset/<token>`: new password field.
- Onboarding gets a final step "Save your progress" that shows the sign-up card inline, and a "I already have an account" link on step 1.
- The header shows an account chip: the email when signed in (menu: Settings, Log out), "Log in" when not. Settings gets "Account": log out, delete account (with confirmation text).
- Accessibility: every field labelled, errors in an `aria-live` region and tied to their field, focus moves to the first error, no CAPTCHA, no information carried by colour alone, works with the keyboard only, respects reduced motion. Same tokens as the rest of the app (the "A Silent Voice" palette passes `node src/styles.contrast.mjs`).

## Privacy and honesty (must change with this feature)
- `CLAUDE.md` privacy rules say the profile, names and mistake history stay in the browser. New text: **guests:** unchanged. **Signed-in users:** their profile and progress are stored on our server, tied to their account, and deleted when they delete the account. Gemini still receives only letters and error codes, never names. Attempt rows in Tiger Data stay anonymous.
- Onboarding's footer ("Your names never leave this browser. Only lists of letters may be sent.") becomes accurate for both cases: shown as is for guests, and "Signed in: your names and progress are saved to your account." when signed in.
- `docs/superpowers/specs/2026-11-07-sponsor-tracks-spec.md` lines saying "no auth or accounts" get a pointer to this spec. "Best Use of Auth0" stays out: we use Google sign-in directly.
- The Devpost must say: accounts store email, a password hash or Google id, names and progress; no email verification.

## External setup (only a human can do these)
**Google OAuth client** (free, about 10 minutes)
1. Google Cloud Console, create or pick a project. APIs & Services, OAuth consent screen: External, app name "Handshake", your support email.
2. While the consent screen is in **Testing**, only the test users you list can sign in. Add the team's addresses, or click **Publish app** so any Google account works (the basic scopes `openid email profile` need no review).
3. Credentials, Create credentials, OAuth client ID, type **Web application**. Authorized JavaScript origins: `http://localhost:5173` and `https://<your deployed domain>`. No redirect URIs are needed for the button flow.
4. Put the client ID in `.env` as `GOOGLE_CLIENT_ID`. It is public by design; no client secret is used.

**Resend** (free tier is enough)
1. Create an account and an API key with sending access; put it in `.env` as `RESEND_API_KEY`.
2. Add and verify your sending domain (DNS records on GoDaddy). Until it is verified, Resend only delivers from `onboarding@resend.dev`, and only to the email address of the Resend account owner, so test with that address.
3. Set `RESEND_FROM`, e.g. `Handshake <hello@yourdomain>`.

New `.env` keys: `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_ORIGIN` (for example `http://localhost:5173` in dev, `https://<your domain>` in production).

`APP_ORIGIN` is required for reset emails and must be configured, never read from the request. Building the emailed link from the `Host` header would let an attacker send a forged `Host` and make the victim's reset link point at the attacker's site (host header poisoning), leaking the token. If `APP_ORIGIN` or `RESEND_API_KEY` is unset, `resetEmail` is false in `/api/auth/config` and the "Forgot password" screen says so.

## Risks we accept and state
- No email verification in v1.
- Rate limits are in memory, per process (we run one process).
- Signup reveals whether an email is taken (hiding it breaks sign-up usability); login and reset do not.
- Google "Testing" mode silently blocks anyone not on the list: check it before the demo.
- Progress sync is last-write-wins after the merge; two devices editing within 2 seconds can drop one device's most recent attempt.

## Testing
Server: `node --test` with fake database objects, following `server/routes/attempts.test.mjs` and `server/testutil.mjs`. Client: pure `src/lib/merge.test.ts`, `src/lib/auth.test.ts`. Screens: manual checklist in the plan (Google cannot be automated). Run `npm run build`, `node src/styles.contrast.mjs` and `npm test` before every merge. Note: the two slowest tests (`server/complete.test.mjs`, `server/profile.test.mjs`) start a Vite server and can time out on a loaded machine; rerun them alone.
