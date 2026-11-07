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
