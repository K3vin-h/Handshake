# Handshake: HackCamp 2026

ASL learning app built around one person you want to talk to. Path: your own name → the alphabet →
greetings and sentences → a conversation with them. The webcam checks your signing live (MediaPipe),
and Gemini coaches mistakes and personalizes the path. Spec, roadmap and plans: `docs/superpowers/` (start with `plans/2026-11-07-roadmap.md`).

## Pitch in one line
"MediaPipe measures your hands, Gemini coaches you." Gemini never judges signs.

## Prizes we're targeting
Beginner Overall (auto), Best Problem-Solution Fit, Community Impact, Best Design (needs Figma link),
Most Accessible Design (needs Figma + accessibility notes), Best Use of Gemini API.
Sponsor/MLH: Tiger Data, Vultr, GoDaddy Registry domain, Databricks, Maritime, n8n, Entire. Spec:
docs/superpowers/specs/2026-11-07-sponsor-tracks-spec.md. Plan: docs/superpowers/plans/2026-11-07-sponsor-tracks.md.

## Stack
- React 19 + TypeScript + Vite (frontend), plain CSS for now → Tailwind/shadcn later
- @mediapipe/tasks-vision Hand Landmarker (pretrained, runs in browser)
- Recognition: trained MLP (scikit-learn → `public/model/model.json`, run with TensorFlow.js) when present,
  else k-nearest-neighbours over recorded templates. See `training/README.md`.
- Accuracy helpers: One Euro filter (landmark smoothing), majority vote over 10 frames, lesson-restricted
  candidates + look-alikes, brightness check with OpenCV.js CLAHE in dark rooms, camera auto exposure/white balance
- Express server (`server/index.mjs`) proxies Gemini via @google/genai. API key lives in `.env` only.
- Optional, env-gated server pieces: `server/precache.json` (cached coach/word replies, labelled "cached"; mock
  until a live run), Maritime planner agent in `agent/` behind `/api/plan` with a local fallback, n8n
  notifications (`server/routes/notify.mjs`, `n8n/README.md`; consent first, double opt-in for the contact is
  specified but not built), `#/stats` page, Vultr/Caddy deploy in `deploy/`.
- Run everything: `npm run dev` → web on :5173, API on :8787 (Vite proxies /api)

## Ownership (only edit your own files; ask before touching others)
| Group | Owner | Owns | Delivers |
|---|---|---|---|
| 1 · CV + integration | Ryan | `src/cv/`, `src/lib/mistakes.ts`, `RecordPage`, `LessonDemo`, `LessonPlayer`, `TokenRunner`, `training/`, `docs/test-log.md` | Reliable letters + signs, `useLetterCheck`, error codes, mistake memory, left-hand mode, H10 integration |
| 2 · Design + frontend | Teammate A | Figma, `src/components/`, `src/screens/` (Home, Progress, Complete, LessonPreview), `styles.css`, `App.tsx` routes | 5 polished screens, XP/streak/confetti, reference images, scene chat UI, accessibility |
| 3 · Gemini + backend + pitch | Teammate B | `server/`, `src/lib/api.ts`, `src/lib/profile.ts`, `src/lib/curriculum.ts`, `Onboarding.tsx`, `docs/notes.md` | 2 endpoints (coach, words), onboarding, practice order, adaptive coach, cache, interviews, Devpost, slides, video |

`progress.ts` is shared: Group 2 reads it; nobody changes its exports without telling the team. `docs/notes.md` is owned by Group 3 but append-only for everyone (Groups 1 and 2 log decisions and sources there).
Seams: Group 2 builds `LessonView` and `SceneView` (presentational, in `src/components/`); Group 1 wires them inside `LessonPlayer`. The starter plan adds every route and an empty stub for every new file at H0.5, so nobody edits `App.tsx` for routing afterwards.

## Rules (binding)
- getHandFeedback (landmarks) is the truth; Gemini only rewords it. Landmark tip first, Gemini tip after.
- Gemini never sees names: letters and error codes only. Names live in localStorage.
- Same baseline, Duolingo-style: everyone starts at 1.1, no placement or level quiz, same units and unlock rule. Only practice words and review adapt.
- Say "matches the reference", never "correct". Label any cached response "cached".
- Sound is never the only cue; respect prefers-reduced-motion; announce detections via aria-live.
- Personalization never lowers the pass threshold.
- Specs and plans: docs/superpowers/specs and docs/superpowers/plans.

## Interfaces (do NOT change without telling the team; source: spec §4)
Starter interfaces (useHandTracking, Recognizer, VoteBuffer, HoldConfirm, buildCurriculum, progress.ts, SignChecker) are unchanged. Additions:

