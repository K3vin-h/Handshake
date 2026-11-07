# Consent-gated notifications

The app's `#/stats` form starts unchecked. Names and email addresses are sent only after explicit consent and a successful Save; a failed webhook does not enable local lesson reporting. Stop deletes the remote subscription before clearing local reporting. Do not clear browser storage instead of unsubscribing: it does not delete the remote row or stop scheduled recaps.

Set all of `N8N_SUBSCRIBE_URL`, `N8N_EVENT_URL`, `N8N_SECRET` on the API server. Missing any leaves the feature disabled. Both URLs must be trusted production webhooks over HTTPS. Create Header Auth credentials with header `X-Handshake-Secret` matching the secret. Never put that secret in client code or workflow exports.

## Workflows to configure in n8n

No workflow exports or live email evidence are included yet. The following is the required contract; build and verify it before claiming this track.

1. **Subscribe**: POST webhook with Header Auth, response deferred until storage completes. Accept `{action:"subscribe",learnerId,userName?,theirName?,learnerEmail?,contactEmail?}`. Upsert a Data Table row by `learnerId`. Replace omitted contact fields with empty values on updates so removed emails are actually removed. If `contactEmail` is new or changed, clear `contactConfirmedAt`, generate a random `contactToken`, and send that address a fixed plain-text confirmation email (see 4). Never include user-supplied text beyond the stored first names. For `{action:"unsubscribe",learnerId}`, delete the row. Respond successfully only after mutation; return non-2xx on failure.
2. **Lesson complete**: authenticated POST `{learnerId,lessonId,lessonTitle,xp}`. Look up the subscription; send only if a saved `contactEmail` exists **and `contactConfirmedAt` is set**. Every email to the contact ends with the one-click unsubscribe link from 4. Build the subject from a fixed `lessonId` → title map, not from `lessonTitle`. Use plain-text email; never insert unescaped names/titles into HTML. Add a ten-minute per-learner throttle and update `lastSentAt` after sending. A read/check/update throttle is best-effort under concurrency. Missing subscription means no email. Defer the webhook response until processing completes.
4. **Contact double opt-in** (the person being emailed must agree, not just the learner):
   - *Confirm*: GET webhook `?token=<contactToken>` sets `contactConfirmedAt` and shows a plain page. Unknown or reused token does nothing.
   - *Unsubscribe*: GET webhook `?token=<contactToken>` clears `contactEmail`, `contactConfirmedAt` and the token. Works without the app.
   - Confirmation email: fixed text ("Someone entered your address to get updates when they finish ASL lessons. Confirm: <link>. Ignore this email to receive nothing."). Send at most one per address per 24 hours, and cap all confirmation emails to 20 per hour overall.
   - Unconfirmed contacts receive nothing else. Confirmation links expire after 7 days.

3. **Weekly recap**: weekly schedule reads rows with `learnerEmail`, fetches `APP_URL/api/stats/<learnerId>`, and sends a plain-text recap. Stats cover the last **14 days**, so describe that window honestly or filter to seven days before calling the result weekly. Calculate match share weighted by attempt counts, not the mean of daily percentages. Recheck that the subscription still exists before sending queued email.

Data Table `handshake_learners`: unique `learnerId`, `userName`, `theirName`, `learnerEmail`, `contactEmail`, `contactToken`, `contactConfirmedAt`, `lastSentAt`. Restrict table access and use your own SMTP/email credentials.

## Human verification

- Missing/wrong webhook secret is rejected.
- Save without consent or without any valid email sends nothing.
- Successful Save creates the row and sends only a confirmation email to the contact; no lesson email arrives before they click Confirm. After Confirm,  a completed lesson sends one test email; duplicate event within ten minutes sends none.
- Stop deletes the row; future lesson events and scheduled recaps send nothing.
- Broken webhook leaves UI reporting the failure; do not claim success.
- Export the three verified workflows here after removing credential references and secrets; capture workflow screenshots and a redacted delivered email.

Known prototype limitation: the anonymous learner UUID is a bearer identifier, not account authentication. Anyone holding it could trigger emails to its saved contact, alter a subscription or read its aggregate stats. Do not use this for sensitive contacts or claim identity verification. Consent is stored in this browser; subscription data lives in n8n until Stop succeeds. The contact must click Confirm before any lesson email is sent, and can unsubscribe from any email without the app. The learner-email recap goes to an address the learner typed and is not confirmed, so use only your own address.
