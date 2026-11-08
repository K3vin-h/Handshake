# Group 2 · Design + Frontend (Teammate A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The polished, accessible screens for the demo path (Home trail, Lesson, Complete, Progress, Scene), built in curriculum order and running on fake data until Group 1 plugs in real recognition.

**Architecture:** Screens read `buildCurriculum(profile)`, `progress.ts` and `mistakes.ts` straight from localStorage. `LessonView` and `SceneView` are presentational. `LessonPlayer` (Group 1) feeds them real data, and `#/lesson-preview` feeds them fake data via `useFakeCheck`. Styling: Tailwind + shadcn/ui on top of the existing CSS tokens.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui.

**Prerequisite:** starter plan merged. **Roadmap:** `2026-11-07-roadmap.md`. Work milestone by milestone, and don't start M(n+1) features before the M(n) gate passes.

**Owns:** `frontend/src/components/` (except `Camera.tsx` and `HandModel3D.tsx`, which are shared; ask Ryan first), `frontend/src/screens/Home.tsx`, `Progress.tsx`, `Complete.tsx`, `LessonPreview.tsx`, `frontend/src/styles.css`, `frontend/src/App.tsx`, `frontend/public/reference/`, and the Tailwind root config (`vite.config.ts`, `tsconfig.json`, `components.json`). `package.json` is shared: announce dependency changes and merge them early so the other worktrees rebase once.

## Global Constraints
- UI copy: "matches the reference", never "correct"; "Reference only, coming later" for letters outside `PRACTICEABLE`; label cached coach replies "cached".
- Success and error are always visual + text. Sound is never the only cue.
- Confetti and animation respect `prefers-reduced-motion`. Detection results are announced through an `aria-live` region.
- Keyboard-only path through every screen with visible focus. Text contrast ≥ 4.5:1, checked with a real contrast checker.
- Names come from the local profile only (`loadProfile()`); never send them anywhere.
- Don't change `LessonViewProps`/`SceneViewProps` without telling Ryan. `npm run build && npm test` pass before every merge.

---

## M1 · Your name (by H6)

### Task 1: Design tokens and screens (H0.5 → H3, human; Figma is not used anymore)
- [ ] **H0.5:** Pick 1 font, 2 colours and 3 status colours (match / not yet / reference only). Record them as CSS variables in `styles.css`. Check every text/background pair at ≥ 4.5:1 with a contrast checker.
- [ ] **H1:** Grey-box wireframes of Onboarding, Home, Lesson, Complete and Progress. Agree them with the team at a standup.
- [ ] **H3:** Polished screens from shadcn/ui components. Save real app screenshots under `docs/` and reference them in `docs/notes.md` → Sources.

### Task 2: Tailwind + shadcn/ui (H3)

**Files:** Modify: `vite.config.ts`, `tsconfig.json`, `frontend/src/styles.css`, `package.json`. Create: `components.json`, `frontend/src/components/ui/*` (generated), `frontend/src/lib/utils.ts` (generated).

- [ ] **Step 1: Install Tailwind**
```bash
npm install -D tailwindcss @tailwindcss/vite
```
`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// /api/* is proxied to the Express server so the Gemini key never reaches the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { proxy: { "/api": "http://localhost:8787" } },
});
```
`tsconfig.json` compilerOptions, add: `"paths": { "@/*": ["./src/*"] }` (no `baseUrl`: TypeScript 7 removed it, and `paths` resolves relative to the tsconfig).
Top of `frontend/src/styles.css`, add: `@import "tailwindcss";`
If `npm install` reports a peer-dependency conflict with Vite 8, stop: keep plain CSS with the design tokens in `:root` and skip Step 2. Note it in `docs/notes.md` → Decisions.
- [ ] **Step 2: shadcn**
```bash
npx shadcn@latest init
npx shadcn@latest add button card progress badge
```
Expected: `components.json`, `frontend/src/components/ui/button.tsx` etc., and `frontend/src/lib/utils.ts` are created.
- [ ] **Step 3: Tokens.** Replace the `:root` colours in `styles.css` with the chosen design tokens (keep the variable names `--bg --card --text --muted --primary --border`, and add `--ok --warn --ref`).
- [ ] **Step 4: Verify** `npm run build && npm run dev`. All existing screens still render.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(ui): Tailwind + shadcn + design tokens"`

### Task 3: LessonView + fake-data preview

**Files:** Modify: `frontend/src/components/LessonView.tsx` (replace stub, same props). Create: `frontend/src/components/useFakeCheck.ts`. Modify: `frontend/src/screens/LessonPreview.tsx` (replace stub; the starter already routes `#/lesson-preview`).

