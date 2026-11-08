# Frontend Polish and De-slop Implementation Plan

> **For agentic workers:** execute with superpowers:subagent-driven-development (recommended) or superpowers:executing-plans, task by task, in a worktree. Steps use `- [ ]` checkboxes. Per task: `/test` (TDD), then `/check` after each coherent unit, `/ship` only when asked. Load the named skills before touching UI: `frontend-design-direction`, `design-system`, `better-ui`, `animate` (read its `references/motion-react.md`), `frontend-a11y`, `dataviz` (when touching bars/charts).

**Goal:** Make the whole app read like a calm, high-traffic product site (Apple / Linear / Stripe restraint, Duolingo-style focused lessons): one page frame, one type scale, few surfaces, purposeful motion. Fix the reported problems. Remove every "looks AI-generated" tell, and add a test that keeps them out.
**Architecture:** Design tokens first (type, spacing, radius, elevation, easing, font), then a de-slop sweep guarded by a regression test, then the page frame and nav, then per-screen work, then a motion pass, then a rendered QA gate. No new runtime dependency except one self-hosted font package.
**Tech stack:** React 19, TypeScript, Vite 8, `motion/react` v14, plain CSS, `node --test` + `vite.ssrLoadModule` SSR tests.
**Spec:** none separate; decisions are below. No Codex review (your call).

## Context

**Base (done):** `feature/frontend-polish` = this branch + `origin/accounts` + `origin/main`, re-synced at `05af55a` (11 newer `main` commits, clean merge). Build passes, `npm test` = **126 pass / 0 fail** on the merged tree. Nothing pushed.

**What the latest `main` changed (and what it means for this plan):**
- **Nav (teammate rhgiang edited it twice).** `NAV` is now Home / Levels / Progress; **Settings sits at the right end** (`SETTINGS` const, rendered in `.nav-right`); the streak/XP chip is centered (`.nav-center`, now with a `gap`). The Dev tools menu moved **out of the nav** to a fixed bottom-left button (`.dev-corner`, rendered after `<main>` in `App.tsx`). Task 3 is adapted to this layout instead of the older one.
- **Gemini praise.** New `components/RewardLine.tsx` (live-region praise line after a confirmed match, `.reward-line` fades in with a 4px rise), `lib/praise.ts`, a `reward` prop on `LessonView`/`SceneView`, and a praise line on `Complete.tsx`. Motion-inventory row added; no design conflict.
- **Level deck.** `LevelDeck.tsx` dropped the 3D tilt: side cards now scale and fade via `useTransform` (gesture-driven, so it stays; nothing to do beyond the sweep).
- **Unchanged:** `Path.tsx` shortcut row, `Progress.tsx` journal, `LessonPlayer.tsx` notice blocks (line numbers shifted to ~175-193), all CSS slop counts (re-measured: 35 gradients, 14 infinite, 9 backdrop, 31 raw radii, 9 hover lifts; only line numbers moved).

**Your reported items, mapped to real code:**

