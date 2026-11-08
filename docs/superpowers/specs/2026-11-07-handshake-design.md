# Handshake: design spec

Date: 2026-11-07 · Sources: `Handshake doc.pdf` (Roles, Jobs & Timeline, 7 Nov) and the starter repo (`CLAUDE.md`, `PLANS.md`).
Rule of precedence: **scope comes from the starter** (letters + whole signs + scene 4.1); **rules come from the 7 Nov doc** (privacy, wording, Gemini constraints, cut rules). Where they conflict, this spec decides.

## 1. Product

Live handshape checking and personal coaching for ASL, starting with the names of the people you're learning for.
Pitch line: **"MediaPipe measures your hands, Gemini coaches you."** Gemini never judges signs.

Persona: a hearing adult with a Deaf friend, relative or coworker. Demo: Ryan learning for Lily (coworker).

### Demo path (must work on stage)
1. **Onboarding** (`#/welcome`): your name, the name of who you're learning for, signing hand. No level or placement questions: everyone starts at lesson 1.1. Shows which letters of both names are practiceable now and which are "reference only, coming later". Names stay on the device (they leave it only if the learner opts in to notifications on `#/stats`, see §10).
2. **Home** (`#/`): Duolingo-style trail from `buildCurriculum`, streak, XP bar, Level badge (`floor(xp / 100) + 1`; replays earn XP again; Level never affects unlocking), locked/stretch badges.
3. **Lesson player** (`#/lesson/<id>`): reference (3D hand / image) beside the webcam, hold-progress ring, tip box. Instant landmark tip on a miss, Gemini tip added when it arrives. Confetti + XP on a match.
4. **Complete** (`#/complete/<id>`): XP earned, next lesson, back to the path.
5. **Progress** (`#/progress`): letters mastered, weak letters, weak fingers ("thumb placement is your most common issue"), streak.

Demo lessons (`scope: "demo"`): 1.1–1.3 (your name), the Unit 2 families covering the practiceable letters, "Spell LILY" (after the last demo family), 3.1 HELLO/BYE, 3.2 MY/NAME + sentence `MY NAME fs:<you>`, scene 4.1.

### Practiceable set
`PRACTICEABLE = A B C D F I L O V W Y` + handshapes `5` and `H` (needed by BYE and NAME).
- J, Z: learn-only (they move). M N S T: added only if they hit the accuracy bar.
- Any other letter in a name → a `learn` step marked "reference only, coming later"; no `practice`/`spell` grading on it. Spelling a word skips non-practiceable letters with a visible "(reference only)" tile.
- Unit 2 demo families must cover all 11 letters: flat (B C O), point (D I L Y), fingers (F V W), fist (A). Other letters stay `stretch`.
- Unit 2 is identical for everyone: every family lesson always exists with all its letters (letters Unit 1 already taught are practised again, not removed), and "Spell <them>" sits at one fixed place, right after the last demo family. Names change step content only, never lesson ids, order or scope.
- A lesson with no graded letters (e.g. a name with only reference-only letters) completes through its Continue buttons.

### Wording and claims
- UI says **"matches the reference"**, never "correct". Until a fluent signer has checked templates: "matches our recording".
- Never claim it improves reading fingerspelling. Scope stated openly on Devpost.

## 2. Rules (from the doc, binding on all groups)
1. `getHandFeedback` (landmarks) is the truth. Gemini only rewords it and must not contradict it. Show the landmark tip first, then Gemini's.
2. Gemini never sees names, relationship or goal. Allowed prompt inputs: the target letter, structured landmark feedback (`finger`, `issue`, `code`, validated server-side), the repeat count, known/weak letters for `/api/words`, and a hand snapshot only if the H4 test passes. The Maritime planner agent (§10) gets the learner UUID, lesson ids and letters only.
3. Both endpoints use `responseSchema`; letter fields are constrained by an `enum` of allowed letters.
4. Any cached/pre-generated response returns `cached: true` and the UI labels it "cached".
5. Same baseline, Duolingo-style: no placement test, no skipping ahead. Every learner gets the same units in the same order (intro → alphabet → greetings and sentences → conversation) and the same unlock rule. Content differs only where it uses your names (Unit 1 letters, the word in "Spell <them>", the scene). Unit 2 never skips letters Unit 1 taught; they are practised again. Inside a lesson, only the practice words and the review pick adapt to your mistakes. Stretch lessons never gate `isUnlocked` or `nextLesson`. `#/lesson/<id>` for a locked lesson shows "Locked" instead of the player. "Skip" moves past a graded item without counting it as a match; the lesson still completes.
6. Personalization (profile, mistake history) stays in localStorage. The check is identical for everyone; personalization never lowers the pass threshold.
7. Sound is never the only cue; confetti/animation respect `prefers-reduced-motion`; detections announced via `aria-live`.
8. Gemini key only in `.env`. `npm run build` passes on main at every merge.
9. Each person edits only their owned files; interface changes go through this spec + `CLAUDE.md`.