**Interfaces:**
- Consumes: `LessonViewProps` (starter; unchanged).
- Produces: polished `LessonView`; `useFakeCheck({ onMatch, onMiss }) → progress`.

- [ ] **Step 1: `frontend/src/components/useFakeCheck.ts`.** It uses D/M rather than Space, because Space activates buttons for keyboard users.
```ts
import { useEffect, useRef, useState } from "react";

/** Dev-only stand-in for useLetterCheck: press D = "detected", M = "miss". */
export function useFakeCheck(handlers: { onMatch: () => void; onMiss: () => void }) {
  const [progress, setProgress] = useState(0);
  const h = useRef(handlers);
  h.current = handlers;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "d") {
        setProgress(1);
        setTimeout(() => {
          setProgress(0);
          h.current.onMatch();
        }, 400);
      }
      if (e.key === "m") h.current.onMiss();
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  }, []);
  return progress;
}
```
- [ ] **Step 2: `frontend/src/screens/LessonPreview.tsx`**
```tsx
import { useState } from "react";
import { LessonView } from "../components/LessonView";
import { useFakeCheck } from "../components/useFakeCheck";
import { celebrate } from "../components/celebrate";

// #/lesson-preview: LessonView on fake data. D = match, M = miss (3rd miss shows side-by-side).
const WORD = ["R", "Y", "A", "N"];

export function LessonPreview() {
  const [index, setIndex] = useState(1);
  const [misses, setMisses] = useState(0);
  const [status, setStatus] = useState("");
  const progress = useFakeCheck({
    onMatch: () => {
      celebrate();
      setStatus(`Matches the reference: ${WORD[index]}`);
      setMisses(0);
      setIndex((i) => (i + 1) % WORD.length);
    },
    onMiss: () => {
      setMisses((m) => m + 1);
      setStatus(`Not matching ${WORD[index]} yet`);
    },
  });
  return (
    <LessonView
      title="Spell RYAN" target={WORD[index]} word={{ letters: WORD, index }}
      reference={<div className="hand3d empty">3D hand for {WORD[index]}</div>} showReference
      camera={<div className="camera"><div className="camera-msg">Camera (fake)</div></div>}
      progress={progress}
      landmarkTip={misses ? "Your thumb is too far from the index finger." : ""}
      coachTip={misses ? "Tuck your thumb against the side of your index finger, like holding a key." : ""}
      coachCached={misses > 1} sideBySide={misses >= 3} status={status}
      stepLabel={`Step ${index + 1} of 4`} actionLabel="Skip" onAction={() => setIndex((i) => (i + 1) % WORD.length)}
    />
  );
}
```
- [ ] **Step 3: Build the real `LessonView`** from the canvas Lesson design, keeping `LessonViewProps` exactly. Required behaviour:
```tsx
// Hold-progress ring (reuse in LessonView)
function Ring({ value }: { value: number }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`Hold ${Math.round(value * 100)}%`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--primary)" strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 36 36)" />
    </svg>
  );
}
```
  - Layout: reference (left) and camera (right); stacked on narrow screens. When `sideBySide` is true, the reference is shown large, at the same height as the camera, and labelled "Compare: reference vs your hand".
  - `word` → a row of letter tiles: done tiles marked ✓ (text, not colour only), the current one highlighted, letters outside `PRACTICEABLE` shown greyed with "reference only" (import `isPracticeable` from `../cv`).
  - Tip box: `landmarkTip` first (instant), then "Coach" + `coachTip`, with a "cached" badge when `coachCached`.
  - `<p role="status" aria-live="polite">{status}</p>` is always rendered.
  - Buttons are real `<button>`s with visible focus: `actionLabel` → `onAction`; "I signed it" when `onSelfCheck` is set.
  - An `<img src={`/reference/${target}.png`} alt={`Reference handshape for ${target}`}>` sits under the 3D reference, hidden by `onError` until Task 8 adds the images.
- [ ] **Step 4: Verify** `npm run build`. On `#/lesson-preview`: D moves through RYAN with confetti, M shows tips, the 3rd M shows side-by-side, and Tab reaches every button.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(ui): LessonView + fake-data preview"`

### Task 4: Home trail

**Files:** Modify: `frontend/src/screens/Home.tsx` (replace stub).

**Interfaces:** Consumes `buildCurriculum`, `Lesson`, `Unit`; `loadProgress`, `isUnlocked`, `nextLesson`; `loadProfile`, `DEMO_PROFILE`, `fillNames`, `WELCOME`.

