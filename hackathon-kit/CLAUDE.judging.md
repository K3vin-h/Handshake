# Judging map and project rules (append to CLAUDE.md; every Claude session reads this)

We are building Handshake: live handshape checking and personal coaching for ASL fingerspelling, starting with the names of the people you are learning for. Hearing people with a Deaf friend, relative or coworker are the demo persona; deaf and hard of hearing learners are "to confirm at the venue".
Every task must serve a target below. If a task serves none, say so before building it. The planning doc is the source of truth for owners, hours and scope.

## Scope (stated openly)
- IN: Unit 1 (your name) and Unit 2 (the alphabet), static handshapes only.
- Live pass/fail ONLY for letters that pass the Letter gate. All other letters are reference-only (image + how to make it, no pass/fail). J and Z move, so reference-only.
- OUT for now: Units 3-4 (phrases, conversation), whole signs, facial grammar, signed reference clips. Show them as locked "Coming later". Do not build them.
- Demo word: LILY (L, I, Y are live; confirm every letter of the demo word passed the gate).

## Letter gate (Ryan owns; log in docs/test-log.md)
A letter goes live only if it gets at least 80% in 10 tries on a person who did NOT record the templates and on ASL-NOW dataset hands. Add letters in batches of 3 after H8. Look-alike drills (e.g. A vs N) show reference only until both letters pass.
Claude cannot test the webcam. Never mark a letter live; a human logs the result.

## Rubric (no published weights)
Problem Research · Technical Implementation · Design (UI/UX, accessibility) · Innovation · Pitch

## Prize targets and what satisfies each
| Target | Must exist in the submission | Owner |
|---|---|---|
| Best Problem-Solution Fit (beginner only) | Problem statement with a real quote (docs/notes.md) or an honest "[NEEDS]"; each core feature tied to one stated pain | Teammate B |
| Community Impact | Impact statement: who exactly, what changes, honest limits | Teammate B |
| Most Accessible Design (beginner only) | Figma link + accessibility considerations that match what the app actually does | Teammate A |
| Best Design | Real Figma file matching the final app (the layouts canvas is not Figma); 1 font, 2 colours, 3 status colours | Teammate A |
| Best Use of Gemini API | 3 endpoints with responseSchema; Gemini rewords feedback, never grades signs; explained on Devpost | Teammate B |
| n8n (optional) | Only if the core works at H12: session results -> webhook -> summary email | Decide at H12 |

## Privacy rules
- Learner profile, names and mistake history stay in the browser (localStorage).
- Gemini receives letters and error codes only. Never names, never video.
- A webcam snapshot goes to Gemini ONLY if it passed the H4 test (names the intended letter in 8/10, contradicts the landmarks at most 1/10). If kept, the Devpost says a photo is sent to Google's API.
- Hand snapshots (e.g. the "download card") stay in the browser or are cut.

## Accessibility requirements (build these, then describe them; never the reverse)
- Every success/error signal is visual AND text. Sound is never the only cue.
- Confetti and animation respect prefers-reduced-motion.
- Detection results announced via an aria-live region.
- Full keyboard navigation; visible focus; text contrast at least 4.5:1, confirmed with a real contrast checker.
- Left-handed mode mirrors the landmarks (Ryan, H12). The Devpost claims only what shipped.
- No information carried by colour alone; text scales.

## Honesty rules (code, UI copy, Devpost, pitch)
- Say "matches the reference", never "correct" (including "Handshape correct" in mockups).
- Personalization never lowers the pass threshold for anyone; only coaching and practice order adapt.
- MediaPipe landmark feedback (getHandFeedback) is the truth. Gemini rewords it and must not contradict it. Show the instant landmark tip first, then Gemini's explanation.
- Templates are "matches our recording" until an ASL-fluent person checks them. Say so on the Devpost if nobody did.
- Label any cached Gemini response shown in the demo as cached.
- Do not claim fingerspelling is the most important skill, or that the app improves reading fingerspelling. Do not mention SignGemma unless it actually ran.
- Never invent a quote, source or statistic. Use docs/notes.md or write [NEEDS: ...].
- Never say "works". End every task with: Tested (what you ran, what you saw) / Not tested.

## Working rules
- Stay in your own folders; a file outside your area is a question for the owner.
- Commit after each working step. Never merge or push to main unless asked; whoever merges runs the app first.
- Do not change the interfaces in this file without telling the team.
- The Gemini key lives only in .env (gitignored), never in frontend code or the repo.