| Your note | Where | State |
|---|---|---|
| Centering nav bar | `App.tsx` nav block, `styles.css:~165-182` | `main` now centers the **streak/XP chip** (a teammate's choice after two iterations); Home/Levels/Progress still sit left beside the brand. **Open question, decision 6.** |
| Nav bar aesthetic | same | Flat full-width white bar, inset underline on the active link. |
| "Progress tab" bare/cluttered | **Both** `screens/Path.tsx` (Levels page: your screenshot, 6-stat hero + shortcut row) and `screens/Progress.tsx` (10-page notebook, 5 spreads) | Both cluttered. |
| Remove Progress / Camera demo / Spell GARY / Names and hand | `Path.tsx:107-116` (`.shortcuts`) | Still there. |
| Font looks weird | `components/landing/path-hero.css:17-20` | `main` already dropped the serif; numerals are gold `#ffe9a6`, 13px labels. |
| Lesson not finished UI | `LessonPlayer.tsx:~175-193` | Logic present (`redoSkipped`, `startAgain`, `after`); markup is bare. |
| "Quite messy" overall | whole app | See the audit below. |
| Dead code | `components/Shell.tsx` + `.shell-*` CSS | Not imported anywhere: delete. |

**Out of scope:** new routes, backend, CV code, curriculum, Tailwind/shadcn migration, a rewrite of the journal's notebook concept, Figma.
**Ownership (CLAUDE.md):** all of this is Group 2 (`components/`, `screens/`, `styles.css`, `App.tsx`) except `LessonPlayer.tsx` (Group 1, Ryan: markup-only edit, tell them) and `components/journal/` + `Progress.tsx` (written by Jayden Park: tell them). CLAUDE.md's "1 font, 2 colours, 3 status colours" rule stays true.

## Research

### How big sites look and format (what we borrow)

Read live (this session): **motion.dev** (gestures, `layoutId` shared layout, springs, staggered hero, number switcher), **bklit.com** (spring bars, staggered entrance, light hover crosshair), **kokonutui.com** (single-file Motion components; much of the catalog is paid, so we borrow ideas only, install nothing). A web search on Apple/Stripe/Linear found: scroll motion should *demonstrate* the product, not decorate; Apple is full-bleed with minimal text; Linear's reading pages use one fixed column. **Duolingo returned no usable results**, so its lesson-screen patterns below are from my own knowledge, not research.

Patterns we adopt, all for this app's needs:
1. **One focal point per page**: a large display headline, one primary action, everything else subordinate (Apple, Stripe).
2. **Whitespace instead of boxes**: sections separated by space and a heading on the page background; cards only for repeating items. No card inside a card.
3. **One type scale and one font**, tight tracking on display sizes, tabular numerals for stats.
4. **One translucent sticky nav** with a centered segmented control and a sliding highlight (Apple, Linear).
5. **Focused lesson mode** (Duolingo): no site nav while in a lesson, thin progress at the top, one primary action at the bottom.
6. **Detail on demand**: heavy detail behind a disclosure (Stripe docs, Linear settings).
7. **Motion explains or confirms**, per the `animate` skill's gate: staged entrance only on rare moments, instant or ≤150 ms on frequent interactions, no decorative loops.

### What makes a site look AI-generated (what we remove)

Sources: [925studios, AI slop fonts and gradients](https://www.925studios.co/blog/ai-slop-design-tells) (read in full), [925studios, spotting generic sites](https://www.925studios.co/blog/ai-slop-web-design-guide), [Why every AI-built website looks the same (Tailwind indigo-500)](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500), [avoid-ai-design](https://github.com/funboy322/avoid-ai-design), [Braingrid](https://www.braingrid.ai/blog/design-system-optimized-for-ai-coding). Only the first was read in full; the rest are search snippets, and two fetches failed (HTTP 504 / 404). These are blog and vendor posts describing a shared perception, **not measured data**, and they overlap heavily. No single tell is decisive; four or five together read as "AI default".

| Tell | Our audit result (from the code) |
|---|---|
| **Unchosen Inter** | **Present.** `styles.css:14` `--font: Inter, system-ui…` with a comment saying Inter is used "when installed". That is the default-by-omission the sources describe. |
| **Purple/indigo or blue→purple gradients** | **Present.** Measured by dry-running the slop-test logic on the merged CSS: **35 gradient declarations** (linear + radial, outside the journal) and **3 violet colours**: `#7a62b8` (a real purple, `landing.css:47`), `#e2dcf5` (hue 254°, `landing.css:99`) and `#efeaf8` (hue 261°, `styles.css:830`). Also a `120deg #1d4468 → #3a6a8f → #b4466c` blue→magenta hero gradient and pink→blue `#fdf0f4 → #e4f0f8`. |
| **Decorative blobs / glows / auras** | **Present.** `.lp-aura` blurred orbs (`landing.css:11-12`), `.coach-glow` radial glows (`styles.css:357-358`), `.halo-rim` (`:651`), `--glow`, drifting sky/cloud layers (`:130-143`). |
| **Glass cards** | **Partly.** 9 `backdrop-filter` uses; only the nav needs one. |
| **Uniform radius and padding everywhere** | **Present.** Tokens exist (12/16/24/pill), but **31 declarations use raw px radii** and the same big radius sits on nearly every surface. |
| **Three rounded cards in a row, centered hero + one button** | **Check at render.** Home has a two-card row (`lp-duo`) and a level deck; Settings uses 18 `Card`s. Confirm in Task 0 screenshots. |
| **Decorative motion loops** | **Present.** **14 `infinite` animation declarations** (`styles.css:143, 214, 284, 285, 357, 358, 651, 754`; `landing.css:11, 12, 33, 84, 190, 203`): `cloud-drift 90s`, `bob 3s` on the current map node, `glow-pulse 2.4s`, blob/halo drifts, hero tile idle bob. Only `.auth-spinner` (`:747`) is functional. |
| **Hover lift on everything** | **Present.** 9 hover rules with `translateY(-…)` lifts. |
| **Animating `width`** | **Present.** 5 `transition: … width` declarations (`styles.css:481, 555, 560, 609, 795`). |
| **Vague, upbeat copy** | **Mild.** `lessonHeadline.ts` is hand-written but exclamation-heavy ("Time to learn the signs for your introduction!"). |
| Gradient headline text | Not found. |

What is already good and stays: tactile "lip" buttons (a deliberate, consistent project convention, Duolingo-like), status shapes plus text labels, a real concept (the learner's name as letter tiles), and the notebook journal (distinctive on purpose).

## Design direction (per `frontend-design-direction`)

- **Purpose:** a beginner learns ASL fingerspelling for one specific person, with live camera checks.
- **Audience:** hearing beginners with a Deaf friend, relative or coworker; reduced-vision and reduced-motion users must be first-class.
- **Tone:** *quiet editorial*. Calm, confident, high contrast, flat surfaces, one accent.
- **Memorable detail:** the learner's **name as letter tiles**. It is the identity and replaces gradients/blobs as the visual hook (already on Home; reuse on the Levels and Progress headers).
- **Palette (2 colours + 3 status, per CLAUDE.md):** keep river blue `--brand` and deep sakura `--brand-2` (sakura only for progress/mastered). Flat page background; **no gradients, no lavender**.
- **Font:** one deliberate font, **Atkinson Hyperlegible Next**, self-hosted via `@fontsource-variable/atkinson-hyperlegible-next` (v5.3.0, OFL-1.1, verified on npm). Reason: designed for legibility by the Braille Institute, so it directly backs the "Most Accessible Design" claim, and it is not the model default. Self-hosted from our own origin, so the "nothing leaves the device" privacy comment stays true. Fallback: `system-ui`.
- **Constraints:** React/Vite plain CSS, a11y (WCAG 2.2 AA, `prefers-reduced-motion` + in-app switch), `npm run build` stays green, JS/CSS budgets (app page < 300 kB JS gz).
- **Target viewports:** 390x844, 768x1024, 1440x900 (plus 320 for overflow).

### Evidence contract (the skill's finish gate)

Per screen: product surface, primary action, and the state table below. A state with no way to trigger it is "not applicable" with a reason; one that can't be tested here is "untested", not "n/a".

| Screen | Primary action | Loading | Empty | Error | Partial | Success | Permission |
|---|---|---|---|---|---|---|---|
| Home / Levels | Continue next lesson | n/a: all data is local | no profile → redirects to welcome | n/a | some lessons done | all done message | n/a |
| Progress | Practise next lesson | n/a | "Nothing here yet" blocks (exist) | n/a | some letters done | all lessons done | n/a |
| Lesson not finished | Redo skipped step | n/a | n/a | n/a | **this is the partial state** | n/a | n/a |
| Settings | Save names / hand | n/a | n/a | invalid name message (exists) | n/a | saved | camera link only |
| Camera/lesson | per lesson | model loading | no hand detected | model failed | n/a | match + confetti | **camera denied** (untested here) |

## Decisions that need your OK (defaults chosen so work can proceed)

1. **Remove the sky/cloud background layers and blobs** (identity change: "A Silent Voice" sky theme becomes a flat pale background). Default: remove.
2. **Atkinson Hyperlegible Next** as the single font. Default: yes.
3. **Hide the site nav on lesson routes** (focused lesson mode). Default: yes, if the lesson screen already has an exit link (Task 3 verifies).
4. **Camera demo link** moves to Settings. Default: yes.
5. **"Progress tab" = both** the Levels hero and the journal. Default: both.
6. **Nav centering.** `main` currently centers the streak/XP chip, and a teammate (rhgiang) iterated on it twice ("Levels and the chip centred together", then "Levels back beside Home and Progress; only the chip centred"). My default: the three **page links** become a centered segmented pill and the chip moves to the right zone (Apple/Linear pattern). If you meant "keep the chip centered", say so and Task 3 only restyles the bar. Tell rhgiang either way, since this overrides their last commit.

## Tokens (single source, used by every task)

CSS (`:root` in `styles.css`; values from the `animate` / `better-ui` skills, not approximated):
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--dur-press: 150ms; --dur-ui: 200ms; --dur-enter: 300ms;
--text-display: clamp(2.25rem, 1.4rem + 3.6vw, 3.5rem);
--text-h1: clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem);
--text-h2: 1.375rem; --text-body: 1.0625rem; --text-small: 0.875rem;
--section: clamp(40px, 6vw, 80px);
--shadow-card: 0 0 0 1px rgba(30,50,70,.06), 0 1px 2px rgba(30,50,70,.04), 0 8px 24px rgba(30,50,70,.06);
```
(`--space-7: 48px`, `--space-8: 64px` added; `--glow` deleted.) Global: `h1,h2,h3 { text-wrap: balance }`, `p { text-wrap: pretty }`, `html { -webkit-font-smoothing: antialiased }`, `font-variant-numeric: tabular-nums` on stats and counters.

Motion (`components/motion/tokens.ts`, new; reconcile names with the skill's `references/motion-react.md` before writing):
```ts
export const motionTokens = {
  duration: { instant: 0.1, fast: 0.15, normal: 0.2, enter: 0.3 },
  ease: { out: [0.23, 1, 0.32, 1], inOut: [0.77, 0, 0.175, 1], drawer: [0.32, 0.72, 0, 1] },
  distance: { enter: 12, blur: 4 },
  stagger: { list: 0.05, stage: 0.1 },
  press: 0.96,
} as const;
export const springs = {
  ui: { type: "spring", duration: 0.3, bounce: 0 },      // nav pill, small layout moves
  layout: { type: "spring", duration: 0.45, bounce: 0 },
  pop: { type: "spring", duration: 0.5, bounce: 0.2 },   // success moments only
} as const;
/** Staged entrance for RARE moments (hero, first load, success): opacity + 4px blur + 12px rise. Reduced motion → opacity only. */
export const enter = (index = 0, reduce = false) =>
  reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: motionTokens.duration.fast } }
    : {
        initial: { opacity: 0, filter: "blur(4px)", transform: "translateY(12px)" },
        animate: { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
        transition: { duration: motionTokens.duration.enter, ease: motionTokens.ease.out, delay: index * motionTokens.stagger.stage },
      };
```

## Motion inventory (the `animate` skill's gate: frequency tier + purpose, decided before code)

| Motion | Frequency | Purpose | Decision |
|---|---|---|---|
| Page change | tens/day | prevent a jarring swap | **Opacity only, 150 ms.** Remove the duplicate: `.page { animation: page-in … }` (`styles.css:~179`) AND `PageTransition` both animate today. |
| Nav highlight | tens/day | state indication | `layoutId` slide, `springs.ui`. Page links themselves get no hover motion beyond a ≤150 ms background fade. |
| Home hero + level deck | rare (visit) | explanation, first-impression | Staged `enter()`, 100 ms apart, once. Keep the existing hero tile spring (one orchestrated moment). Retune `RevealCard` (`0.6s`, `[0.4,0,0.2,1]`) to `enter` values. |
| Button press | many | feedback | Lip buttons keep their tactile press (project convention); all other buttons `scale(0.96)`, 150 ms, `--ease-out`, never when disabled. **Delete the 9 hover lifts** (they double up with the lip). Hover styles only inside `@media (hover: hover) and (pointer: fine)`. |
| Stats count-up on Levels | every visit | none (data the user reads) | **No animation.** (My earlier plan used `CountUp` here; the gate rejects it.) Keep `CountUp` only on the Complete screen (rare, celebration). |
| Progress bars (`.focus-bar span`, `.alpha-bar i` animate `width`) | on load | state indication | Switch to `transform: scaleX()` with `transform-origin: left`. `width` is a banned animated property. |
| Journal disclosure chevron | occasional | state indication | 200 ms `--ease-out` rotate. |
| Lesson notice | rare | state indication | `enter()` once. |
| Reward line after a match (`RewardLine`, `.reward-line`) | every match, many per lesson | feedback | Keep the text and the live region. Change `@keyframes reward-in` from a 320 ms rise (`translateY(4px)`) to **opacity only, `var(--dur-press)`** (frequent feedback stays near-imperceptible). The `(cached)` label stays. |
| Lesson complete confetti + sound | rare | delight | Keep (`celebrate.ts`; already reduced-motion aware). |
| `cloud-drift`, `bob`, `glow-pulse`, tile idle bob | constant | decoration | **Remove.** Fails the purpose test; infinite decorative loops are an AI tell. Only functional spinners may loop (marked `infinite-ok`). |

Reduced motion: `MotionProvider` already exposes `useReduceMotion()` and an in-app switch; every new animation uses it (opacity-only fallback, not zero).

## File Map

| File | Responsibility |
|---|---|
| `frontend/tests/slop.test.mjs` (new) | Regression test: bans the AI-tell patterns in CSS (see Task 1) |
| `frontend/tests/ssr.mjs` (new) | `withApp(fn)` helper: vite SSR server + `localStorage` stub (pattern from `tests/progress.test.mjs:8-14`) |
| `frontend/tests/polish.test.mjs` (new) | SSR tests for tokens, nav, Levels, Progress, notices |
| `frontend/package.json` | + `@fontsource-variable/atkinson-hyperlegible-next` |
| `frontend/src/main.tsx` | `import "@fontsource-variable/atkinson-hyperlegible-next"` |
| `frontend/src/styles.css` | Tokens, type scale, de-slop edits; nav block moves out |
| `frontend/src/components/motion/tokens.ts` (new) | Motion tokens above |
| `frontend/src/components/motion/PageTransition.tsx` | Opacity-only, token values |
| `frontend/src/components/TopNav.tsx` + `TopNav.css` (new) | Nav + `NAV`/`DEV_NAV`/`navActive` (moved from `App.tsx`) |
| `frontend/src/App.tsx` | Render `<TopNav>`; hide it on lesson routes; re-export `navActive`; **keep** the `.dev-corner` dev menu after `<main>` |
| `frontend/src/styles.css` (`@keyframes reward-in`) | Reward line becomes opacity-only (Task 7) |
| `frontend/src/components/landing/landing.css`, `path-hero.css`, `Hero.tsx`, `RevealCard.tsx`, `LevelsCard.tsx` | De-slop, flat hero, motion retune |
| `frontend/src/screens/Home.tsx`, `Path.tsx`, `Settings.tsx` | Page frame, Levels declutter, Camera link |
| `frontend/src/screens/Progress.tsx`, `components/journal/journal.css` | Fold detail spreads, bar transforms |
| `frontend/src/components/LessonNotice.tsx` + `LessonNotice.css` (new), `screens/LessonPlayer.tsx:~175-193` | Not-finished and resume cards |
| `frontend/src/components/lessonHeadline.ts` | Calmer copy |
| `frontend/src/components/Shell.tsx` | **Delete** |
| `docs/evidence/polish/report.json` + screenshots | Finish-gate evidence |

Co-located CSS (`TopNav.css`, `LessonNotice.css`) keeps parallel tasks from colliding in `styles.css`.

## Execution order

1. **Task 0** baseline + your decisions (sequential).
2. **Task 1** tokens, font, slop test written RED (sequential: everything depends on it).
3. **Task 2** de-slop sweep turns the slop test GREEN (sequential: touches shared CSS).
4. **Tasks 3, 4, 5, 6 in parallel** (disjoint files, see split).
5. **Task 7** motion pass and Home composition.
6. **Task 8** QA gate and reviews.
Branch `feature/frontend-polish` (PR repo: reviewed PR to `main`, never a direct push). `/check` after Task 2 and after Task 7.

## Task 0: Baseline and decisions

- [ ] `cd frontend && npm run build && npm test` → green (already verified once).
- [ ] `npm run dev`; save "before" screenshots (390, 768, 1440) of `#/` , `#/path`, `#/progress`, `#/settings`, a skipped lesson to `docs/evidence/polish/before/`. Playwright is not installed: use the `superset:browser` skill, or a throwaway `npx playwright install chromium` run outside `package.json`.
- [ ] Judge from the shots: three-card rows, card-in-card, centered-hero-plus-button. Add confirmed ones to Task 2's list.
- [ ] Get your answers on the five decisions above (defaults apply if you say nothing).

## Task 1: Tokens, font and the slop test (skills: `design-system`, `frontend-design-direction`, `animate`)

**Files:** Create `tests/ssr.mjs`, `tests/slop.test.mjs`, `tests/polish.test.mjs`, `components/motion/tokens.ts` · Modify `package.json`, `src/main.tsx`, `src/styles.css` (`:root`, base type rules)

- [ ] **Step 1: `tests/ssr.mjs`**
```js
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Run `fn(load, render, h)` against a vite SSR server with a stubbed localStorage (same approach as tests/progress.test.mjs). */
export async function withApp(fn, store = {}) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const saved = new Map(Object.entries({ "handshake.profile.v1": JSON.stringify({ userName: "Ryan", theirName: "Lily", leftHanded: false }), ...store }));
  const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) } });
  try {
    return await fn((p) => vite.ssrLoadModule(p), (el) => renderToStaticMarkup(el), createElement);
  } finally {
    if (prev) Object.defineProperty(globalThis, "localStorage", prev); else delete globalThis.localStorage;
    await vite.close();
  }
}
```
- [ ] **Step 2: `tests/slop.test.mjs`** (the "ensure none are present" guard). A line may opt out with a same-line marker comment (`gradient-ok`, `infinite-ok`, `glass-ok`) that must carry a reason.
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(SRC).filter((p) => p.endsWith(".css")).map((p) => ({ file: p.slice(SRC.length), lines: readFileSync(p, "utf8").split("\n") }));
const EXEMPT = new Set(["components/journal/journal.css"]); // hand-drawn notebook: ruled lines, hatching, irregular radii on purpose
const OK = /(gradient|infinite|glass)-ok/;
const find = (re, { exempt = true } = {}) =>
  files.flatMap(({ file, lines }) => (exempt && EXEMPT.has(file) ? [] : lines.flatMap((l, i) => (re.test(l) && !OK.test(l) ? [`${file}:${i + 1}  ${l.trim().slice(0, 90)}`] : []))));

function hue(hex) {
  const v = hex.length === 4 ? [...hex.slice(1)].map((c) => parseInt(c + c, 16)) : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = v.map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.04) return null; // grey
  const h = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return h < 0 ? h + 360 : h;
}

