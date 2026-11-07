# Handshake: HackCamp 2026

ASL learning app built around one person you want to talk to. Path: your own name → the alphabet →
greetings and sentences → a conversation with them. The webcam checks your signing live (MediaPipe),
and Gemini coaches mistakes and personalizes the path. Implementation plans: see PLANS.md.

## Pitch in one line
"MediaPipe sees your hands, Gemini understands your mistakes."

## Prizes we're targeting
Beginner Overall (auto), Best Problem-Solution Fit, Community Impact, Best Design (needs Figma link),
Most Accessible Design (needs Figma + accessibility notes), Best Use of Gemini API.

## Stack
- React 19 + TypeScript + Vite (frontend), plain CSS for now → Tailwind/shadcn later
- @mediapipe/tasks-vision Hand Landmarker (pretrained, runs in browser)
- Recognition: trained MLP (scikit-learn → `public/model/model.json`, run with TensorFlow.js) when present,
  else k-nearest-neighbours over recorded templates. See `training/README.md`.
- Accuracy helpers: One Euro filter (landmark smoothing), majority vote over 10 frames, lesson-restricted
  candidates + look-alikes, brightness check with OpenCV.js CLAHE in dark rooms, camera auto exposure/white balance
- Express server (`server/index.mjs`) proxies Gemini via @google/genai. API key lives in `.env` only.
- Run everything: `npm run dev` → web on :5173, API on :8787 (Vite proxies /api)

## Ownership (only edit your own folders; ask before touching others)
| Person | Owns |
|---|---|
| Ryan: CV + integration | `src/cv/`, `src/screens/RecordPage.tsx`, `src/screens/LessonDemo.tsx` |
| Teammate A: design + frontend | Figma, `src/screens/*` (other screens), `src/components/`, `src/styles.css` |
| Teammate B: Gemini + backend + pitch | `server/`, `src/lib/api.ts`, onboarding screen, Devpost |

## Interfaces (do NOT change without telling the team)
```ts
// CV → Frontend (import from "src/cv")
useHandTracking(onFrame: (hand: HandFrame | null, now: number) => void)
  → { videoRef, canvasRef, status, error }
extractFeatures(hand) → number[88]   (normalize() is an alias)
new Recognizer(templates).predict(features, candidatesFor(target, lessonLetters))
  → { letter: string | null, confidence: 0..1, distance, source: "mlp" | "knn" }
new VoteBuffer(10).push(prediction) → smoothed prediction
useHandTracking(...) also returns { lighting: "ok"|"dark"|"bright", enhancing, snapshot(hand) }
new HoldConfirm(holdMs = 800, minConfidence = 0.6).update(pred, now) → SignDetection | null
getHandFeedback(userFeatures, meanTemplate(letter)) → { finger, issue }[]

// Curriculum + progress (src/lib)
buildCurriculum({ userName, theirName, relationship, wordPack?, practiceWords? }) → Unit[] → Lesson[] → Step[]
  Step kinds: learn | practice | contrast | spell | sign | sentence | review | scene
  Lesson.scope: "demo" | "stretch";  Lesson.grading: "auto" (letters) | "assisted" (signs) | "self"
loadProgress / recordAttempt / completeLesson / isUnlocked / nextLesson / dueItems / weakItems
// Whole signs (src/cv/signs.ts)
SIGNS[id] = { handshape, zone, movement, howTo, grading }; new SignChecker(SIGNS.HELLO).update(hand, pred, now)
  → { stage: "handshape"|"position"|"movement"|"done", message }

// Frontend → Backend
POST /api/path   { userName, learningFor, relationship, allowedWords[] } → { wordPack: string[], welcome }
POST /api/coach  { target, feedback[], snapshot? } → { tip: string }
POST /api/words  { knownLetters[], weakLetters[] } → { words: string[] }
```
The server returns mock data when GEMINI_API_KEY is missing, so the frontend never blocks on it.

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
- Unit 2 Alphabet by handshape family (flat · point · two/three fingers · fist · sideways), letters from
  Unit 1 skipped; "Spell <their name>" appears as soon as its letters are known; J/Z self-checked; checkpoint.
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