Everyone sees the same trail from 1.1 (spec §2 rule 5): no placement, no skip-ahead links, no "jump to unit".

- [ ] **Step 1: Implement (structure + data; style it from the canvas design)**
```tsx
import { useMemo } from "react";
import { buildCurriculum } from "../lib/curriculum";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";
import { DEMO_PROFILE, WELCOME, fillNames, loadProfile } from "../lib/profile";

const XP_PER_LEVEL = 100;

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), [profile]);
  const p = loadProgress();
  const next = nextLesson(units, p);
  const level = Math.floor(p.xp / XP_PER_LEVEL) + 1;

  return (
    <main className="page">
      <p>{fillNames(WELCOME, profile)}</p>
      <section aria-label="Your stats" className="row">
        <span className="chip">🔥 {p.streakDays}-day streak</span>
        <span className="chip">Level {level}</span>
        <label>
          XP {p.xp % XP_PER_LEVEL} / {XP_PER_LEVEL}
          <progress max={XP_PER_LEVEL} value={p.xp % XP_PER_LEVEL} />
        </label>
      </section>
      {units.map((u) => (
        <section key={u.id} aria-labelledby={`unit-${u.id}`}>
          <h2 id={`unit-${u.id}`}>{u.title}</h2>
          <p className="muted">{u.goal}</p>
          <ol className="trail">
            {u.lessons.map((l) => {
              const open = isUnlocked(units, p, l.id);
              const done = p.completed.includes(l.id);
              const label = `${l.id} ${l.title}${done ? " (done)" : open ? "" : " (locked)"}${l.scope === "stretch" ? " (coming soon)" : ""}`;
              return (
                <li key={l.id} aria-current={next?.id === l.id ? "step" : undefined}>
                  {open ? <a href={`#/lesson/${l.id}`}>{label}</a> : <span aria-disabled="true">{label}</span>}
                  <span className="muted"> {l.summary}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </main>
  );
}
```
Build the visual trail (nodes, connector line, current-node highlight) in CSS from the canvas design. Locked/done/coming-soon status must stay in the text, not only in colour.
- [ ] **Step 2: Verify** `npm run build`. With the demo profile: Unit 1 is unlocked at 1.1 and everything else is locked. Finish 1.1 in the player (or on the preview): 1.2 unlocks.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): Home trail with streak and XP"`

### Task 5: `celebrate()`: confetti + sound

**Files:** Modify: `frontend/src/components/celebrate.ts` (replace stub), `frontend/src/styles.css`.

- [ ] **Step 1: Implement**
```ts
// Success feedback. The text status ("Matches the reference: L") is the primary cue; this only adds to it.
let audio: AudioContext | null = null;

export function celebrate() {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.25);
  } catch {
    /* no audio: fine, never the only cue */
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("span");
    s.style.left = `${Math.random() * 100}%`;
    s.style.background = `hsl(${Math.random() * 360} 80% 55%)`;
    s.style.animationDelay = `${Math.random() * 0.2}s`;
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 1500);
}
```
`styles.css`:
```css
.confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 50; }
.confetti span { position: absolute; top: -12px; width: 8px; height: 14px; animation: confetti-fall 1.2s ease-in forwards; }
@keyframes confetti-fall { to { transform: translateY(105vh) rotate(540deg); } }
@media (prefers-reduced-motion: reduce) {
  .confetti { display: none; }
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
- [ ] **Step 2: Verify.** Press D on `#/lesson-preview`: confetti appears and a short beep plays. Turn on OS "reduce motion": no confetti, the beep still plays and the status text still updates.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): confetti + sound, reduced-motion aware"`

### Task 6: Complete screen

**Files:** Modify: `frontend/src/screens/Complete.tsx` (replace stub).

**Interfaces:** Consumes `buildCurriculum`, `flatLessons`, `loadProgress`, `nextLesson`, `loadProfile`, `DEMO_PROFILE`; Group 3's `refreshPracticeWords()` from `frontend/src/lib/profile.ts` (added in M2; until then, leave the `useEffect` line commented out).

