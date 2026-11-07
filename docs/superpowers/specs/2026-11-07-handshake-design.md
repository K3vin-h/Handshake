# Handshake: design spec

Date: 2026-11-07 · Sources: `Handshake doc.pdf` (Roles, Jobs & Timeline, 7 Nov) and the starter repo (`CLAUDE.md`, `PLANS.md`).
Rule of precedence: **scope comes from the starter** (letters + whole signs + scene 4.1); **rules come from the 7 Nov doc** (privacy, wording, Gemini constraints, cut rules). Where they conflict, this spec decides.

## 1. Product

Live handshape checking and personal coaching for ASL, starting with the names of the people you're learning for.
Pitch line: **"MediaPipe measures your hands, Gemini coaches you."** Gemini never judges signs.

Persona: a hearing adult with a Deaf friend, relative or coworker. Demo: Ryan learning for Lily (coworker).

### Demo path (must work on stage)
1. **Onboarding** (`#/welcome`): your name, who you're learning for (name, relationship), dominant hand, goal. Shows which letters of both names are practiceable now and which are "reference only, coming later". Names stay on the device.
2. **Home** (`#/`): Duolingo-style trail from `buildCurriculum`, streak, XP bar, locked/stretch badges.
3. **Lesson player** (`#/lesson/<id>`): reference (3D hand / image) beside the webcam, hold-progress ring, tip box. Instant landmark tip on a miss, Gemini tip added when it arrives. Confetti + XP on a match.
4. **Complete** (`#/complete/<id>`): XP earned, message card (download PNG).
5. **Progress** (`#/progress`): letters mastered, weak letters, weak fingers ("thumb placement is your most common issue"), streak.

Demo lessons (`scope: "demo"`): 1.1–1.3 (your name), the Unit 2 families covering the practiceable letters, "Spell LILY", 3.1 HELLO/BYE, 3.2 MY/NAME + sentence `MY NAME fs:<you>`, scene 4.1.

### Practiceable set
`PRACTICEABLE = A B C D F I L O V W Y` + handshapes `5` and `H` (needed by BYE and NAME).
- J, Z: learn-only (they move). M N S T: added only if they hit the accuracy bar.
- Any other letter in a name → a `learn` step marked "reference only, coming later"; no `practice`/`spell` grading on it. Spelling a word skips non-practiceable letters with a visible "(reference only)" tile.
- Unit 2 demo families must cover all 11 letters: flat (B C O), point (D I L Y), fist (A), fingers (F V W). Other letters stay `stretch`.

### Wording and claims
- UI says **"matches the reference"**, never "correct". Until a fluent signer has checked templates: "matches our recording".
- Never claim it improves reading fingerspelling. Scope stated openly on Devpost.

## 2. Rules (from the doc, binding on all groups)
1. `getHandFeedback` (landmarks) is the truth. Gemini only rewords it and must not contradict it. Show the landmark tip first, then Gemini's.
2. Gemini never sees names. It receives letters, relationship, sign ids and error codes only.
3. All three endpoints use `responseSchema`; letter fields are constrained by an `enum` of allowed letters.
4. Any cached/pre-generated response returns `cached: true` and the UI labels it "cached".
5. Personalization (profile, mistake history) stays in localStorage. The check is identical for everyone; personalization never lowers the pass threshold.
6. Sound is never the only cue; confetti/animation respect `prefers-reduced-motion`; detections announced via `aria-live`.
7. Gemini key only in `.env`. `npm run build` passes on main at every merge.
8. Each person edits only their owned files; interface changes go through this spec + `CLAUDE.md`.

## 3. Architecture

Unchanged from the starter: React 19 + Vite, MediaPipe Hand Landmarker in the browser, kNN/MLP recognizer, Express proxy to Gemini (`@google/genai`), hash router in `App.tsx`, progress in localStorage.

```
webcam → useHandTracking → useLetterCheck ─┬─ detection → LessonPlayer → recordAttempt / XP / confetti
                                           └─ feedback[] (with codes) → landmark tip (instant)
                                                                       → recordMistake → repeat count
                                                                       → /api/coach {target, feedback, repeat} → Gemini tip
Onboarding → practiceable letters of names → /api/path {letters, relationship, allowedWords} → wordPack + welcome template
Home/Progress ← buildCurriculum(personalization) + loadProgress + mistakes
```

