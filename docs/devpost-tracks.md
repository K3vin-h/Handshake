# Devpost track evidence

Submission checklist, not a claim that external integrations have been deployed. Only select a sponsor track after its live evidence is captured. Local code and mocked tests do not establish sponsor usage. Units 1–2 and static fingerspelling are the submission scope; J/Z and unvalidated letters remain reference-only. Quotes stay as `[NEEDS: ...]` until a real source is recorded.

| Track | Repository artifact / current scope | Evidence still needed |
| --- | --- | --- |
| Beginner / nwChoice | Project scope in `CLAUDE.md` | [NEEDS: confirm team eligibility and event track selection] |
| Best Problem-Solution Fit | Personalized name-first curriculum and instant landmark feedback | [NEEDS: real interview quote, speaker permission/context and source in docs/notes.md]; connect each demonstrated feature to an observed pain |
| Community Impact | Intended persona: hearing people learning for a Deaf friend, relative or coworker; optional contact notification | [NEEDS: community feedback and validated impact statement]; do not claim measured learning outcomes or Deaf endorsement |
| Best Design | Existing React lesson screens | Real screenshots of the final app. [NEEDS: confirm with organizers whether this prize is still eligible without a Figma file] |
| Most Accessible Design | Stats chart has a visible text table; notification form has labels and a polite status region; no sound needed for these additions | [NEEDS: real app screenshots, keyboard-only walkthrough, visible focus, 4.5:1 contrast measurement, zoom/text scaling, reduced-motion check, detection aria-live and left-handed-mode verification]. Describe only verified behavior |
| Gemini API | `backend/app.mjs` coach/words; `agent/plan.mjs` tool loop | [NEEDS: live Gemini demo, cached response labels, agent tool trace]. Landmarks measure; Gemini coaches and plans, never grades signs |
| Tiger Data | `backend/schema.sql`, attempts/stats routes, `#/stats` chart, LessonPlayer attempt reporting | [NEEDS: real migration/smoke test, anonymized rows and chart screenshot] |
| Vercel (frontend) + Vultr (backend) | frontend calls the Vultr HTTPS API directly (`VITE_API_BASE_URL`, CORS via `ALLOWED_ORIGIN`); `backend/deploy/setup.sh`, `backend/deploy/README.md`; API-only on loopback behind Caddy | [NEEDS: Vercel deployment URL, VM evidence, live HTTPS API URL (e.g. sslip.io hostname; verify Let's Encrypt works for it), phone camera test via the Vercel URL, external port check, verify `req.ip` is the visitor's IP with `TRUST_PROXY_HOPS=1`; CORS preflight from the Vercel origin] |
| Databricks | Existing recognizer training under `training/` | [NEEDS: Databricks job, three MLflow runs, per-letter report.txt, exported model.json, screenshots]. No Databricks usage claimed by this change |
| Maritime | `agent/` deployable planner; guarded `/api/plan`; local fallback on absent, failed or invalid agent | [NEEDS: actual Maritime deployment URL, live tool-loop evidence and short planner-card demo showing agent/local labels] |
| n8n (n8n Cloud + Gmail SMTP) | `#/stats` consent form, subscribe/unsubscribe and lesson-complete forwarding; `n8n/README.md` workflow contract | [NEEDS: configured and exported three workflows, screenshots, redacted delivered email, Stop and throttle verification]. No exported/live workflows claimed yet |
| Entire | No setup performed by this task | [NEEDS: repo URL and actual Sessions, Graph, Brain screenshots and commands in docs/notes.md] |

Do not select Freebuff, Lovable, Auth0, Solana, DeepSpace or Hardware based on this implementation. Revisit only if a real shipped contribution supports the claim.

## How each piece is used here (with examples)

Describes what the code does. "Not yet live" means no deployment evidence exists; see the table above.

**MediaPipe (browser, not a sponsor)** measures the hand: 21 landmarks per frame → One Euro smoothing → 88 features → recognizer → 10-frame vote → ~0.8 s hold. Example: learner signs L, thumb too close to the index; `getHandFeedback` returns `{finger:"thumb", issue:"is too far from the index finger", code:"thumb:placement"}`. This is the truth; nothing below judges a sign.

**Gemini API** rewords measured feedback; it never grades.
- `POST /api/coach` (`backend/app.mjs`, `responseSchema` with `tip` restricted to an enum of landmark-grounded cues). Example: `{target:"A", feedback:[{finger:"thumb",code:"thumb:placement",issue:"is too far from the index finger"}], repeat:1}` → `{tip:"Move your thumb a little closer to your index finger."}`. `repeat` 2 asks for a different cue or an everyday comparison; 3+ shows the reference beside the live hand. Replies outside the enum or containing "correct/incorrect" are dropped and the landmark tip is returned.
- `POST /api/words`: practice words from known letters only. Example: `{knownLetters:["L","I","Y"], weakLetters:["L"]}` → `{words:["LILY","ILL"]}`.
- `POST /api/explain` and `/api/praise` add how-to text and short praise; both are labelled unverified/cached in the UI.
- Fallback: with no key or on a guard failure the response comes from `backend/precache.json` (e.g. key `coach:L:none::1`) and is labelled "cached".
- Gemini gets letters and error codes only. Never names, emails or video.

**Tiger Data (TimescaleDB)** stores per-attempt rows.
- `backend/schema.sql`: `attempts(ts, learner_id uuid, item, correct, codes text[])`, `create_hypertable('attempts', by_range('ts'))`.
- `LessonPlayer` calls `reportAttempt("L", true)` on a match, or `reportAttempt("A", false, ["thumb:placement"])` on a miss → `POST /api/attempts`. `GET /api/stats/:learnerId` returns `{daily:[{day,attempts,accuracy}], items:[...]}`, drawn on `#/stats` with a text table beside the chart. No `DATABASE_URL` → empty state.
- Not yet live: migration and smoke test against a real Tiger Cloud service (`backend/DATABASE.md`).

**Vercel + Vultr** split the app.
- Vercel serves the static `frontend/` build; Vultr runs the Express API behind Caddy (`backend/deploy/`). The browser calls the API directly: `VITE_API_BASE_URL=https://<ip-with-dashes>.sslip.io`, and the API allows only the Vercel origin via `ALLOWED_ORIGIN`. Direct calls keep per-IP rate limits per visitor (`TRUST_PROXY_HOPS=1`).
- Camera on a phone needs HTTPS, which the Vercel URL provides.
- Not yet live: no deployment URL, CORS preflight or `req.ip` check recorded.

**Databricks + MLflow** train the recognizer.
- `training/databricks/sweep.py` trains three MLPs (`64`, `128,64`, `256,128`), logs each as an MLflow run, and publishes the best `model.json` + `report.txt` to `frontend/public/model/` for TensorFlow.js. Example: `report.txt` shows 0.966 on a random split (optimistic); `report-heldout.txt` shows 0.668 on a held-out person. Quote the held-out number, not the random one.
- Not yet live: no Databricks job or MLflow run screenshots.

**Maritime** hosts the planner agent.
- `agent/plan.mjs` runs a Gemini tool loop (max 4 turns) with `get_stats` (calls `/api/stats/<id>`) and `get_practice_words` (calls `/api/words`). `learnerId` and known letters live in the closure, so the model cannot change them.
- `POST /api/plan` (`backend/routes/plan.mjs`) sends the learner UUID, lesson ids and letters. It accepts the reply only if the lesson is a real candidate and the focus and words use known letters. Example: reply `{lessonId:"2.2", focus:["L"], words:["LILY"], tip:"…", source:"agent"}`. If the agent is down or invalid → `source:"local"` (first candidate, weak known letters, generic tip). The UI shows which one planned.
- Not yet live: no Maritime deployment URL.

**n8n Cloud + Gmail SMTP** send consented email.
- `#/stats` consent box (unchecked by default) → `POST /api/subscribe` → n8n `handshake-subscribe`. The contact gets a fixed confirmation email, and nothing else is sent until they confirm with a POST form.
- On lesson completion, `POST /api/lesson-complete` sends `{learnerId, lessonId, xp}`. Example: finishing `1.2` sends the confirmed contact "lesson 1.2 done, +XP" (no names).
- `weekly-recap.json` runs Mondays 17:00 UTC: 14-day attempts and share matched, from `recap.sql`. Operator test inbox only.
- Stop deletes the remote subscription. Not yet live: no import, no delivered email.

**Entire** is not set up. Nothing to describe.

## Demo capture order

1. Record the actual letter gate results in `docs/test-log.md`; use only validated live letters.
2. Show a lesson, immediate landmark cue and a labeled Gemini or cached response.
3. Show the stats table/chart with real attempts; planner shows `planned by: agent` only for a validated agent reply. Disable the agent and show `planned by: local`.
4. With test addresses and consent, Save notifications, complete a new lesson, capture the delivered email, then Stop and verify remote deletion and no future sends.
5. Capture HTTPS on a phone, hosting evidence (Vercel + Vultr) and each external sponsor artifact before changing its status to demonstrated.

## Privacy note for Devpost

Profiles, names, mistake memory and webcam frames remain in the browser during ordinary practice. Optional Tiger Data stores per-attempt letter/sign ids, match flags, error codes, timestamps and an anonymous random UUID; fingerspelled word ids that may contain names are excluded. Gemini receives letter sets and measured feedback, not names or emails; the Maritime planner receives UUID, lesson ids and letter sets and can request aggregate stats/practice words. Snapshot sending is disabled by default and must remain unclaimed unless the documented human gate passes; if enabled, disclose that a hand photo is sent to Google's API.

Only after explicit notification consent, only the selected email addresses go through the server to n8n (no names, no lesson titles; lessons are identified by id). Opted-in lesson events include only the lesson id and XP. Stop requests deletion of the n8n subscription; clearing browser storage alone does not stop scheduled emails. UUIDs are bearer identifiers: anyone holding a learner id could trigger emails to the saved contact, change a subscription or read its aggregate stats. No account authentication is claimed. Planned: the contact must click a confirmation link before any lesson email is sent, and can unsubscribe from any email [NEEDS: build and verify the n8n double opt-in workflow (n8n/README.md item 4) before claiming this].