## 3. Architecture

Unchanged from the starter: React 19 + Vite, MediaPipe Hand Landmarker in the browser, kNN/MLP recognizer, Express proxy to Gemini (`@google/genai`), hash router in `App.tsx`, progress in localStorage.

```
webcam → useHandTracking → useLetterCheck ─┬─ detection → LessonPlayer → recordAttempt / XP / confetti
                                           └─ feedback[] (with codes) → landmark tip (instant)
                                                                       → recordMistake → repeat count
                                                                       → /api/coach {target, feedback, repeat} → Gemini tip
Onboarding → profile (names, hand) in localStorage → Home welcome = fixed template with names filled in locally
Home/Progress ← buildCurriculum(personalization) + loadProgress + mistakes
```

## 4. Interface changes (update `CLAUDE.md` at H0.5)

### CV → frontend (`frontend/src/cv`, owner Group 1)
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
celebrate(): void   // frontend/src/components/celebrate.ts: confetti (skipped under reduced motion) + short sound
```
Presentational only. Before H10, Group 2 drives them from `#/lesson-preview` with `useFakeCheck`: the D key counts as a detection and M as a miss.
`SEND_SNAPSHOT` (in `api.ts`, owner Group 3) stays `false` unless the H4 snapshot test passes.

### Mistake memory (`frontend/src/lib/mistakes.ts`, owner Group 1; no imports so `node --test` runs it)
```ts
recordMistake(m: Mistakes, letter: string, code: ErrorCode, now?) → Mistakes   // count + lastAt
mistakeCount(m, letter, code) → number
weakFingers(m, limit?) → { finger, count }[]
loadMistakes() / saveMistakes(m)   // localStorage "handshake.mistakes.v1"
```

### Profile (`frontend/src/lib/profile.ts`, owner Group 3)
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

## 5. Ownership and groups

| Group | Owner | Owns | Delivers |
|---|---|---|---|
| 1 · CV + integration | Ryan | `frontend/src/cv/`, `frontend/src/lib/mistakes.ts`, `RecordPage`, `LessonDemo`, `LessonPlayer`, `TokenRunner`, `training/`, `docs/test-log.md` | Reliable letters + signs, `useLetterCheck`, error codes, mistake memory, left-hand mode, H10 integration |
| 2 · Design + frontend | Teammate A | `frontend/src/components/`, `frontend/src/screens/` (Home, Progress, Complete, LessonPreview), `styles.css`, `App.tsx` routes | 5 polished screens, XP/streak/confetti, reference images, scene chat UI, accessibility |
| 3 · Gemini + backend + pitch | Teammate B | `backend/`, `frontend/src/lib/api.ts`, `frontend/src/lib/profile.ts`, `frontend/src/lib/curriculum.ts`, `Onboarding.tsx`, `docs/notes.md` | 2 endpoints (coach, words), onboarding, practice order, adaptive coach, cache, interviews, Devpost, slides, video |

`progress.ts` is shared: Group 2 reads it; nobody changes its exports without telling the team. `docs/notes.md` is owned by Group 3 but append-only for everyone (Groups 1 and 2 log decisions and sources there).
Seams: Group 2 builds `LessonView` and `SceneView` (presentational, in `frontend/src/components/`); Group 1 wires them inside `LessonPlayer`. The starter plan adds every route and an empty stub for every new file at H0.5, so nobody edits `App.tsx` for routing afterwards.

