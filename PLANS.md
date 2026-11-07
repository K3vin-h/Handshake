> **Superseded** by `docs/superpowers/plans/` (starter + one plan per group). Kept below for reference only.

# Handshake implementation plans

Each plan is one Claude session in its own worktree: `claude --worktree <name>`, then paste the prompt.
Every session reads `CLAUDE.md` automatically. Run `#/curriculum` to see the generated lesson plan.

**Demo scope (must work on stage):** lessons 1.1–1.3, 2.1–2.3, 3.1–3.2, scene 4.1.
Everything else in `src/lib/curriculum.ts` is `stretch`: same engine, only polished if time allows.

| # | Plan | Owner | Worktree | Needs | Done by |
|---|---|---|---|---|---|
| 1 | Recognition tuning + training | Ryan | `cv` | — | H8 |
| 2 | Lesson player (letter steps) | Ryan | `player` | 1 started | H10 |
| 3 | Screens from Figma | Teammate A | `frontend` | — | H10 |
| 4 | Onboarding + Gemini personalization | Teammate B | `backend` | — | H8 |
| 5 | Whole signs (HELLO, MY, NAME) | Ryan | `signs` | 2 | H14 |
| 6 | Conversation scene 4.1 | Teammate A + B | `scene` | 2, 5 | H16 |
| 7 | Rigged 3D hand (stretch) | anyone free | `hand3d` | — | H16 or drop |
| 8 | Devpost, pitch, backup video | Teammate B | — | demo working | H21 |

Merge into main at every checkpoint. Nothing new after the H16 feature freeze.

---

## 1 · Recognition tuning + training (`cv`)
> Read CLAUDE.md. I own src/cv and training/. Goal: every handshape in `requiredHandshapes()` for the demo
> lessons (run #/curriculum with "Demo scope only") is recognized ≥85% of the time by someone not in the
> training data. Help me (a) record templates for those letters plus "5", B and H from 2+ people,
> (b) run training/ (extract_landmarks.py, train.py) and compare the MLP to kNN on a held-out person,
> (c) tune MAX_DISTANCE, hold time and VoteBuffer size using the LessonDemo debug panel. Report per-letter
> accuracy and which letters to keep out of the demo. Don't change interfaces in CLAUDE.md.

**Done when:** templates.json committed; report.txt shows per-letter accuracy; weak letters listed.

## 2 · Lesson player (`player`)
> Read CLAUDE.md, src/lib/curriculum.ts and src/lib/progress.ts. Build src/screens/LessonPlayer.tsx
> (route #/lesson/<id>) that plays one Lesson's steps in order: learn (3D hand + description, Continue),
> practice (sign the letter `reps` times in a row via Recognizer + VoteBuffer + HoldConfirm),
> contrast (prompt the look-alike letters in random order), spell (one letter at a time with a progress
> row, reference hidden when showReference is false), review (dueItems from progress.ts).
> Use candidatesFor(target, lesson letters) for recognition. On two misses call getCoachTip with
> getHandFeedback + snapshot. Record every attempt with recordAttempt; completeLesson at the end, then
> navigate to #/complete/<id>. Leave sign/sentence/scene steps as a "Coming soon" placeholder (plan 5).
> Reuse components/Camera and HandModel3D. Unstyled is fine: Teammate A styles it.

**Done when:** lessons 1.1–2.3 can be played start to finish with real recognition and saved progress.

## 3 · Screens from Figma (`frontend`)
> Read CLAUDE.md. I own src/screens (except RecordPage, LessonDemo, LessonPlayer) and src/components.
> Add Tailwind + shadcn/ui. Build from our Figma/canvas designs: Home path (#/), Unit complete with the
> shareable message card (#/complete/<lessonId>), Progress (#/progress). Data: buildCurriculum(personalization)
> from src/lib/curriculum.ts (personalization saved in localStorage by Onboarding) and loadProgress /
> isUnlocked / nextLesson / dueItems / weakItems from src/lib/progress.ts. Locked lessons show locked;
> stretch lessons can show a "Coming soon" badge. Message card: render the four letter tiles and text to a
> canvas and offer "Download card" as PNG. Then style LessonPlayer to match the Lesson design.
> Accessibility: real buttons/links, 4.5:1 contrast, visible focus, keyboard navigation.

**Done when:** onboarding → home → lesson → complete → progress clicks through with real data.

## 4 · Onboarding + Gemini personalization (`backend`)
> Read CLAUDE.md. I own server/, src/lib/api.ts and the onboarding screen. Build src/screens/Onboarding.tsx
> (route #/welcome, shown when no personalization is saved): your name, their name, relationship, dominant
> hand. On submit call personalizePath(userName, theirName, relationship, allowedWords) where allowedWords =
> every SIGNS id with a `packs` entry, save { userName, theirName, relationship, wordPack, leftHanded } to
> localStorage, show the welcome line, go to #/. Then: fetch getPracticeWords for each Unit 2 lesson using
> letters known by that point and store them as practiceWords. Test all three endpoints with the real key,
> pre-warm the cache for Ryan/Lily/coworker, and make sure every call has a non-Gemini fallback.

**Done when:** a new user goes through onboarding in under 30 s and their path shows their names.

## 5 · Whole signs (`signs`)
> Read CLAUDE.md and src/cv/signs.ts. In LessonPlayer, implement the `sign` and `sentence` steps using
> SignChecker: show the stage message ("Make the B handshape" → "move to your forehead" → "now move
> outward"), the 3D hand / reference, and a self-check button for signs with grading "self".
> A sentence = tokens in order: SIGNS ids use SignChecker, "fs:WORD" tokens fingerspell letter by letter.
> Add a zone calibration step (user touches forehead, chin, chest once) that updates ZONES, and a debug
> overlay showing the current zone and classified movement. Get HELLO, MY and NAME working reliably first.
> Ask me to verify each sign description against Lifeprint before marking it verified.

**Done when:** 3.1 and 3.2 play end to end; HELLO, MY, NAME pass ≥4 of 5 tries.

## 6 · Conversation scene (`scene`)
> Read CLAUDE.md, src/lib/curriculum.ts (scene steps) and our Conversation design. Implement the `scene`
> step in LessonPlayer: chat layout, Lily's line as gloss + English caption (+ reference clip slot), your
> reply as a row of token chips checked in order with the sentence logic from plan 5. Each finished turn
> adds a bubble. Self-graded tokens (NICE, MEET) get an "I signed it" button. Finish → message card.
> Optional: a "Lily" voice line with Gemini rewording her English caption naturally.

**Done when:** scene 4.1 runs on the demo laptop in under 90 seconds.

## 7 · Rigged 3D hand (`hand3d`, stretch)
> Read CLAUDE.md, especially "3D hand". Upgrade src/components/HandModel3D.tsx from the skeleton to a
> rigged glTF hand (three.js WebXR generic hand, or a CC-licensed hand I put in public/models/), posed from
> the 21 points of meanPose3D by rotating each bone's rest direction toward the next landmark with
> quaternion.setFromUnitVectors (try Kalidokit only if that fails). Keep the skeleton as the fallback when
> the model fails to load. Only touch HandModel3D.tsx and public/models/. Keep npm run build passing.

**Done when:** it looks right on 5 letters, or we drop it and keep the skeleton.

## 8 · Devpost, pitch, backup video
Problem statement, impact statement, accessibility notes, Gemini usage, "what's next" (more signs,
two-handed signs, SignGemma-style translation when available). Record the backup video at H20.
