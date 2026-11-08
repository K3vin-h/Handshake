# Progress Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `#/progress` as a scrolling open-journal page of five spreads of insights, all from on-device data.

**Architecture:** A pure stats module (`progressStats.ts`, no imports, `node --test`) turns `Progress` items and `Mistakes` into display numbers. Small presentational journal components (`components/journal/Journal.tsx`) draw pages, stamps, stickers and hand-drawn bars. `Progress.tsx` composes five spreads from the stats. Styling is appended to `styles.css`, unlayered, tokens reused.

**Tech Stack:** React 19, TypeScript, plain CSS, `node --test`, existing `vite` SSR test pattern (`frontend/tests/complete.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-08-progress-journal-design.md`. Mockup: `.superpowers/brainstorm/*/content/progress-journal-v2.html` (pages are to be built taller than shown).

## Global Constraints

- Wording: "matches the reference", never "correct".
- No server calls, no Gemini, no names leave the device. Read only `loadProgress()` and `loadMistakes()`.
- Do not change exports of `frontend/src/lib/progress.ts` or edit `frontend/src/lib/mistakes.ts`.
- Every value appears as real text; decorative stains and ripples are `aria-hidden`; no meaning by colour alone.
- Text contrast at least 4.5:1 (check with a real checker); entrance animation skipped under `prefers-reduced-motion` and `useReduceMotion()`.
- Each journal page has `min-height` of about 520px on wide screens; phones stack each spread left page then right page.
- Dawn-light background on this page via the existing `.reward-dawn` class.
- Keep `npm run build` and `npm test` passing. Commit only if the user has asked.

## Review Focus

- New learner, no tries, no mistakes: every spread shows a journal-voice empty state, no `NaN%`, no empty bars.
- Letter with `attempts` 0 in `items` (can exist): never divides by zero, never listed as strong or weak.
- Everything mastered: "Needs another go" and "Due today" show a calm message, not blank space.
- `due` timestamps already in the past or far future: land in the right bucket, never negative days.
- Mistake codes for letters that no longer exist or malformed keys: ignored, no crash.

---

### Task 1: Stats module

**Files:**
- Create: `frontend/src/screens/progressStats.ts`
- Test: `frontend/src/screens/progressStats.test.ts`

**Interfaces:**
- Produces (all pure, structural types, no imports):
  - `type Item = { streak: number; mastered: boolean; box: number; due: number; attempts: number; misses: number }`
  - `type Mistakes = Record<string, Partial<Record<string, { count: number; lastAt: number }>>>`
  - `letterBars(items: Record<string, Item>): { letter: string; attempts: number; matched: number; share: number }[]` (letters with `attempts > 0`, alphabetical)
  - `strongAndWeak(items): { strong: string[]; weak: string[] }` (strong: mastered or share >= 0.8 with >= 3 tries; weak: not mastered, share < 0.6 with >= 2 tries; weakest first, max 3 each)
  - `masteryCounts(items): { mastered: number; practising: number }` (practising = attempts > 0 and not mastered)
  - `almostThere(items): { letter: string; need: number } | null` (highest `streak` below 3, `need = 3 - streak`)
  - `fingerBars(m: Mistakes, fingers: string[]): { finger: string; count: number }[]` (all given fingers, zero-filled, input order)
  - `kindCounts(m): { curl: number; direction: number; placement: number }`
  - `topMistake(m): { finger: string; kind: string; count: number; letters: string[] } | null`
  - `boxCounts(items): number[]` (length 5, index = `box`)
  - `reviewPlan(items, now: number): { today: string[]; tomorrow: string[]; threeDays: string[]; week: string[] }` (only items with `attempts > 0`; `due <= now` goes in today; bucketed by whole days from `now`)

- [ ] **Step 1: Write the failing tests** in `progressStats.test.ts` covering: `letterBars` skips `attempts: 0` and computes `share` as `matched / attempts`; `strongAndWeak` on an empty object returns two empty arrays; `almostThere` returns `{ letter: "B", need: 1 }` for `{B: streak 2}` and `null` when all mastered or empty; `fingerBars` zero-fills all five fingers and ignores a malformed code like `"nonsense"`; `kindCounts` sums curl/direction/placement across letters; `topMistake` returns `{ finger: "index", kind: "curl", count: 4, letters: ["D","Y"] }` for that fixture and `null` for `{}`; `boxCounts` has length 5; `reviewPlan` puts a past `due` in `today` and a `due` 2 days out in `threeDays`.
- [ ] **Step 2: Run** `cd frontend && node --test src/screens/progressStats.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the functions above in `progressStats.ts` with the exact signatures. Guard every division on `attempts > 0`.
- [ ] **Step 4: Run** the same command. Expected: all pass.

### Task 2: Journal components and styles

**Files:**
- Create: `frontend/src/components/journal/Journal.tsx`
- Modify: `frontend/src/styles.css` (append a "Journal" block)

**Interfaces:**
- Produces (named exports, props typed):
  - `Spread({ children })`: the book container, `<section>`; wide screens two columns, phones one.
  - `Page({ side: "left" | "right"; label?: string; title?: string; number?: number; ribbon?: boolean; stain?: boolean; children })`: ruled paper; `title` renders an `h2` in the handwriting font; `number` is the corner page number; `ribbon` adds the bookmark (aria-hidden); `stain` adds stain and ripples (aria-hidden); left side adds spiral holes (aria-hidden).
  - `Stamp({ value: string | number; label: string })`
  - `Sticker({ children })`: yellow note.
  - `HandBar({ label: string; value: number; max: number; text: string; tone?: "good" | "warn" })`: row with label, bar (`role="progressbar"` with `aria-valuenow/max`, `aria-label`), and visible `text`.
  - `Ink({ tone: "good" | "smudge" | "plain"; children })`: handwriting span; `smudge` blurs visually but its text stays selectable and readable by screen readers.

- [ ] **Step 1: Add an SSR test** to a new `frontend/tests/journal.test.mjs` (same vite `ssrLoadModule` pattern as `complete.test.mjs`): render `Spread` with a left `Page` titled "Hello" and assert the markup contains an `<h2` with "Hello", that the ribbon, stain and holes elements carry `aria-hidden="true"`, and that `HandBar` renders `role="progressbar"`, the visible text and `aria-valuenow`.
- [ ] **Step 2: Run** `cd frontend && node --test tests/journal.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the components. Fonts: add `@import` for Caveat and Patrick Hand at the top of the journal CSS block with the cursive fallbacks from the spec; table and number text use the app font. Class names prefixed `jr-`. Paper `min-height` about 520px; spine and book-edge shadows as in the mockup; `@media (max-width: 760px)` stacks pages; `prefers-reduced-motion` and `[data-reduce-motion]` disable the fade-up and bar-fill animations.
- [ ] **Step 4: Run** the test and `cd frontend && npx tsc --noEmit`. Expected: pass, no type errors.

### Task 3: Spreads 1 and 2 (Overview, How my tries went)

**Files:**
- Modify: `frontend/src/screens/Progress.tsx` (rewrite the render; keep the data setup)

**Interfaces:**
- Consumes: Task 1 (`letterBars`, `strongAndWeak`, `masteryCounts`, `almostThere`), Task 2 components, `alphabetStates`/`ALPHABET` from `./alphabetState`, `isUnlocked`/`nextLesson` from `../lib/progress`.

- [ ] **Step 1: Extend `frontend/tests/journal.test.mjs`** (or add `progress.test.mjs`): render `ProgressScreen` with a saved profile and empty progress; assert the page has an `h1` "0 of N lessons done", contains "No tries yet", contains the journal-voice empty state for spread 2, contains no `NaN`, and has class `reward-dawn`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** the page wrapper `<div className="page progress-page reward-dawn">` with spread 1 (heading with `h1`, bar, three `Stamp`s, page log "Page n · letters" from completed lessons with `teaches`, a blurred next page, ribbon, A to Z boxes reusing the `.alpha-box` classes, "Practise next" link, smudged weakest-letter line) and spread 2 (per-letter `HandBar`s, strong/weak lists, mastery counts, `Sticker` tip from `almostThere`). Add extra rows/space so pages reach the min-height without looking empty.
- [ ] **Step 4: Run** `npm test` in `frontend/` and `npx tsc --noEmit`. Expected: pass.

### Task 4: Spreads 3 and 4 (My hands, Review plan)

**Files:**
- Modify: `frontend/src/screens/Progress.tsx`

**Interfaces:**
- Consumes: Task 1 (`fingerBars`, `kindCounts`, `topMistake`, `boxCounts`, `reviewPlan`), `loadMistakes` from `../lib/mistakes`.

- [ ] **Step 1: Extend the SSR test**: with fixture mistakes `{ D: {"index:curl": {count: 4, lastAt: 1}}, Y: {"index:curl": {count: 1, lastAt: 1}} }` assert the output contains "index" with 5 differences and the sticker text naming D and Y; with no mistakes assert the empty-state sentence; with an item due in the past assert it appears under "Due today".
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** spread 3 (five hand-drawn finger bars with visible counts, type breakdown as `HandBar`s, sticker from `topMistake`, footnote "How often the camera measured each finger away from the reference. Fewer is better.") and spread 4 (due-today letters, tomorrow / in 3 days / in a week, five box columns from `boxCounts`, one-line explanation of how letters move between boxes).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: pass.

### Task 5: Spread 5, cleanup and checks

**Files:**
- Modify: `frontend/src/screens/Progress.tsx`, `frontend/src/styles.css` (remove now-unused `.focus`/`.quiet-grid` Progress-only rules only if nothing else uses them; grep first)

- [ ] **Step 1: Extend the SSR test**: assert a `<table>` with `th scope="col"` headers, 26 rows, "Reference only" for J and Z, and the footnote "Mastered means matching the reference 3 times in a row".
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** spread 5: the table split across the left and right page (A to M, N to Z), status text with ✓ for mastered, no collapsed `<details>`. Remove unused imports left from the old page.
- [ ] **Step 4: Verify** in `frontend/`: `npm test`, `npx tsc --noEmit`, `npm run build`. Expected: all pass. Then run the app (`npm run dev` at repo root), set a profile and some progress, and look at `#/progress` at wide and phone width; check contrast with a real checker and keyboard focus order. Report what was and was not seen.
