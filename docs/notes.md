# notes.md (Teammate B owns; every quote and source goes here as it happens)

## Interviews
Format: date | who (role only, e.g. "ASL learner", no real names unless they agree) | their words (exact) | which question

## Who we asked and couldn't reach
(e.g. "asked 3 organizers, nobody at the venue signs")

## Sources used
Title | author/org | date | what we cite it for

- 2026-11-07 (Jayden, with Claude): LessonPlayer review fixes, made with the owner's go-ahead. Skip no longer completes a lesson: any skipped step means the lesson ends on "Lesson not finished yet" (no XP, no unlock) and can be restarted. The previous match message is cleared on the next rep, and a miss that sends the learner back to the first try is announced. The 3D pose is memoised. Reference hand now uses one canvas per view (drei View froze views it judged off-screen).

- 2026-11-07 (Jayden, with Claude): second review round. `SceneView` gains two OPTIONAL props, `title` and `onSkip` (a scene can now be left; a skipped scene leaves the lesson unfinished, like any skip). `TokenRunner` gains optional `onEmpty` (a step with nothing the camera can check, e.g. a name of only J/Z, shows a message and Continue instead of a blank page; not counted as a pass) and names the moving letters it cannot check. `#/settings` is now routed and in the nav. `onMiss` is ignored while the hand rests between reps. Progress counts all four units like Home. Left for the team (decisions, not bugs): U/K/R, S/E/T/M/N, G/H/P/Q/X moved from stretch to demo; reps/checkpoint lowered against "mastery = 3 in a row"; the recall hint text comes from Gemini (/api/explain) against "landmarks are the truth, Gemini only rewords".

- 2026-11-07 (Jayden, with Claude): third review round + Levels deck. The first and last level cards now sit flush with the deck's edges (next/previous level peeking in) instead of leaving an empty gutter; middle cards stay centred. `TokenRunner.onEmpty` is now REQUIRED and LessonPlayer treats it as a skip (never a pass). Leaving a scene resets its turn; "Start again" rebuilds the step list (fresh order, no leftover "again" items); a "Which letter is this?" question with no recorded 3D pose is skipped with a message instead of showing a blank hand. `requireProfile` no longer changes the hash during render. RevealCard: only keyboard focus pins it open. CurriculumPreview has a "Use demo names" button (uses DEMO_PROFILE). STILL A TEAM DECISION (not changed): fewer reps/drills and a one-spell checkpoint versus "practise x3" and "mastery = 3 in a row" (curriculum.ts).