- [ ] **Step 1: Implement**
```tsx
import { useMemo } from "react";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { loadProgress, nextLesson } from "../lib/progress";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";

export function Complete({ lessonId }: { lessonId: string }) {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), [profile]);
  const lesson = flatLessons(units).find((l) => l.id === lessonId);
  const next = nextLesson(units, loadProgress());
  // M2: useEffect(() => { refreshPracticeWords(); }, []);

  return (
    <main className="page">
      <h1 tabIndex={-1} ref={(h) => h?.focus()}>{lesson ? `${lesson.title}: done!` : "Lesson done!"}</h1>
      <p>+{lesson?.xp ?? 0} XP</p>
      <div className="row">
        {next ? <a href={`#/lesson/${next.id}`}>Next: {next.title}</a> : null}
        <a href="#/">Back to your path</a>
      </div>
    </main>
  );
}
```
- [ ] **Step 2: Verify** `npm run build`. `#/complete/1.1` shows the XP and the next lesson; focus lands on the heading.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): Complete screen"`

### ✅ Gate M1 (H6, same checklist in all plans)
- [ ] Onboarding (or demo profile) → Home shows "Introduce yourself" with the learner's name.
- [ ] 1.1 plays with real recognition; R and N show "reference only, coming later".
- [ ] A miss shows the landmark tip instantly, then the Gemini/mock tip.
- [ ] 1.2 and 1.3 spell RYAN, skipping R/N.
- [ ] Complete shows XP; reload keeps progress.
- [ ] `npm run build && npm test` pass on `main`. Merge, push, 5-minute standup.

---

## M2 · Alphabet + their name (by H10)

### Task 7: Progress screen with weak fingers

**Files:** Modify: `frontend/src/screens/Progress.tsx` (replace stub).

**Interfaces:** Consumes `loadProgress`, `weakItems`; `loadMistakes`, `weakFingers` (Group 1, real since M1).

- [ ] **Step 1: Implement**
```tsx
import { loadProgress, weakItems } from "../lib/progress";
import { loadMistakes, weakFingers } from "../lib/mistakes";

const FINGER = { thumb: "Thumb", index: "Index finger", middle: "Middle finger", ring: "Ring finger", pinky: "Pinky" } as Record<string, string>;

export function ProgressScreen() {
  const p = loadProgress();
  const mastered = Object.entries(p.items).filter(([id, s]) => id.length === 1 && s.mastered).map(([id]) => id).sort();
  const weak = weakItems(p).filter((id) => id.length === 1);
  const fingers = weakFingers(loadMistakes());

  return (
    <main className="page">
      <h1>Your progress</h1>
      <p>🔥 {p.streakDays}-day streak · {p.xp} XP</p>
      <section aria-labelledby="mastered">
        <h2 id="mastered">Letters that match the reference ({mastered.length})</h2>
        <p>{mastered.length ? mastered.join(" ") : "None yet: finish your first lesson."}</p>
      </section>
      <section aria-labelledby="weak">
        <h2 id="weak">Letters to practise</h2>
        <p>{weak.length ? weak.join(" ") : "Nothing yet."}</p>
      </section>
      <section aria-labelledby="fingers">
        <h2 id="fingers">By finger</h2>
        {fingers.length ? (
          <>
            <p><b>{FINGER[fingers[0].finger]} placement is your most common issue.</b></p>
            <ul>{fingers.map((f) => <li key={f.finger}>{FINGER[f.finger]}: {f.count} times</li>)}</ul>
          </>
        ) : (
          <p>No repeated mistakes yet.</p>
        )}
      </section>
    </main>
  );
}
```
- [ ] **Step 2: Verify** `npm run build`. After playing a few lessons with deliberate misses, the weak finger shows up.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): Progress with weak letters and fingers"`

### Task 8: Reference images (H12 at the latest)

**Files:** Create: `frontend/public/reference/<LETTER>.png` for each letter in `PRACTICEABLE`, plus `frontend/public/reference/CREDITS.md`.

- [ ] **Step 1:** Draw your own images, or use a licensed source. Save them as `frontend/public/reference/A.png` … `Y.png` (square, ≥ 512 px, left-hand versions not needed: the 3D view mirrors).
- [ ] **Step 2:** Write `frontend/public/reference/CREDITS.md` with the source, licence and link (or "drawn by the team"). Copy the credit into the Devpost notes.
- [ ] **Step 3: Verify.** On `#/lesson-preview`, the `<img>` from Task 3 shows for Y and A, and stays hidden for R and N (no image, reference only).
- [ ] **Step 4: Commit** `git add frontend/public/reference && git commit -m "assets: credited reference images"`

### Task 9: M2 wiring
- [ ] **Step 1:** In `Complete.tsx`, enable the practice-words refresh once Group 3 has merged `refreshPracticeWords`. Add `useEffect` to the React import and `import { refreshPracticeWords } from "../lib/profile";`, then uncomment `useEffect(() => { refreshPracticeWords(); }, []);`.
- [ ] **Step 2: Commit** `git commit -am "feat(ui): refresh practice words after each lesson"`

