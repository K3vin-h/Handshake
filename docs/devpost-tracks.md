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
| Vercel (frontend) + Vultr (backend) | `frontend/vercel.json` rewrite of `/api/*`; `backend/deploy/setup.sh`, `backend/deploy/README.md`; API-only on loopback behind Caddy | [NEEDS: Vercel deployment URL, VM evidence, live HTTPS API URL (e.g. sslip.io hostname; verify Let's Encrypt works for it), phone camera test via the Vercel URL, external port check, verify `req.ip` is the visitor's IP with `TRUST_PROXY_HOPS=2`] |
| Databricks | Existing recognizer training under `training/` | [NEEDS: Databricks job, three MLflow runs, per-letter report.txt, exported model.json, screenshots]. No Databricks usage claimed by this change |
| Maritime | `agent/` deployable planner; guarded `/api/plan`; local fallback on absent, failed or invalid agent | [NEEDS: actual Maritime deployment URL, live tool-loop evidence and short planner-card demo showing agent/local labels] |
| n8n (n8n Cloud + Gmail SMTP) | `#/stats` consent form, subscribe/unsubscribe and lesson-complete forwarding; `n8n/README.md` workflow contract | [NEEDS: configured and exported three workflows, screenshots, redacted delivered email, Stop and throttle verification]. No exported/live workflows claimed yet |
| Entire | No setup performed by this task | [NEEDS: repo URL and actual Sessions, Graph, Brain screenshots and commands in docs/notes.md] |

Do not select Freebuff, Lovable, Auth0, Solana, DeepSpace or Hardware based on this implementation. Revisit only if a real shipped contribution supports the claim.

## Demo capture order

1. Record the actual letter gate results in `docs/test-log.md`; use only validated live letters.
2. Show a lesson, immediate landmark cue and a labeled Gemini or cached response.
3. Show the stats table/chart with real attempts; planner shows `planned by: agent` only for a validated agent reply. Disable the agent and show `planned by: local`.
4. With test addresses and consent, Save notifications, complete a new lesson, capture the delivered email, then Stop and verify remote deletion and no future sends.
5. Capture HTTPS on a phone, hosting evidence (Vercel + Vultr) and each external sponsor artifact before changing its status to demonstrated.

## Privacy note for Devpost

Profiles, names, mistake memory and webcam frames remain in the browser during ordinary practice. Optional Tiger Data stores per-attempt letter/sign ids, match flags, error codes, timestamps and an anonymous random UUID; fingerspelled word ids that may contain names are excluded. Gemini receives letter sets and measured feedback, not names or emails; the Maritime planner receives UUID, lesson ids and letter sets and can request aggregate stats/practice words. Snapshot sending is disabled by default and must remain unclaimed unless the documented human gate passes; if enabled, disclose that a hand photo is sent to Google's API.

Only after explicit notification consent, first names and selected email addresses go through the server to n8n. Opted-in lesson events also include lesson title (which may contain a name), lesson id and XP. Stop requests deletion of the n8n subscription; clearing browser storage alone does not stop scheduled emails. UUIDs are bearer identifiers: anyone holding a learner id could trigger emails to the saved contact, change a subscription or read its aggregate stats. No account authentication is claimed. Planned: the contact must click a confirmation link before any lesson email is sent, and can unsubscribe from any email [NEEDS: build and verify the n8n double opt-in workflow (n8n/README.md item 4) before claiming this].