## 6. Roadmap: milestones follow the curriculum (hours from kickoff)
Work is built in curriculum order. Each milestone is a **playable vertical slice**: all three groups deliver their part, merge, and demo it end to end before anyone starts the next milestone's features. Polish and pitch work can run alongside.

| Milestone | Done by | Playable at the gate |
|---|---|---|
| **M0 Foundation** | H0.5 | Starter plan: repo, stubs, routes, interfaces; everyone runs `npm run dev` |
| **M1 Your name** (Unit 1: lessons 1.1–1.3) | H6 | Onboarding → Home (Unit 1) → learn/practise/spell your name with real recognition → landmark tip + Gemini coach → Complete. Letters: the practiceable letters of the user's name (RYAN → A, Y; R, N "reference only") |
| **M2 Alphabet + their name** (Unit 2) | H10 | All 11 letters + `5`, `H` ≥ 80% · contrast + review steps · practice words from `/api/words` · "Spell LILY" · Progress screen · mistake memory + adaptive coach · Gemini shown live once (recorded): a cue that changes on the repeated mistake, and a word drill led by a weak letter |
| **M3 Greetings** (Unit 3: 3.1, 3.2) | H14 | HELLO, BYE, MY, NAME via SignChecker (≥ 4/5 tries, else cut rule) · sentence "MY NAME fs:<you>" |
| **M4 Conversation** (Unit 4: scene 4.1) | H16 | Scene 4.1 chat UI plays end to end → **feature freeze** |
| Ship | H16–H24 | Polish, accessibility notes, Devpost (H21), backup video, rehearsal ×3 (H23) |

Other doc checkpoints that still apply: **H3** design tokens done · skeleton on webcam · Gemini returns a real reply · fluent signer lined up. **H4** snapshot test. **H12** interviews done · adaptive cut rule.

## 7. Cut rules
- Letters not ≥ 80% by H8 → cut to L I Y B O V; demo name stays LILY.
- Adaptive pieces not done by H12 → cut adaptive word selection and/or coach variation; keep mistake memory. Lesson order, baseline and unlock rules never change.
- Signs not ≥ 4/5 by H14 → Units 3–4 become self-checked ("I signed it" button); scene 4.1 dropped from the stage demo.
- Any screen unfinished at H16 → cut from demo path; Lesson player is the one that must work.
- Gemini down → server mock/cached tips (labelled cached). Wifi down → cached model, hotspot, backup video.

## 8. Testing
- `python training/test_parity.py` after any feature change.
- `node --test backend/*.test.mjs`: guards (names never in prompts, letter filters, mock fallback, cached flag).
- `node --test frontend/src/lib/mistakes.test.ts`: counts, weak fingers.
- Webcam accuracy is human-tested: `docs/test-log.md` (letter, tester, 10 tries, hits). Claude can't test the webcam.
- `npm run build` before every merge to main.

## 9. Out of scope (What's next)
Placement test / level quiz, hearts, daily goal, leagues, Gemini-picked word pack (`/api/path`, removed: the stretch word-pack lessons use a fixed default pack). Reading-fingerspelling practice, facial grammar, two-handed auto-checking, rigged glTF hand (PLANS.md #7), SignGemma (10-min check at kickoff only).

## 10. Sponsor tracks (built from their own spec and plan)
`2026-11-07-sponsor-tracks-spec.md` and `plans/2026-11-07-sponsor-tracks.md` add Tiger Data, Databricks, Maritime, n8n, Vercel + Vultr and Entire. This spec only sets the boundaries:
- Each integration is off until its env vars are set; with none set the app behaves as specified above.
- They never change the baseline: same units, order and unlock rule for everyone. The planner agent's "next lesson" uses `nextLesson` (demo scope only).
- New surface: `#/stats` (added by that plan, not by the starter plan) and the server routes `/api/attempts`, `/api/stats`, `/api/plan`, `/api/subscribe`, `/api/lesson-complete`, `/api/features`. `/api/coach` and `/api/words` do not move.
- Privacy: names and emails go only to n8n, only after the consent checkbox. Gemini, the agent and Tiger Data never get names; `fs:` word items are never reported.
- Build order: after the M2 gate. `LessonPlayer` call sites for `reportAttempt` / `reportLessonComplete` are its Task 13, once group-1 Task 6 exists. Claim a track on Devpost only if its unit shipped.
