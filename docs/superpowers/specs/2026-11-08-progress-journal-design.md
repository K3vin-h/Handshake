# Progress journal: design

Date: 2026-11-08. Owner: Group 2 (frontend screens). Status: approved in chat by the user after three rounds of mockups (`.superpowers/brainstorm/*/content/progress-journal-v2.html`).

## Intent
`#/progress` is bare today: a hero with three numbers, three side panels, and a collapsed letters table. Redesign it as an **open journal** that scrolls: each spread (two facing pages) is a different insight about the learner. The notebook nods to the film *A Silent Voice* (the wet notebook), in the theme's silent-voice homage. It is our own drawing; no film art, quotes or character names.

The point: make the learner's progress feel personal and insightful, so they want to open the next lesson.

## Goals
- One scrolling page of five spreads (below), all from data already on the device.
- Taller, roomier pages than the mockups (the user found them short): every page has a minimum height, generous line spacing and extra rows, never a cramped look.
- Dawn-light background (soft blue to peach) on this page, matching the reward screens. (Builder's call: the user approved it in the mockups.)
- Every number is also real text. Same honesty wording as the rest of the app.

## Non-goals
- No daily history or "over time" chart: the app stores totals, not tries by day, so it would be made up. Offered to the user as a possible later feature (a small on-device daily log); NOT part of this build.
- No server calls, no Gemini, no names sent anywhere. Everything reads `localStorage` through `loadProgress()` and `loadMistakes()`.
- No change to exports of `progress.ts` (shared file). No change to `mistakes.ts` (Ryan's).
- Anti-goals: a page that looks pretty but hides numbers from screen readers; colour as the only cue; wording like "correct".

## Spreads (top to bottom)
1. **Overview.** Left page: heading "N of M lessons done", progress bar, three stamps (day streak, XP, "matches the reference" %, or "No tries yet"), page log of finished lessons ("Page 1 · R A Y N"), next page blurred. Right page: ribbon bookmark, the A to Z boxes (done / unlocked / locked, same state logic as `#/alphabet`), "Practise next" link, smudged line for the weakest letter.
2. **How my tries went.** Bars per letter that has tries (matched of tries). Strongest letters, letters needing another go, mastered versus practising counts, a tip sticker ("1 away from mastered on B").
3. **My hands.** Five finger bars from `weakFingers` (differences per finger), a breakdown by type (curl, direction, placement), and a sticker naming the most frequent code and its letters.
4. **Review plan.** Letters due today (`dueItems`), coming up tomorrow / in 3 days / in a week, and the five spaced-practice boxes with counts (Leitner box 0 to 4 from `items[].box`).
5. **Every letter.** The full 26-letter table (status, tries, matched) set across two pages. Replaces the collapsed "Alphabet" table. Keeps the footnote: mastered means matching the reference 3 times in a row; reference-only letters have no pass or fail.

Page numbers sit in the bottom corners. Empty states are written in the journal's voice ("Nothing here yet. Practise a lesson and this page fills in.").

## Look
- Paper: ruled lines, spiral holes on the left page, inner-edge shadow at the spine, a book-edge shadow underneath, red ribbon on spread 1.
- Handwriting font for headings and notes (Caveat / Patrick Hand via Google Fonts, with `Bradley Hand`/`Segoe Print`/cursive fallback). Body numbers stay readable: handwriting only for headings, stamps and notes, never for the dense table text (table uses the app font).
- Water: a soft blue stain and faint ripple rings in corners. Smudged ink (slight blur) marks letters to practise again. The blur is decoration only; the same text is also written plainly in the page or its `aria-label`.
- Colours reuse existing tokens (`--match`, `--match-bg`, `--muted`, `--border`). No new colour carries meaning alone: done = green plus ✓, locked = dashed plus lock icon, weak = brown plus text "practise again".
- Phones: each spread stacks to one page, left then right, same order.

## Accessibility and motion
- Headings in order (page `h1` = lessons done; each spread a `h2`). Bars are `progressbar`/text, tables use `th scope`.
- All values appear as text. Decorative stains and ripples are `aria-hidden`.
- Contrast at least 4.5:1 for text on paper and on dawn light, checked with a real contrast checker before this is called done.
- Any entrance animation (pages fading up, bars filling) is skipped under `prefers-reduced-motion` and the in-app switch (`useReduceMotion`).

## Constraints and rules
- Wording: "matches the reference", never "correct".
- Stays inside Group 2 files: `frontend/src/screens/Progress.tsx`, new components in `frontend/src/components/journal/`, a pure data module, `styles.css`.
- Keep `npm run build` and `npm test` passing.

## Left to the builder
- Component split and class names; exact min-heights (aim for each page at least about 520px tall on wide screens); exact copy for empty states and tips.
- A pure module `frontend/src/screens/progressStats.ts` (no imports, `node --test` friendly) that turns progress and mistakes into the numbers above, with tests. The alphabet box states reuse `alphabetStates` from `alphabetState.ts`.

## Open question (not blocking)
- A daily practice log for a real "this week" page. Not approved; ask the user later.