## 4. Interface changes (update `CLAUDE.md` at H0.5)

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
type Profile = Personalization & { leftHanded: boolean; goal: string; welcome: string };
loadProfile(): Profile | null; saveProfile(p)    // localStorage "handshake.profile.v1"
```

### Frontend → backend (owner Group 3)
```
POST /api/path  { letters: string[], relationship, allowedWords: string[] }
             → { wordPack: string[], welcome: string /* uses {you} and {them}; client fills names */, cached?: boolean }
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
| 1 · CV + integration | Ryan | `src/cv/`, `src/lib/mistakes.ts`, `RecordPage`, `LessonDemo`, `LessonPlayer`, `TokenRunner`, `training/`, `docs/test-log.md` | Reliable letters + signs, `useLetterCheck`, error codes, mistake memory, left-hand mode, H10 integration |
| 2 · Design + frontend | Teammate A | Figma, `src/components/`, `src/screens/` (Home, Progress, Complete, LessonPreview), `styles.css`, `App.tsx` routes | 5 polished screens, XP/streak/confetti, reference images, scene chat UI, accessibility |
| 3 · Gemini + backend + pitch | Teammate B | `server/`, `src/lib/api.ts`, `src/lib/profile.ts`, `src/lib/curriculum.ts`, `Onboarding.tsx`, `docs/notes.md` | 3 endpoints, onboarding, practice order, adaptive coach, cache, interviews, Devpost, slides, video |

`progress.ts` is shared: Group 2 reads it; nobody changes its exports without telling the team.
Seams: Group 2 builds `LessonView` and `SceneView` (presentational, in `src/components/`); Group 1 wires them inside `LessonPlayer`. The starter plan adds every route and an empty stub for every new file at H0.5, so nobody edits `App.tsx` for routing afterwards.

## 6. Roadmap: milestones follow the curriculum (hours from kickoff)
Work is built in curriculum order. Each milestone is a **playable vertical slice**: all three groups deliver their part, merge, and demo it end to end before anyone starts the next milestone's features. Polish and pitch work can run alongside.

| Milestone | Done by | Playable at the gate |
|---|---|---|
| **M0 Foundation** | H0.5 | Starter plan: repo, stubs, routes, interfaces; everyone runs `npm run dev` |
| **M1 Your name** (Unit 1: lessons 1.1–1.3) | H6 | Onboarding → Home (Unit 1) → learn/practise/spell your name with real recognition → landmark tip + Gemini coach → Complete. Letters: the practiceable letters of the user's name (RYAN → A, Y; R, N "reference only") |
| **M2 Alphabet + their name** (Unit 2) | H10 | All 11 letters ≥ 80% · contrast + review steps · practice words from `/api/words` · "Spell LILY" · Progress screen · mistake memory + adaptive coach |
| **M3 Greetings** (Unit 3: 3.1, 3.2) | H14 | `5` and `H` handshapes · HELLO, BYE, MY, NAME via SignChecker (≥ 4/5 tries, else cut rule) · sentence "MY NAME fs:<you>" · word pack from `/api/path` |
| **M4 Conversation** (Unit 4: scene 4.1) | H16 | Scene 4.1 chat UI plays end to end → **feature freeze** |
| Ship | H16–H24 | Polish, accessibility notes, Devpost (H21), backup video, rehearsal ×3 (H23) |

Other doc checkpoints that still apply: **H3** Figma done · skeleton on webcam · Gemini returns a real reply · fluent signer lined up. **H4** snapshot test. **H12** interviews done · n8n decision · personalization cut rule.

## 7. Cut rules
- Letters not ≥ 80% by H8 → cut to L I Y B O V; demo name stays LILY.
- Personalization (doc a–f) not done by H12 → keep mistake memory + practice order only.
- Signs not ≥ 4/5 by H14 → Units 3–4 become self-checked ("I signed it" button); scene 4.1 dropped from the stage demo.
- Any screen unfinished at H16 → cut from demo path; Lesson player is the one that must work.
- Gemini down → server mock/cached tips (labelled cached). Wifi down → cached model, hotspot, backup video.

## 8. Testing
- `python training/test_parity.py` after any feature change.
- `node --test server/*.test.mjs`: guards (names never in prompts, letter filters, mock fallback, cached flag).
- `node --test src/lib/mistakes.test.ts`: counts, weak fingers.
- Webcam accuracy is human-tested: `docs/test-log.md` (letter, tester, 10 tries, hits). Claude can't test the webcam.
- `npm run build` before every merge to main.

## 9. Out of scope (What's next)
Reading-fingerspelling practice, facial grammar, two-handed auto-checking, rigged glTF hand (PLANS.md #7), n8n (decide at H12 only if core works), SignGemma (10-min check at kickoff only), Databricks (dropped).