### ✅ Gate M2 (H10)
- [ ] `docs/test-log.md`: every letter in `PRACTICEABLE` scores ≥ 8/10.
- [ ] 2.1–2.4 play with contrast, practice words and review; Unit 2 ids are the same for any names.
- [ ] "Spell LILY" (2.5) unlocks after the last demo family and plays.
- [ ] Same mistake twice → a different cue; 3rd time → reference beside the live hand.
- [ ] Gemini shown live once and recorded: a coach cue that changes on the repeated mistake, and a word drill led by a weak letter (group-3 Task 7 Step 4).
- [ ] Progress shows mastered letters, weak letters and weak fingers. Merge, push, standup.

---

## M3 · Greetings (by H14)

### Task 10: Sign steps on Home + accessibility pass (H14)

**Files:** Modify: `frontend/src/screens/Home.tsx`, `frontend/src/components/LessonView.tsx`, `frontend/src/styles.css`.

- [ ] **Step 1: Home badges.** Next to each lesson in Units 3–4, add a text badge showing `l.grading`: "auto-checked" (auto), "assisted" (assisted) or "self-check" (self).
- [ ] **Step 2: Sign view.** When `onSelfCheck` is set, show the "I signed it" button as the primary action, with the status text explaining the sign. The status for a sign step comes in as `status` (e.g. "Good handshape. Now move your hand to your forehead"), so make it large and prominent.
- [ ] **Step 3: Accessibility checklist.** Tick each item in `docs/notes.md` → Decisions with the date:
  - [ ] Success and error are always visual + text (play a lesson muted: everything is still clear).
  - [ ] Confetti and animation are off under `prefers-reduced-motion`.
  - [ ] Detection results are announced: a screen reader reads "Matches our recording: L" ("Matches the reference" once the signer has checked).
  - [ ] A keyboard-only run works: Onboarding → Home → lesson → Complete → Progress with Tab/Enter only, and focus is always visible.
  - [ ] Every text pair is ≥ 4.5:1 in a contrast checker (record the tool and the lowest ratio).
  - [ ] Left-handed mode: the reference is mirrored (`leftHanded` profile), and the layout doesn't assume a right hand.
- [ ] **Step 4: Commit** `git commit -am "a11y: pass + sign-step UI"`

### ✅ Gate M3 (H14)
- [ ] 3.1 and 3.2 play end to end.
- [ ] Each sign ≥ 4/5 in `docs/test-log.md`, or `SIGNS_AUTO = false`.
- [ ] Accessibility checklist complete. Merge, push, standup.

---

## M4 · Conversation (by H16 → freeze)

### Task 11: SceneView

**Files:** Modify: `frontend/src/components/SceneView.tsx` (replace stub, same props).

- [ ] **Step 1:** Build the chat layout from the canvas design, keeping `SceneViewProps`:
  - Past turns as bubbles: theirs on the left (gloss in caps + English caption), yours on the right (English).
  - The current turn: their bubble, then your reply as a row of token chips. Chips before `tokenIndex` are marked done ✓ (with text), and the current chip is highlighted.
  - `camera` below the chips, `prompt` in an `aria-live="polite"` region, and an "I signed it" button when `onSelfCheck` is set.
  - A reference clip slot under their bubble (empty box with "clip coming later" if there's no clip).
- [ ] **Step 2: Verify.** Once Group 1 has merged scene 4.1, play it end to end on the demo laptop.
- [ ] **Step 3: Screenshots (H16).** Capture real screenshots of the shipped app for the design prizes. [NEEDS: confirm with organizers whether this prize is still eligible without a Figma file]
- [ ] **Step 4: Commit** `git commit -am "feat(ui): SceneView chat layout"`

### ✅ Gate M4 (H16)
- [ ] Scene 4.1 runs in under 90 s on the demo laptop.
- [ ] `git tag freeze` (Ryan). From here on: polish and bug fixes only.

---

## Ship (H16 → H24)

### Task 12: Polish and accessibility notes
- [ ] **H18:** Polish only: spacing, empty states (no profile, no progress, no templates), and no dead buttons. Remove the `Demo`/`Record`/`Curriculum` nav links from the visible nav before the demo; the routes still work by URL.
- [ ] **H19:** Write the accessibility notes for the Most Accessible Design opt-in in `docs/notes.md`. List only what shipped (use the Task 10 checklist), plus real app screenshots. [NEEDS: confirm with organizers whether this prize is still eligible without a Figma file]
- [ ] **H23:** Join the demo run-throughs and fix only what breaks.