### CV → frontend (`src/cv`, owner Group 1)
```ts
type FingerFeedback = { finger: string; issue: string; code: ErrorCode };
type ErrorCode = `${"thumb"|"index"|"middle"|"ring"|"pinky"}:${"curl"|"direction"|"placement"}`;
const PRACTICEABLE: string[];            // letters + "5" + "H" that pass the accuracy bar
isPracticeable(letter: string): boolean;
useLetterCheck(target: string, lessonLetters: string[], opts?: {
    leftHanded?: boolean; holdMs?: number; enabled?: boolean;
    onMatch?(d: SignDetection): void;                              // target held ~0.8 s
    onMiss?(feedback: FingerFeedback[], missCount: number): void;  // every 4 s without a match
    onFrame?(hand: HandFrame | null, pred: Prediction, now: number): void }) // for SignChecker
  → { cam /* pass to <Camera {...cam}/> */, progress: 0..1, prediction, missCount, hint, templates, snapshot(), reset() }
```
`useLetterCheck` wraps Recognizer → VoteBuffer → HoldConfirm → miss timer → getHandFeedback. `features.ts` already mirrors left hands, so left-handed mode means picking the dominant hand when two are visible (`numHands: 2`) and mirroring the 3D reference. It never loosens a threshold. A hand partly out of frame counts as no hand, and `hint` asks the learner to move it in.

### Frontend view contract (owner Group 2)
```ts
type LessonViewProps = { title; target; word?: { letters: string[]; index: number }; reference: ReactNode; showReference;
  camera: ReactNode; progress; landmarkTip; coachTip; coachCached; sideBySide; status /* aria-live */; stepLabel;
  actionLabel /* "Skip" | "Continue" */; onAction(); onSelfCheck?() };
type SceneViewProps = { turns: { them: { gloss; english }; you: { tokens: string[]; english } }[];
  turnIndex; tokenIndex; camera: ReactNode; prompt; onSelfCheck?() };
celebrate(): void   // src/components/celebrate.ts: confetti (skipped under reduced motion) + short sound
```
Presentational only. Before H10, Group 2 drives them from `#/lesson-preview` with `useFakeCheck`: the D key counts as a detection and M as a miss.
`SEND_SNAPSHOT` (in `api.ts`, owner Group 3) stays `false` unless the H4 snapshot test passes.

### Mistake memory (`src/lib/mistakes.ts`, owner Group 1; no imports so `node --test` runs it)
```ts
recordMistake(m: Mistakes, letter: string, code: ErrorCode, now?) → Mistakes   // count + lastAt
mistakeCount(m, letter, code) → number
weakFingers(m, limit?) → { finger, count }[]
loadMistakes() / saveMistakes(m)   // localStorage "handshake.mistakes.v1"
```

### Profile (`src/lib/profile.ts`, owner Group 3)
```ts
type Profile = Personalization & { leftHanded: boolean };   // Personalization.relationship is optional (default pack)
const WELCOME: string;   // uses {you}/{them}; fillNames(WELCOME, profile)
loadProfile(): Profile | null; saveProfile(p)    // localStorage "handshake.profile.v1"
```

### Frontend → backend (owner Group 3)
```
POST /api/coach { target, feedback: FingerFeedback[], repeat: number, snapshot?: string }
             → { tip: string, cached?: boolean }
             repeat 1: one short cue · 2: a different cue or comparison · 3+: UI also shows reference beside live hand
POST /api/words { knownLetters: string[], weakLetters: string[] }
             → { words: string[], cached?: boolean }    // words built only from knownLetters, weak letters first
```
`snapshot` is accepted only if the H4 snapshot test passes (≥ 8/10 letter named, ≤ 1/10 contradicts landmarks); otherwise the field is ignored server-side and dropped client-side.

## How recognition works
1. Webcam (720p, auto exposure) → brightness check; if dark, OpenCV.js CLAHE enhances the frame.
2. MediaPipe gives 21 landmarks/frame → One Euro filter smooths them.
3. `extractFeatures` (88 numbers): normalized coords + finger curl + direction + fingertip distances.
   MUST stay identical to `training/features.py` — run `python training/test_parity.py` after any change.
4. `Recognizer`: trained MLP if `public/model/model.json` exists, else kNN; only lesson letters + look-alikes.
5. `VoteBuffer` (majority of 10 frames) → `HoldConfirm` (~0.8 s) → one detection.
6. Feedback for the coach: per-finger curl/direction vs the letter's mean template.
7. Data: `#/record` exports per person → `src/cv/templates.json` (kNN) and `training/data/recorded/` (training).