test("no gradients (flat surfaces)", () => assert.deepEqual(find(/(linear|radial|conic)-gradient\(/), []));
test("no violet/indigo colours (hue 245-320)", () => {
  const bad = files.flatMap(({ file, lines }) => lines.flatMap((l, i) => (l.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).filter((h) => { const x = hue(h); return x !== null && x >= 245 && x <= 320; }).map((h) => `${file}:${i + 1}  ${h}`)));
  assert.deepEqual(bad, []);
});
test("no decorative infinite animations", () => assert.deepEqual(find(/animation[^;]*infinite/), []));
test("no transition: all", () => assert.deepEqual(find(/transition(-property)?:\s*all\b/), []));
test("no animated width/height (use transform)", () => assert.deepEqual(find(/transition:[^;]*\b(width|height)\b/), []));
test("glass blur only on the nav (at most one use)", () => assert.ok(find(/backdrop-filter/).length <= 1, find(/backdrop-filter/).join("\n")));
test("radii come from tokens, not raw px", () => assert.deepEqual(find(/border-radius:[^;]*\d+px/), []));
test("no hover lift", () => assert.deepEqual(find(/:hover[^{]*\{[^}]*translateY\(-/), []));
test("font is chosen, not Inter by default", () => {
  const css = files.find((f) => f.file === "styles.css").lines.join("\n");
  assert.match(css, /--font:\s*"?Atkinson Hyperlegible Next/);
});
```
- [ ] **Step 3: `tests/polish.test.mjs`** (first test)
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withApp } from "./ssr.mjs";

test("motion tokens: no bounce on UI springs, press is 0.96, strong ease-out", () =>
  withApp(async (load) => {
    const { springs, motionTokens: t } = await load("/src/components/motion/tokens.ts");
    assert.equal(springs.ui.bounce, 0);
    assert.equal(springs.layout.bounce, 0);
    assert.equal(t.press, 0.96);
    assert.deepEqual(t.ease.out, [0.23, 1, 0.32, 1]);
  }));
```
- [ ] **Step 4:** `cd frontend && node --test tests/slop.test.mjs tests/polish.test.mjs` → FAIL (RED: many slop hits listed; tokens module missing).
- [ ] **Step 5:** `npm i @fontsource-variable/atkinson-hyperlegible-next` (confirm the exact subpath that exists in `node_modules` before importing; if the Next variable build is not exported, use `@fontsource/atkinson-hyperlegible-next` weights 400/700). Add the import to `main.tsx`. Set `--font: "Atkinson Hyperlegible Next Variable", "Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", sans-serif;` (match the family name the package's CSS declares) and rewrite the comment above it: "1 font, self-hosted (no request leaves our own origin)".
- [ ] **Step 6:** Create `tokens.ts` (code above). Add the CSS tokens and base type rules to `:root`/base. Apply `--text-*` to `h1/h2` and `.page`/section rhythm (`--section`).
- [ ] **Step 7:** `node src/styles.contrast.mjs` (existing) → no regressions; `node --test tests/polish.test.mjs` → tokens test PASS (slop tests stay RED until Task 2).
- [ ] **Step 8:** commit `feat: design tokens, self-hosted font, slop regression test` (git-manager).

## Task 2: De-slop sweep (skills: `design-system` slop-check, `better-ui`)

**Files:** Modify `src/styles.css`, `components/landing/landing.css`, `components/landing/path-hero.css`, `components/motion/motion.css`, `components/landing/*.tsx` if they reference removed classes · Delete `components/Shell.tsx` and `.shell-*` rules

Work from the slop test's own failure list (`node --test tests/slop.test.mjs`), file by file:
- [ ] **Gradients → flat.** Replace each of the 35 gradient declarations (linear + radial) with a solid token (`--card`, `--tint`, `--raised`, `--brand`). The `120deg #1d4468→#3a6a8f→#b4466c` hero becomes solid `--brand-deep`/`--brand` with white text (check contrast with `styles.contrast.mjs`). Lavender and purple (`#e2dcf5`, `#efeaf8`, `#7a62b8`) become `--raised` or a brand token. The 2 `repeating-linear-gradient` hatch patterns (locked-state stripes) are functional (shape, not colour alone): keep them and mark the line `/* gradient-ok: locked-state hatch, not colour alone */`.
- [ ] **Width transitions (5 lines).** `styles.css:481, 555, 560, 609, 795` → `transform: scaleX()` (details in the "`width` transitions" step below).
- [ ] **Blobs/glows.** Delete `.lp-aura`, `.coach-glow`, `.halo-rim` (and any JSX that renders them; `grep -rn "lp-aura\|coach-glow\|halo-rim" src`), `--glow`, and the sky/cloud `body::before/::after` layers (`styles.css:~124-143`), leaving `body { background: var(--bg); }`. Keep `body:has(.reward-dawn)` rules only if they still make sense with a flat bg (journal page theme).
- [ ] **Infinite loops (14 declarations).** Delete `cloud-drift`, `bob`, `glow-pulse`, the blob/halo drifts and the hero tile idle bob. Keep `.auth-spinner` (`styles.css:754`) and mark its line `/* infinite-ok: functional spinner */`.
- [ ] **Glass.** Keep one `backdrop-filter` (the nav, moved in Task 3); remove the other eight or mark `glass-ok` with a reason if one is functional (e.g., a camera overlay).
- [ ] **Radii (31 declarations).** Replace raw px radii with `--radius-sm/md/lg/pill` (nearest token).
- [ ] **Hover lifts.** Delete the 9 `translateY(-…)` hover rules. Wrap remaining hover styles in `@media (hover: hover) and (pointer: fine)`.
- [ ] **`width` transitions.** `.focus-bar span` (`styles.css:~555`) and `.alpha-bar i` (`:~795`): switch to `transform: scaleX(var(--p))` with `transform-origin: left`; update the JSX that sets `style={{ width: "NN%" }}` to `style={{ "--p": NN/100 }}` (in `Progress.tsx`, `Complete.tsx` or wherever `grep -rn "focus-bar\|alpha-bar" src` shows). Keep the `role="progressbar"` attributes unchanged.
- [ ] **Surfaces.** Replace border-plus-heavy-shadow cards with `--shadow-card` and a `border: 1px solid transparent` (forced-colors safe). Keep real borders on inputs, table cells, dividers.
- [ ] **Shell.** `grep -rn "Shell" src tests` shows only `Shell.tsx` and CSS → `git rm src/components/Shell.tsx`, delete the `.shell-*` rules.
- [ ] **Run:** `node --test tests/slop.test.mjs` → all PASS; `npm run build && npm test` → green; `node src/styles.contrast.mjs` → pass. Eyeball `#/`, `#/path`, `#/progress` for broken layout from removed layers.
- [ ] **Commit:** `refactor(style): remove gradients, glows, loops; flat surfaces` (git-manager). Then `/check`.

## Task 3: Page frame, nav, lesson focus mode (skills: `frontend-design-direction`, `better-ui`, `animate`, `frontend-a11y`)

**Files:** Create `components/TopNav.tsx`, `components/TopNav.css` · Modify `App.tsx`, `components/motion/PageTransition.tsx`, `styles.css` (delete the nav block `:165-180` and `.page` `page-in` animation) · Test `tests/polish.test.mjs`

Design: three zones keep equal side columns. **Left** brand. **Center** the three page links (Home, Levels, Progress) in a segmented pill (`.nav-links`, `--raised` track) with a white highlight that slides via `layoutId="nav-pill"` and `springs.ui`. **Right** streak/XP chip, account chip, reduce-motion toggle and the Settings link (as on `main`; the dev menu stays where `main` put it, outside the nav). Translucent bar (`backdrop-filter: saturate(180%) blur(20px)`, hairline bottom border, this is the one allowed glass). Phones (<820px): row 1 brand + right zone, row 2 links centered. Hit targets 44px.

- [ ] **Step 1: failing tests**
```js
test("nav: links in the centre zone, active one marked, chip on the right", () =>
  withApp(async (load, render, h) => {
    const { TopNav } = await load("/src/components/TopNav.tsx");
    const html = render(h(TopNav, { hash: "#/progress" }));
    assert.equal((html.match(/<nav /g) ?? []).length, 1);
    assert.match(html, /nav-center.*nav-links.*href="#\/progress"[^>]*aria-current="page"/s);
    assert.doesNotMatch(html.split("nav-center")[0], /href="#\/path"/);
    assert.match(html, /nav-right.*(day|XP).*href="#\/settings"/s);
    assert.doesNotMatch(html, /dev-corner|Dev tools/); // the dev menu lives outside the nav
  }));
test("lesson routes hide the site nav", () =>
  withApp(async (load) => {
    const { showNav } = await load("/src/components/TopNav.tsx");
    assert.equal(showNav("#/lesson/1.1"), false);
    assert.equal(showNav("#/path"), true);
  }));
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: `TopNav.tsx`.** Move `NAV` (Home, Levels, Progress), `SETTINGS`, `LEVEL_PAGES`, `navActive` verbatim from `App.tsx` (keep names/exports). **Leave `DEV_NAV` and the `.dev-corner` `<details>` in `App.tsx`**: `main` moved the dev menu out of the nav to a fixed bottom-left button; do not move it back. Add `export const showNav = (hash: string) => hash.split("/")[1] !== "lesson";`. Component:
```tsx
import { motion } from "motion/react";
import "./TopNav.css";
import { StreakXpChip } from "./StreakXpChip";
import { AccountChip } from "./AccountChip";
import { ReduceMotionToggle } from "./motion/MotionProvider";
import { springs } from "./motion/tokens";
import { loadProfile } from "../lib/profile";
import { loadProgress } from "../lib/progress";
// NAV, SETTINGS, LEVEL_PAGES, navActive, showNav: moved here

export function TopNav({ hash }: { hash: string }) {
  const progress = loadProgress();
  return (
    <nav aria-label="Main" className="top-nav">
      <div className="nav-left"><a className="brand" href="#/">Handshake</a></div>
      <div className="nav-center">
        <div className="nav-links">
          {NAV.map(([href, label]) => {
            const on = navActive(href, hash);
            return (
              <a key={href} href={href} aria-current={on ? "page" : undefined}>
                {on && <motion.span layoutId="nav-pill" className="nav-pill" transition={springs.ui} aria-hidden="true" />}
                {label}
              </a>
            );
          })}
        </div>
      </div>
      <div className="nav-right">
        {loadProfile() && <StreakXpChip streakDays={progress.streakDays} xp={progress.xp} />}
        <AccountChip />
        <ReduceMotionToggle />
        <a href={SETTINGS[0]} aria-current={navActive(SETTINGS[0], hash) ? "page" : undefined}>{SETTINGS[1]}</a>
      </div>
    </nav>
  );
}
```
- [ ] **Step 4: `TopNav.css`**
```css
nav.top-nav { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-5); background: rgba(255,255,255,.72); backdrop-filter: saturate(180%) blur(20px); /* glass-ok: the one nav */ border-bottom: 1px solid rgba(30,50,70,.08); }
.nav-left, .nav-right { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.nav-right { justify-content: flex-end; }
.nav-center { display: flex; justify-content: center; }
.nav-links { display: inline-flex; gap: 2px; padding: 4px; border-radius: var(--radius-pill); background: var(--raised); }
.nav-links a { position: relative; isolation: isolate; display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-pill); color: var(--muted); font-weight: 700; text-decoration: none; transition: color var(--dur-press) var(--ease-out); }
.nav-links a[aria-current="page"] { color: var(--text); }
.nav-pill { position: absolute; inset: 0; z-index: -1; border-radius: var(--radius-pill); background: #fff; box-shadow: 0 1px 2px rgba(30,50,70,.10), 0 4px 12px rgba(30,50,70,.06); border: 1px solid transparent; }
@media (hover: hover) and (pointer: fine) { .nav-links a:hover { color: var(--text); } }
@media (max-width: 820px) { nav.top-nav { grid-template-columns: 1fr auto; grid-template-areas: "l r" "c c"; } .nav-left { grid-area: l; } .nav-right { grid-area: r; } .nav-center { grid-area: c; } }
@media (max-width: 600px) { nav.top-nav { position: static; padding: var(--space-2) var(--space-3); } }
```
  Delete the old `nav`, `nav a`, `nav.top-nav`, `.nav-center` (with its new `gap`) and `.nav-chips` rules in `styles.css:~165-182`; **keep the `.dev-corner` rules** (`main` added them for the bottom-left dev button; its `opacity 120ms` hover transition is within the ≤150 ms budget) (they would fight this file) and the `.page { animation: page-in … }` + `@keyframes page-in`.
- [ ] **Step 5: `App.tsx`.** Render `{showNav(hash) && <TopNav hash={hash} />}` in place of the inline `<nav>`; `export { navActive } from "./components/TopNav";` so existing imports keep working; remove now-unused imports (`StreakXpChip`, `AccountChip`, `ReduceMotionToggle`, `loadProgress`, `loadProfile` only if nothing else in `App.tsx` uses them); keep the `import.meta.env.DEV && <details className="dev-menu dev-corner">` block after `<main>` exactly as on `main`. **Verify the lesson screen has an exit affordance** (`grep -n "href=\"#/\|Back\|Exit" src/components/LessonView.tsx`); if not, add a plain "Back to your path" link in `LessonView` (presentational; coordinate with Ryan). Skip link and `<main id="main">` stay.
- [ ] **Step 6: `PageTransition.tsx`.** Opacity only, `duration: motionTokens.duration.fast`, `ease: motionTokens.ease.out`, no `y`.
- [ ] **Step 7:** tests PASS; `node --test tests/slop.test.mjs` still PASS (only one backdrop-filter); `npm run build`.
- [ ] **Step 8:** commit `feat(nav): centered segmented nav, lesson focus mode`.

## Task 4: Levels page declutter (skills: `frontend-design-direction`, `better-ui`)

**Files:** Modify `screens/Path.tsx`, `components/landing/path-hero.css`, `screens/Settings.tsx` · Test `tests/polish.test.mjs`

Layout (big-site rule: one focal point): the hero is a **flat** panel with the lesson headline in `--text-display`, the "Up next" line, one **Continue** button, and **three** stats (streak, XP, lessons done) in a single quiet row (numerals white, `tabular-nums`, labels `--text-small`; no count-up per the motion inventory). Below: the legend, then the unit sections on the page background (no card around them).

- [ ] **Step 1: failing tests**
```js
test("levels: no shortcut row, exactly three hero stats, no count-up markup", () =>
  withApp(async (load, render, h) => {
    const { PathPage } = await load("/src/screens/Path.tsx");
    const html = render(h(PathPage));
    assert.doesNotMatch(html, /aria-label="Shortcuts"|Camera demo|Names and hand/);
    assert.equal((html.match(/<dt>/g) ?? []).length, 3);
    assert.match(html, /XP earned/); assert.match(html, /lessons done/);
  }));
test("settings links to the camera demo", () =>
  withApp(async (load, render, h) => {
    const { Settings } = await load("/src/screens/Settings.tsx");
    assert.match(render(h(Settings)), /href="#\/camera-demo"/);
  }));
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: `Path.tsx`.** Delete the `<ul className="shortcuts …">` block (`:107-116`) and `spellThem`/`spellOpen` (+ comment). Cut `stats` to streak / XP earned / lessons done; delete now-unused `nameLetters`, `yourLetters`, `theirLetters`, `nameSet`, `tries`, `misses` (let `npx tsc -b` list them; keep `dueSet`, still used). Remove the `.shortcuts` CSS in `styles.css`.
- [ ] **Step 4: `Settings.tsx`.** After the "Motion" card add a "Camera" card: one sentence ("Try the camera on any letter, outside a lesson.") + `<a href="#/camera-demo">Open the camera demo</a>`. "Names and hand" already exists here. Spell-the-name stays in the level deck. Also review the 18 `Card`s for card-in-card nesting; flatten any nested one.
- [ ] **Step 5: `path-hero.css`.** Flat `--brand-deep` panel (no gradient); `.hero-stats { grid-template-columns: repeat(3, minmax(0,1fr)); }`; `dd { font-size: var(--text-h1); font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; line-height: 1; }`; `dt { font-size: var(--text-small); opacity: .85; }`. Check contrast.
- [ ] **Step 6:** tests PASS; `npx tsc -b` clean; `grep -rn "shortcuts" src | wc -l` → 0.
- [ ] **Step 7:** commit `refactor(levels): remove shortcut row, three hero stats, flat hero`.

## Task 5: Progress journal declutter (skills: `design-system`, `dataviz`, `better-ui`)

**Files:** Modify `screens/Progress.tsx` (`:166-282`), `components/journal/journal.css` · Test `tests/polish.test.mjs` (+ existing `tests/progress.test.mjs` must stay green)

Keep the notebook look (Jayden's). Above the fold: Spread 1 (lessons done, bar, 3 stamps, page log) and Spread 2 (alphabet grid, next lesson), then Spread 3 ("How my tries went"). Fold Spreads 4-5 (fingers/kinds, due today/boxes, full table) into **one** closed `<details className="jr-more">`. `HandBar` fills already animate via CSS `jr-fill`; keep (and confirm it uses `transform`, not `width`; if it animates `width`, switch to `scaleX`). Bars and the review boxes are charts: per `dataviz`, colour never carries meaning alone (labels and values stay), and axis/legend text stays visible.

- [ ] **Step 1:** `grep -n "Due today\|review boxes\|full table\|Which finger" tests/progress.test.mjs` to see what the existing test asserts inside Spreads 4-5 (`<details>` content is still in SSR markup, so it should still pass).
- [ ] **Step 2: failing test**
```js
test("progress: detail spreads sit inside one closed disclosure", () =>
  withApp(async (load, render, h) => {
    const { ProgressScreen } = await load("/src/screens/Progress.tsx");
    const html = render(h(ProgressScreen));
    assert.equal((html.match(/<details[^>]*jr-more/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<details[^>]*jr-more[^>]*\sopen/);
    assert.match(html.split("jr-more")[0], /Your alphabet/);
    assert.match(html.split("jr-more")[1], /Due today/);
  }));
```
- [ ] **Step 3:** run → FAIL.
- [ ] **Step 4:** wrap the last two `<Spread>` groups in `<details className="jr-more"><summary>More detail: fingers, review plan, every letter</summary>…</details>`. No variable changes.
- [ ] **Step 5: `journal.css`**
```css
.jr-more > summary { display: flex; align-items: center; min-height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-md); font-weight: 700; cursor: pointer; list-style: none; }
.jr-more > summary::after { content: "▾"; margin-left: auto; transition: transform var(--dur-ui) var(--ease-out); }
.jr-more[open] > summary::after { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .jr-more > summary::after { transition: none; } }
```
- [ ] **Step 6:** `node --test tests/polish.test.mjs tests/progress.test.mjs` → PASS.
- [ ] **Step 7:** commit `refactor(progress): fold detail spreads into one disclosure`; tell Jayden.

## Task 6: Lesson notices (skills: `better-ui`, `frontend-a11y`, `animate`)

**Files:** Create `components/LessonNotice.tsx`, `components/LessonNotice.css` · Modify `screens/LessonPlayer.tsx:~175-193` · Test `tests/polish.test.mjs`

Two bare screens ("Lesson not finished yet" and "Pick up where you left off") become one centered surface: 28px title, 17px body, one primary button, one secondary, then plain links; message in `role="status"`; heading receives focus; `enter()` once (rare moment, staged).

- [ ] **Step 1: failing test**
```js
test("lesson notice: heading, status message, one primary action", () =>
  withApp(async (load, render, h) => {
    const { LessonNotice } = await load("/src/components/LessonNotice.tsx");
    const html = render(h(LessonNotice, {
      title: "Lesson not finished yet", message: "You skipped 1 step.",
      primary: { label: "Redo the skipped step", onClick() {} },
      secondary: { label: "Start the whole lesson over", onClick() {} },
      links: [{ href: "#/", label: "Back to your path" }], footnote: "Stays partly filled.",
    }));
    assert.match(html, /<h1[^>]*tabindex="-1"[^>]*>Lesson not finished yet/);
    assert.match(html, /role="status"[^>]*>You skipped 1 step\./);
    assert.equal((html.match(/notice-primary/g) ?? []).length, 1);
    assert.match(html, /href="#\/">Back to your path/);
  }));
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: `LessonNotice.tsx`**
```tsx
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import "./LessonNotice.css";
import { enter } from "./motion/tokens";
import { useReduceMotion } from "./motion/MotionProvider";

type Action = { label: string; onClick(): void };
export type LessonNoticeProps = {
  title: string; message: string; primary: Action; secondary?: Action;
  links?: { href: string; label: string }[]; footnote?: string;
};

export function LessonNotice({ title, message, primary, secondary, links = [], footnote }: LessonNoticeProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReduceMotion();
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="page">
      <motion.section className="notice" {...enter(0, reduce)} aria-labelledby="notice-title">
        <h1 id="notice-title" ref={heading} tabIndex={-1}>{title}</h1>
        <p role="status">{message}</p>
        <div className="notice-actions">
          <button type="button" className="notice-primary" onClick={primary.onClick}>{primary.label}</button>
          {secondary && <button type="button" className="notice-secondary" onClick={secondary.onClick}>{secondary.label}</button>}
        </div>
        {links.length > 0 && <p className="notice-links">{links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</p>}
        {footnote && <p className="muted small">{footnote}</p>}
      </motion.section>
    </div>
  );
}
```
- [ ] **Step 4: `LessonNotice.css`**
```css
.notice { max-width: 560px; margin: var(--space-7) auto; padding: var(--space-6); text-align: center; background: var(--card); border: 1px solid transparent; border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
.notice h1 { margin: 0 0 var(--space-3); font-size: 1.75rem; letter-spacing: -0.02em; }
.notice p { font-size: var(--text-body); line-height: 1.5; }
.notice-actions { display: grid; gap: var(--space-2); margin: var(--space-5) 0 var(--space-4); }
.notice-actions button { min-height: 52px; font-size: var(--text-body); transition: scale var(--dur-press) var(--ease-out); }
.notice-actions button:not(:disabled):active { scale: 0.96; }
.notice-secondary { background: transparent; color: var(--text); border: 2px solid var(--border-strong); border-bottom-width: 2px; }
.notice-links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2) var(--space-4); }
@media (prefers-reduced-motion: reduce) { .notice-actions button { transition: none; } }
```
- [ ] **Step 5: `LessonPlayer.tsx`.** **First read the `if (incomplete)` and `if (resume)` blocks (~175-193) and copy the exact current message strings** (line 177 is truncated in my notes; no copy changes). Replace the `incomplete` block with `<LessonNotice title="Lesson not finished yet" message={…existing text…} primary={{ label: \`Redo the skipped ${n === 1 ? "step" : "steps"}\`, onClick: redoSkipped }} secondary={{ label: "Start the whole lesson over", onClick: startAgain }} links={[...(after ? [{ href: \`#/lesson/${after.id}\`, label: \`Go on to ${after.id} ${after.title}\` }] : []), { href: "#/", label: "Back to your path" }]} footnote={after ? "This lesson stays partly filled on your path until the skipped steps are matched." : undefined} />` where `n = skipped.current.size`. Replace the `resume` block the same way (primary `Continue (N left)` → `restart(resume)`, secondary "Start the whole lesson over", link "Back to your path"). Logic, state and handlers untouched.
- [ ] **Step 6:** polish tests + `npm test` → PASS (`tests/complete.test.mjs` stays green).
- [ ] **Step 7:** commit `feat(lesson): clearer lesson-not-finished and resume cards`; tell Ryan.

## Parallel agent split (after Task 2)

| Agent (sonnet) | Task | Exclusive files | Verify |
|---|---|---|---|
| A | 3 Nav + frame | `TopNav.tsx/.css`, `App.tsx`, `PageTransition.tsx`, nav block + `page-in` in `styles.css` | `node --test tests/polish.test.mjs tests/slop.test.mjs` |
| B | 4 Levels | `Path.tsx`, `path-hero.css`, `Settings.tsx`, `.shortcuts` rules | same |
| C | 5 Progress | `Progress.tsx`, `journal.css` | `node --test tests/polish.test.mjs tests/progress.test.mjs` |
| D | 6 Notices | `LessonNotice.tsx/.css`, `LessonPlayer.tsx` | same |

`tests/polish.test.mjs` is shared: each agent only **appends** its own `test(...)`. `styles.css` edits are limited to the lines named above; on conflict keep both sides.

## Task 7: Motion pass and Home composition (skills: `animate`, `better-ui`, `frontend-design-direction`)

**Files:** Modify `components/landing/Hero.tsx`, `RevealCard.tsx`, `LevelsCard.tsx`, `StatusPanel.tsx`, `landing.css`, `screens/Home.tsx`, `lessonHeadline.ts`

- [ ] **Home composition (page-frame rules):** one column; Hero (display headline, name tiles, one Continue) → one "Up next" strip → level deck on the page background. Two things side by side only at ≥1024px. No card inside a card. Decide the exact order from the Task 0 screenshots; do not add sections.
- [ ] **Hero.** Keep the tile spring-in (the one orchestrated moment); remove the idle bob. Headline/kicker/CTA enter with `enter(i, reduce)` at 100 ms steps, once.
- [ ] **RevealCard.** Replace `0.6s`, `[0.4,0,0.2,1]` with `motionTokens.duration.enter` / `ease.out`, 12px rise, once (`viewport={{ once: true }}`), opacity-only under reduced motion.
- [ ] **StatusPanel rings.** Rings are data viz: draw-in once (`pathLength`, `springs.layout`), no hover lighting of other rings beyond the existing text-row focus link; keep the text equivalents.
- [ ] **Buttons.** Non-lip buttons: `transition: scale var(--dur-press) var(--ease-out)`, `:not(:disabled):active { scale: .96 }`; hover rules only inside `@media (hover: hover) and (pointer: fine)`.
- [ ] **Copy.** Rewrite `lessonHeadline.ts` strings to calm, specific sentences without exclamation marks (e.g. "Learn the signs for your introduction"). `grep -rn "lessonHeadline\|Time to learn" src tests` first; update any test that pins the old strings and say so in the commit.
- [ ] **Test (append):** `lessonHeadline` returns no "!" for every lesson id used in the curriculum.
- [ ] **Verify:** slop test PASS, `npm test` green, motion feel-check at 2–5x duration in the DevTools animation panel (a human step; I cannot judge feel from code).
- [ ] **Commit:** `feat(home): calm composition, token-based motion`. Then `/check`.

## Task 8: Rendered QA gate and reviews (skills: `frontend-design-direction` finish gate, `e2e-testing`, `frontend-a11y`)

- [ ] `cd frontend && npx tsc -b && npm run build && cd .. && npm test` → green; `node frontend/src/styles.contrast.mjs` → pass.
- [ ] **Screenshots** at 320 / 390 / 768 / 1024 / 1440 for `#/`, `#/path`, `#/progress`, `#/settings`, the lesson-not-finished card, a lesson (nav hidden): `docs/evidence/polish/after/`. Check: nav links centered at ≥821px, no horizontal scroll at 320, long names wrap, no card-in-card.
- [ ] **Keyboard/a11y:** Tab order brand → links → chips; visible focus; `<summary>` toggles with Enter/Space; focus lands on the notice heading; 44px targets; axe pass if available.
- [ ] **Reduced motion:** flip the in-app switch and the OS setting. The nav pill, hero stagger, reveals and notice entrance must degrade to opacity or nothing.
- [ ] **Evidence record.** Write `docs/evidence/polish/report.json` with `contract`, `targetViewports: ["390x844","768x1024","1440x900"]`, `accessibility`, `responsive`, the six `contentStates` (from the table above, with reasons for n/a), and `renderedEvidence` (relative artifact paths + observations), then run `node ~/.claude/skills/frontend-design-direction/scripts/check-evidence.js docs/evidence/polish/report.json` (script exists at that path). Camera-permission-denied is **untested** here; record it as such.
- [ ] **Perf:** `performance-optimizer` checks the font (preload only the latin variable file; `font-display: swap`), bundle size (`motion` already a dependency), and CLS from the swapped font.
- [ ] **Reviewers in parallel:** `react-reviewer`, `typescript-reviewer`, `code-reviewer` (WCAG 2.2), `performance-optimizer`, plus the `better-ui` review table run on the diff. No `security-reviewer`: no auth, input or data changes.
- [ ] **Update docs:** CLAUDE.md Stack/Design notes mention the self-hosted font and "no gradients, no decorative loops, `tests/slop.test.mjs`" (docs edit; Group 2).

## Verification

```bash
cd frontend && npx tsc -b && npm run build                    # types + build
cd .. && npm test                                              # 126 existing + new tests, 0 fail
node --test frontend/tests/slop.test.mjs                       # AI-tell regression guard
node frontend/src/styles.contrast.mjs                          # text >= 4.5:1
grep -rn "shortcuts\|Shell\|lp-aura\|coach-glow\|halo-rim" frontend/src | wc -l   # -> 0
node ~/.claude/skills/frontend-design-direction/scripts/check-evidence.js docs/evidence/polish/report.json
```
Coverage map: nav centered + aesthetic → T3; Levels/"Progress" clutter → T4, T5; shortcut row → T4; font → T1 (chosen font) and T4 (hero numerals); lesson-not-finished → T6; "messy overall" → page-frame rules (Research, T3, T7) + T2; big-site animation → motion inventory, T3, T7; AI-look research and removal → Research table, T1 slop test, T2 sweep, T7 copy; skills used → named per task.

## Honest limits
- I have read the code and the CSS greps but **not seen any page rendered**. "Messy", "cluttered" and the three-cards/card-in-card checks are unconfirmed until Task 0's screenshots exist.
- The AI-tell research is blog and vendor content (one article read in full, others as snippets, two fetches failed). It is a shared perception, not measured data. The Duolingo lesson-mode pattern is from my knowledge; the search found nothing on it.
- Motion *feel* (spring, stagger, blur) cannot be judged from code; Task 7 and 8 require a human to play it slowed down.
- The nav-centering default (decision 6) overrides a teammate's recent deliberate commit; confirm before Task 3 merges.
- Removing the sky/cloud layers and blobs changes the visual identity ("A Silent Voice" sky theme). That is decision 1 above and needs your yes.
- The `slop` test catches mechanical tells (gradients, violet hues, loops, glass, raw radii, hover lifts, default font). It cannot catch layout tells (three-card rows, centered hero); those rely on the rendered review.
- The font package's exact CSS export path and family name are checked at install time (Task 1 Step 5), not assumed.