## Curriculum (src/lib/curriculum.ts — preview at #/curriculum)
- Unit 1 Introduce yourself: letters of YOUR name → spell it → checkpoint.
- Unit 2 Alphabet by handshape family, identical for every learner (same ids and order; Unit 1 letters are
  simply practised again): 2.1 B C O · 2.2 D I L Y · 2.3 V W F · 2.4 A · 2.5 "Spell <their name>" (fixed slot
  after the last demo family) · stretch families U K R / S E T M N / G H P Q X · J/Z self-checked · checkpoint.
- Unit 3 Greetings + sentences: HELLO/BYE, MY NAME <fs>, polite words, questions (eyebrows), answers,
  a relationship word pack chosen by Gemini from SIGNS, checkpoint introduction.
- Unit 4 Conversation: 4 scripted scenes; first hello → how are you → small talk → full conversation.
- Every letter lesson: learn → practise ×3 → look-alike drill → real words → review (spaced, Leitner boxes).
- Mastery = 3 correct in a row. A lesson unlocks when the previous one is completed.

## Scope (realistic for 24 h)
- DEMO: 1.1–1.3, 2.1–2.3, 3.1–3.2, scene 4.1. Demo names: Ryan → Lily (coworker).
- Whole signs are "assisted": handshape + body zone + movement. Two-handed/facial signs are self-checked.
  Sign descriptions are simplified: verify against a Deaf-led source (Lifeprint) before the demo.
- Record templates for every handshape `requiredHandshapes()` lists, including "5" (open hand).
- Drop: Auth0. Stretch: everything marked stretch, rigged 3D hand.

## 3D hand (lesson reference)
- `src/components/HandModel3D.tsx`: React Three Fiber + drei OrbitControls (drag to spin, auto-rotate).
- Pose = average of recorded MediaPipe **world landmarks** for the letter (`meanPose3D` in `src/cv/pose3d.ts`),
  so it shows real signing. Templates recorded before this change have no `world` data: re-record.
- MVP renders a skeleton (spheres + capsules). Upgrade: rigged glTF hand (three.js WebXR generic hand or a
  CC-licensed Sketchfab hand) posed from the same 21 points, via Kalidokit or `quaternion.setFromUnitVectors`
  per bone. Keep the skeleton as fallback; lazy-loaded so it never slows the first page.

## Checkpoints
0.5h interfaces+repo · 3h Figma done, skeleton on webcam, Gemini test reply · 6–8h letters recognized,
screens on fake data · 10h full integration · 16h FEATURE FREEZE · 20h Devpost + backup video · 22–24h rehearse.

## Rules for Claude sessions
- Stay inside the owner's folders listed above.
- Never put the Gemini key in frontend code.
- Keep `npm run build` passing; main must always run.
- Prefer small, working increments over big rewrites.

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
| Best Use of Tiger Data | `attempts` hypertable + the #/stats chart; empty state when no DB; schema.sql in the repo | Sponsor plan T2, T7 |
| Best Use of Vultr + Best Domain (GoDaddy Registry) | Live HTTPS URL on a Vultr VM at an eligible domain; the camera works on a phone | Sponsor plan T9 |
| Best Use of Databricks | MLflow runs comparing 3 network sizes on the recognizer data + report.txt; exported model.json | Sponsor plan T10 |
| Best Agent on Maritime | Practice-planner agent deployed on Maritime, demo clip, local fallback when it is down | Sponsor plan T8 |
| Best Use of Entire | Repo + sessions on Entire, one screenshot each of Sessions, Graph, Brain | Sponsor plan T12 |
| n8n | Built behind the consent form and env vars (lesson-complete message to the person you learn for + weekly recap). Only demoed if the core works at H12. | Sponsor plan T3, T11 |

## Privacy rules
- Learner profile, names and mistake history stay in the browser (localStorage). Two opt-in exceptions, both off unless env vars are set:
  - Tiger Data receives per-attempt rows: letter or sign id, pass/fail, error codes, an anonymous random id. Never names or emails.
  - n8n receives first names and emails ONLY after the user ticks the consent checkbox on #/stats, and can be stopped there. Names and emails never go to Gemini, Maritime or Tiger Data.
  - The Devpost must say both, plus the known risk: anyone holding a learner id could trigger emails to that learner's saved contact.
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
- Stay in your own folders; a file outside your area is a question for the owner. Exception: the sponsor-tracks plan edits server/, src/lib/api.ts, src/App.tsx and training/train.py by agreement; tell the owner before you merge those.
- Commit after each working step. Never merge or push to main unless asked; whoever merges runs the app first.
- Do not change the interfaces in this file without telling the team.
- The Gemini key lives only in .env (gitignored), never in frontend code or the repo.
