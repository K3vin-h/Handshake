# Group 3 · Gemini + Backend + Pitch (Teammate B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three Gemini endpoints that never see names, never judge signs and never block the demo. Plus onboarding, personalized practice order, and the pitch (interviews, Devpost, slides, video), built in curriculum order.

**Architecture:** `server/app.mjs` exports `createApp({ ai, model, precache, snapshot })`, so tests can inject a fake Gemini client. `server/index.mjs` only wires env and listens. Every reply uses `responseSchema` (enums of allowed letters/words), passes through a server-side guard, and falls back to a landmark/mock answer on any error. Cache hits, including `server/precache.json`, are returned with `cached: true`. On the client, `profile.ts` keeps names local and sends only letters.

**Tech Stack:** Express 5, `@google/genai`, Node 24 `node --test`, React 19.

**Prerequisite:** starter plan merged. **Roadmap:** `2026-11-07-roadmap.md`. Work milestone by milestone, and don't start M(n+1) features before the M(n) gate passes.

**Owns:** `server/`, `src/lib/api.ts`, `src/lib/profile.ts`, `src/lib/curriculum.ts`, `src/screens/Onboarding.tsx`, `docs/notes.md`, Devpost, slides, video.

## Global Constraints
- Gemini never sees names. Requests carry letters, relationship, sign ids and error codes only, and a test enforces this.
- `getHandFeedback` is the truth: the coach rewords it, must not contradict it, and never says "correct"/"incorrect".
- All 3 endpoints use `responseSchema`; letter/word fields are `enum`-constrained. A guard still filters every reply.
- Any cached or pre-generated reply returns `cached: true`. No endpoint ever returns an error to the demo: fall back instead.
- The Gemini key lives only in `.env`. `SEND_SNAPSHOT`/`SNAPSHOT_ENABLED` stay off unless the H4 test passes.
- Claim only what shipped. Every quote and source goes into `docs/notes.md` as it happens.
- `npm run build && npm test` pass before every merge.

---

## M1 · Your name (by H6)

### Task 1: Key, model, notes (H0–H1, human)
- [ ] **H0:** `docs/notes.md` exists (starter). Add the doc's evidence to it under Sources: Lifeprint Lesson 1, Mitchell & Karchmer 2004, Chen Pichler/Gale/Lillo-Martin 2021 (with the grammar caveat), Geer & Keane 2018.
- [ ] **H1:** Get a Gemini API key in AI Studio. Check the current fast model name and its free-tier limits (requests/minute). Then `cp .env.example .env` and set `GEMINI_API_KEY` and `GEMINI_MODEL`. Log the model and limits in `docs/notes.md` → Decisions.
- [ ] Check that the SDK exposes `Type`: `node -e "import('@google/genai').then(m => console.log(Object.keys(m.Type)))"`. Expected: it prints `OBJECT`, `STRING`, `ARRAY`, …

### Task 2: Server refactor with schemas, privacy and cache (tested, H3)

**Files:** Create: `server/app.mjs`, `server/app.test.mjs`. Modify: `server/index.mjs` (replace).

**Interfaces:**
- Consumes: request shapes from spec §4 (`/api/path {letters, relationship, allowedWords}`, `/api/coach {target, feedback, repeat, snapshot?}`, `/api/words {knownLetters, weakLetters}`).
- Produces: `createApp({ ai, model, precache, snapshot }) → express app`; cache keys `path:<rel>:<letters>:<words>`, `coach:<target>:<code>:<issue>:<repeat≤3>`, `words:<known>:<weak>`; `GET /api/cache` (dump for `precache.json`).

- [ ] **Step 1: Write the failing tests** `server/app.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.mjs";

function fakeAi(reply) {
  const calls = [];
  return { calls, models: { generateContent: async (req) => (calls.push(req), { text: JSON.stringify(reply) }) } };
}
async function post(app, url, body) {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    const res = await fetch(`http://localhost:${server.address().port}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } finally {
    server.close();
  }
}
const promptOf = (call) => call.contents[0].parts[0].text;
const THUMB = { finger: "thumb", issue: "is too far from the index finger", code: "thumb:placement" };

test("path: names never reach Gemini, words limited to the allowed enum", async () => {
  const ai = fakeAi({ wordPack: ["WORK", "PIZZA"], welcome: "Hi {you}, say hello to {them}." });
  const body = { userName: "Ryan", learningFor: "Lily", letters: ["L", "I", "Y"], relationship: "coworker", allowedWords: ["WORK", "COFFEE"] };
  const out = await post(createApp({ ai }), "/api/path", body);
  assert.doesNotMatch(promptOf(ai.calls[0]), /Ryan|Lily/);
  assert.deepEqual(ai.calls[0].config.responseSchema.properties.wordPack.items.enum, ["WORK", "COFFEE"]);
  assert.deepEqual(out.wordPack, ["WORK"]);
  assert.equal(out.welcome, "Hi {you}, say hello to {them}.");
});

test("path: second identical call is labelled cached", async () => {
  const app = createApp({ ai: fakeAi({ wordPack: ["WORK"], welcome: "Hi {you}." }) });
  const body = { letters: ["A"], relationship: "coworker", allowedWords: ["WORK"] };
  assert.equal((await post(app, "/api/path", body)).cached, undefined);
  assert.equal((await post(app, "/api/path", body)).cached, true);
});

test("words: only known letters survive, weak letters first, schema enum = known letters", async () => {
  const ai = fakeAi({ words: [["B", "O", "Y"], ["L", "I", "L", "Y"], ["C", "A", "T"]] });
  const out = await post(createApp({ ai }), "/api/words", { knownLetters: ["L", "I", "Y", "B", "O"], weakLetters: ["L"] });
  assert.deepEqual(out.words, ["LILY", "BOY"]);
  assert.deepEqual(ai.calls[0].config.responseSchema.properties.words.items.items.enum, ["L", "I", "Y", "B", "O"]);
});

test("coach: no key → landmark tip, never an error", async () => {
  const out = await post(createApp({}), "/api/coach", { target: "A", feedback: [THUMB], repeat: 1 });
  assert.match(out.tip, /thumb/);
});

test("coach: Gemini failure → landmark tip", async () => {
  const ai = { models: { generateContent: async () => { throw new Error("429"); } } };
  const out = await post(createApp({ ai }), "/api/coach", { target: "A", feedback: [THUMB], repeat: 1 });
  assert.match(out.tip, /thumb/);
});

test("coach: precached tip served without calling Gemini, labelled cached", async () => {
  const ai = fakeAi({ tip: "live" });
  const precache = { [`coach:A:thumb:placement:${THUMB.issue}:1`]: { tip: "Tuck your thumb against your index finger." } };
  const out = await post(createApp({ ai, precache }), "/api/coach", { target: "A", feedback: [THUMB], repeat: 1 });
  assert.deepEqual(out, { tip: "Tuck your thumb against your index finger.", cached: true });
  assert.equal(ai.calls.length, 0);
});

test("coach: repeat changes the instruction; snapshot ignored unless enabled", async () => {
  const ai = fakeAi({ tip: "x" });
  await post(createApp({ ai }), "/api/coach", { target: "A", feedback: [THUMB], repeat: 2, snapshot: "data:image/jpeg;base64,AAAA" });
  assert.match(promptOf(ai.calls[0]), /DIFFERENT cue/);
  assert.equal(ai.calls[0].contents[0].parts.length, 1);
});
```
- [ ] **Step 2: Run** `npm test`. Expected: FAIL with `Cannot find module './app.mjs'`.
- [ ] **Step 3: Implement** `server/app.mjs`:
```js
// Teammate B owns this file. Gemini coaches and personalizes; it never judges signs and never sees names.
import express from "express";
import { Type } from "@google/genai";

const RELATIONSHIPS = ["coworker", "friend", "family", "classmate", "partner"];
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const MOCK_PACKS = {
  coworker: ["WORK", "COFFEE", "MEETING"],
  friend: ["FRIEND", "COFFEE"],
  family: ["MOM", "DAD", "LOVE"],
  classmate: ["SCHOOL", "FRIEND"],
  partner: ["LOVE", "COFFEE"],
};
const MOCK_WORDS = ["LILY", "BOY", "DOLL", "WILD", "COLD", "BOLD", "FOIL", "CLAY", "BODY", "IDOL", "FOLD", "VOID", "COW", "LAW", "DAY", "BAY", "OIL"];
const WELCOME = "Let's start with your name, {you}. In a few lessons you'll be saying hello to {them}.";

const letters = (xs) => [...new Set((Array.isArray(xs) ? xs : []).map((s) => String(s).toUpperCase()).filter((s) => /^[A-Z]$/.test(s)))];

export function createApp({ ai = null, model = "gemini-2.5-flash", precache = {}, snapshot = false } = {}) {
  const app = express();
  app.use(express.json({ limit: "5mb" })); // snapshots are base64 images
  const cache = new Map(Object.entries(precache));

  async function askJson(prompt, schema, image) {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.replace(/^data:image\/\w+;base64,/, "") } });
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7 },
    });
    return JSON.parse(res.text);
  }

  // Cache hits (including precache.json) are labelled so the UI can say "cached".
  async function cached(key, fn) {
    if (cache.has(key)) return { ...cache.get(key), cached: true };
    const value = await fn();
    cache.set(key, value);
    return value;
  }

  // 1. Onboarding: pick a word pack from signs the app can teach. Letters only, never names.
  app.post("/api/path", async (req, res) => {
    const ls = letters(req.body?.letters);
    const relationship = RELATIONSHIPS.includes(req.body?.relationship) ? req.body.relationship : "friend";
    const allowed = [...new Set((req.body?.allowedWords ?? []).map(String))].filter((w) => /^[A-Z-]+$/.test(w));
    const fallback = { wordPack: MOCK_PACKS[relationship].filter((w) => !allowed.length || allowed.includes(w)), welcome: WELCOME };
    if (!ai || !allowed.length) return res.json(fallback);
    try {
      const out = await cached(`path:${relationship}:${ls.join("")}:${allowed.join(",")}`, () =>
        askJson(
          `A hearing adult beginner is learning ASL to talk with their ${relationship}, who is Deaf.
Letters they will practise first: ${ls.join(" ") || "none yet"}.
Pick the 3 or 4 signs from the allowed list that are most useful in everyday conversation with a ${relationship}.
Write one warm welcome sentence under 25 words. Refer to the learner only as {you} and the other person only as {them}, with the braces. No emojis.`,
          {
            type: Type.OBJECT,
            properties: { wordPack: { type: Type.ARRAY, items: { type: Type.STRING, enum: allowed } }, welcome: { type: Type.STRING } },
            required: ["wordPack", "welcome"],
          },
        ),
      );
      const wordPack = (out.wordPack ?? []).filter((w) => allowed.includes(w));
      res.json({ ...out, wordPack: wordPack.length ? wordPack : fallback.wordPack, welcome: out.welcome || WELCOME });
    } catch (e) {
      console.error(e);
      res.json(fallback); // onboarding must never fail on stage
    }
  });

  // 2. Coach: reword the landmark feedback. Adapts to how often this learner made this mistake.
  app.post("/api/coach", async (req, res) => {
    const target = String(req.body?.target ?? "").toUpperCase();
    if (!/^([A-Z]|5)$/.test(target)) return res.status(400).json({ error: "bad_target" });
    const feedback = (Array.isArray(req.body?.feedback) ? req.body.feedback : [])
      .filter((f) => FINGERS.includes(f?.finger) && typeof f.issue === "string")
      .slice(0, 5)
      .map((f) => ({ finger: f.finger, issue: f.issue.slice(0, 80), code: String(f.code ?? "") }));
    const repeat = Math.max(1, Math.min(9, Number(req.body?.repeat) || 1));
    const image = snapshot && typeof req.body?.snapshot === "string" ? req.body.snapshot : undefined;
    const first = feedback[0];
    const landmark = { tip: first ? `Your ${first.finger} ${first.issue}. Adjust it and hold still.` : `Compare your hand with the ${target} reference and hold still.` };
    const key = `coach:${target}:${first?.code ?? "none"}:${first?.issue ?? ""}:${Math.min(repeat, 3)}`;
    if (cache.has(key)) return res.json({ ...cache.get(key), cached: true });
    if (!ai) return res.json(landmark);
    const style =
      repeat === 1
        ? "Give one short cue (max 15 words)."
        : repeat === 2
          ? "They made this same mistake before: give a DIFFERENT cue or a comparison to an everyday object (max 25 words)."
          : "They keep making this mistake: the reference is now shown beside their camera; tell them exactly what to compare (max 30 words).";
    try {
      const fn = () =>
        askJson(
          `You coach ASL fingerspelling handshapes. Target letter: ${target}.
Measured by hand landmarks (this is the truth; never contradict it): ${feedback.map((f) => `${f.finger} ${f.issue}`).join("; ") || "no clear difference"}.
${image ? "A photo of their hand is attached; use it only to make the cue more specific." : ""}
${style} Say what to move. Never say the sign is correct or incorrect. No emojis.`,
          { type: Type.OBJECT, properties: { tip: { type: Type.STRING } }, required: ["tip"] },
          image,
        );
      res.json(image ? await fn() : await cached(key, fn)); // photo replies are never cached
    } catch (e) {
      console.error(e);
      res.json(landmark);
    }
  });

  // 3. Practice words from known letters only, weak letters first.
  app.post("/api/words", async (req, res) => {
    const known = letters(req.body?.knownLetters);
    const weak = letters(req.body?.weakLetters).filter((l) => known.includes(l));
    const ok = (w) => w.length >= 2 && [...w].every((c) => known.includes(c));
    const weakScore = (w) => [...w].filter((c) => weak.includes(c)).length;
    const fallback = { words: MOCK_WORDS.filter(ok).sort((a, b) => weakScore(b) - weakScore(a)).slice(0, 6) };
    if (!ai || known.length < 2) return res.json(fallback);
    try {
      const out = await cached(`words:${known.join("")}:${weak.join("")}`, () =>
        askJson(
          `List 6 real, common English words for fingerspelling practice, 3 to 5 letters each, using ONLY these letters: ${known.join(", ")}.
Prefer words containing: ${weak.join(", ") || "any of them"}. Return each word as an array of single letters.`,
          {
            type: Type.OBJECT,
            properties: { words: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING, enum: known } } } },
            required: ["words"],
          },
        ),
      );
      const words = [...new Set((out.words ?? []).map((w) => (Array.isArray(w) ? w.join("") : String(w)).toUpperCase()))]
        .filter(ok)
        .sort((a, b) => weakScore(b) - weakScore(a));
      res.json({ ...out, words: words.length ? words : fallback.words });
    } catch (e) {
      console.error(e);
      res.json(fallback);
    }
  });

  // Dev: dump the cache to pre-generate demo replies → server/precache.json (contains no names).
  app.get("/api/cache", (_req, res) => res.json(Object.fromEntries(cache)));

  return app;
}
```
`server/index.mjs` (replace):
```js
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { createApp } from "./app.mjs";

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const file = new URL("./precache.json", import.meta.url);
const precache = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const snapshot = process.env.SNAPSHOT_ENABLED === "1";
const port = Number(process.env.PORT) || 8787;

createApp({ ai, model, precache, snapshot }).listen(port, () =>
  console.log(`API on http://localhost:${port} (${ai ? `Gemini ${model}` : "mock mode: no GEMINI_API_KEY"}, ${Object.keys(precache).length} precached, snapshot ${snapshot ? "on" : "off"})`),
);
```
- [ ] **Step 4: Run** `npm test`. Expected: all 7 server tests pass (plus the CV/mistakes tests).
- [ ] **Step 5: Real-key smoke test (H3)**
```bash
npm run api
curl -s localhost:8787/api/path -H "Content-Type: application/json" -d '{"letters":["A","Y","L","I"],"relationship":"coworker","allowedWords":["WORK","COFFEE","MEETING"]}'
curl -s localhost:8787/api/coach -H "Content-Type: application/json" -d '{"target":"A","feedback":[{"finger":"thumb","issue":"is too far from the index finger","code":"thumb:placement"}],"repeat":1}'
curl -s localhost:8787/api/words -H "Content-Type: application/json" -d '{"knownLetters":["L","I","Y","B","O","D"],"weakLetters":["Y"]}'
```
Expected: real Gemini JSON from each; the welcome contains `{you}`/`{them}`. **H3 checkpoint: "Gemini returns a real reply".**
- [ ] **Step 6: Commit** `git add server && git commit -m "feat(server): schemas, no names, cached flag, adaptive coach, tests"`

### Task 3: Snapshot test, not a feature (H4)

**Files:** Create: `server/snapshot-test.mjs`.

- [ ] **Step 1: Script**
```js
// Usage: node server/snapshot-test.mjs <folder of A-right-1.jpg / A-wrong-1.jpg files>
// Gemini names the letter and the error; a signer judges. Results go in docs/notes.md → Snapshot test.
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LETTERS = "ABCDFILOVWY".split("");
const dir = process.argv[2];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".jpg"))) {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [{ role: "user", parts: [
      { text: "This is a learner's hand attempting an ASL fingerspelling letter. Which letter is it closest to, and what is off about the handshape?" },
      { inlineData: { mimeType: "image/jpeg", data: readFileSync(join(dir, f)).toString("base64") } },
    ] }],
    config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { letter: { type: Type.STRING, enum: LETTERS }, error: { type: Type.STRING } }, required: ["letter", "error"] } },
  });
  console.log(`${f}\t${res.text}`);
}
```
- [ ] **Step 2: Run** it on Ryan's 10 photos (5 right, 5 wrong; see group-1 Task 5). With a signer, mark each result: did it name the intended letter? Did it contradict `getHandFeedback`? Log the table in `docs/notes.md`.
- [ ] **Step 3: Decide.** Keep only if it named the intended letter in ≥ 8/10 and contradicted the landmarks ≤ 1/10. If kept: set `SNAPSHOT_ENABLED=1` in `.env`, set `SEND_SNAPSHOT = true` in `src/lib/api.ts`, and add "a photo of your hand is sent to Google's Gemini API" to the Devpost notes. Otherwise leave both off and log "dropped".
- [ ] **Step 4: Commit** `git add server/snapshot-test.mjs src/lib/api.ts docs/notes.md && git commit -m "test: H4 snapshot decision"`

### Task 4: Onboarding

**Files:** Modify: `src/screens/Onboarding.tsx` (replace stub).

**Interfaces:**
- Consumes: `isPracticeable`, `SIGNS`, `PACK_WORDS` (src/cv; `PACK_WORDS` lives in `src/cv/signs.ts`, so import it from `../cv/signs`); `personalizePath`; `saveProfile`, `DEMO_PROFILE`, `Profile`.
- Produces: a saved `Profile`, then navigates to `#/`.

- [ ] **Step 1: Implement**
```tsx
import { useState, type FormEvent } from "react";
import { SIGNS, isPracticeable } from "../cv";
import { PACK_WORDS } from "../cv/signs";
import { personalizePath } from "../lib/api";
import { DEMO_PROFILE, saveProfile, type Profile } from "../lib/profile";

const RELATIONSHIPS: Profile["relationship"][] = ["coworker", "friend", "family", "classmate", "partner"];
const lettersOf = (s: string) => [...new Set(s.toUpperCase().replace(/[^A-Z]/g, ""))];

export function Onboarding() {
  const [f, setF] = useState({ userName: "", theirName: "", relationship: "coworker" as Profile["relationship"], leftHanded: false, goal: "" });
  const [busy, setBusy] = useState(false);
  const all = [...new Set([...lettersOf(f.userName), ...lettersOf(f.theirName)])];
  const now = all.filter(isPracticeable);
  const later = all.filter((l) => !isPracticeable(l));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const allowed = Object.values(SIGNS).filter((s) => s.packs?.length).map((s) => s.id);
    // Only letters leave the device. Names stay in this browser.
    const path = await personalizePath(now, f.relationship, allowed).catch(() => ({ wordPack: PACK_WORDS(f.relationship), welcome: DEMO_PROFILE.welcome }));
    saveProfile({ ...f, wordPack: path.wordPack, welcome: path.welcome });
    location.hash = "#/";
  }

  return (
    <main className="page">
      <h1>Who are you learning for?</h1>
      <form onSubmit={submit}>
        <label>Your name <input required value={f.userName} onChange={(e) => setF({ ...f, userName: e.target.value })} /></label>
        <label>Their name <input required value={f.theirName} onChange={(e) => setF({ ...f, theirName: e.target.value })} /></label>
        <label>
          They are your
          <select value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value as Profile["relationship"] })}>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Your signing hand</legend>
          <label><input type="radio" name="hand" checked={!f.leftHanded} onChange={() => setF({ ...f, leftHanded: false })} /> Right</label>
          <label><input type="radio" name="hand" checked={f.leftHanded} onChange={() => setF({ ...f, leftHanded: true })} /> Left</label>
        </fieldset>
        <label>Your goal <input value={f.goal} placeholder="Introduce myself" onChange={(e) => setF({ ...f, goal: e.target.value })} /></label>
        {all.length > 0 && (
          <section aria-live="polite">
            <p>Practise now: <b>{now.join(" ") || "none yet"}</b></p>
            {later.length > 0 && <p>Reference only, coming later: <b>{later.join(" ")}</b></p>}
            <p className="muted">Names stay on this device. Only letters are sent to our coach.</p>
          </section>
        )}
        <button disabled={busy}>{busy ? "Building your path…" : "Start"}</button>
      </form>
      <button className="secondary" onClick={() => { saveProfile(DEMO_PROFILE); location.hash = "#/"; }}>Use demo profile (Ryan → Lily)</button>
    </main>
  );
}
```
- [ ] **Step 2: Verify** `npm run build`. Type "Ryan"/"Lily": the screen shows "Practise now: Y A L I" and "Reference only, coming later: R N". Submit → Home shows the welcome line with the names filled in. In DevTools → Network → `/api/path`, the payload contains no names.
- [ ] **Step 3: Commit** `git commit -am "feat: onboarding with practiceable letters, names stay local"`

### ✅ Gate M1 (H6, same checklist in all plans)
- [ ] Onboarding (or demo profile) → Home shows "Introduce yourself" with the learner's name.
- [ ] 1.1 plays with real recognition; R and N show "reference only, coming later".
- [ ] A miss shows the landmark tip instantly, then the Gemini/mock tip.
- [ ] 1.2 and 1.3 spell RYAN, skipping R/N.
- [ ] Complete shows XP; reload keeps progress.
- [ ] `npm run build && npm test` pass on `main`. Merge, push, 5-minute standup.

---

## M2 · Alphabet + their name (by H10)

### Task 5: Alphabet families cover the letter set

**Files:** Modify: `src/lib/curriculum.ts` (`FAMILIES`).

- [ ] **Step 1:** Replace `FAMILIES` so that every practiceable letter sits in a demo family:
```ts
const FAMILIES: { id: string; title: string; letters: string[]; scope: "demo" | "stretch" }[] = [
  { id: "flat", title: "Flat and curved", letters: ["B", "C", "O"], scope: "demo" },
  { id: "point", title: "Point and pinky", letters: ["D", "I", "L", "Y"], scope: "demo" },
  { id: "fingers", title: "Two and three fingers", letters: ["V", "W", "F"], scope: "demo" },
  { id: "fist", title: "The fist", letters: ["A"], scope: "demo" },
  { id: "fingers2", title: "More finger shapes", letters: ["U", "K", "R"], scope: "stretch" },
  { id: "fist2", title: "The fist family", letters: ["S", "E", "T", "M", "N"], scope: "stretch" },
  { id: "sideways", title: "Sideways shapes", letters: ["G", "H", "P", "Q", "X"], scope: "stretch" },
];
```
- [ ] **Step 2: Verify** on `#/curriculum` with Ryan/Lily and "Demo scope only": 2.1 B C O, 2.2 D I L, 2.3 Spell LILY, 2.4 V W F (A is skipped because Unit 1 taught it). `npm run build` passes.
- [ ] **Step 3: Commit** `git commit -am "feat(curriculum): demo families cover all practiceable letters"`

### Task 6: Practice words, weakest first (doc item c)

**Files:** Modify: `src/lib/profile.ts`, `src/screens/Onboarding.tsx`.

**Interfaces:** Produces `fetchPracticeWords(p: Profile, weak?: string[]) → Promise<Record<string, string[]>>` and `refreshPracticeWords() → Promise<void>` (called by Group 2's Complete screen).

- [ ] **Step 1: Add to `src/lib/profile.ts`**
```ts
import { buildCurriculum, flatLessons } from "./curriculum";
import { loadProgress, weakItems } from "./progress";
import { getPracticeWords } from "./api";
import { isPracticeable } from "../cv";

/** Words for each Unit 2 lesson, from letters known by that point; weak letters first. Letters only go to the server. */
export async function fetchPracticeWords(p: Profile, weak: string[] = []): Promise<Record<string, string[]>> {
  const known = new Set<string>();
  const out: Record<string, string[]> = {};
  for (const l of flatLessons(buildCurriculum(p))) {
    (l.teaches ?? []).filter(isPracticeable).forEach((x) => known.add(x));
    if (!l.id.startsWith("2.") || !l.teaches?.length) continue;
    try {
      out[l.id] = (await getPracticeWords([...known], weak.filter((x) => known.has(x)))).words;
    } catch {
      /* lesson just has no extra words */
    }
  }
  return out;
}

/** After each lesson: re-pick practice words around the learner's weakest letters. */
export async function refreshPracticeWords() {
  const p = loadProfile();
  if (!p) return;
  const weak = weakItems(loadProgress(), 5).filter((x) => x.length === 1);
  saveProfile({ ...p, practiceWords: await fetchPracticeWords(p, weak) });
}
```
(`profile.ts` already imports `type Personalization` from `./curriculum`; merge that into the new import line.)
- [ ] **Step 2:** In `Onboarding.tsx`, `submit`, replace the `saveProfile(...)` line with:
```ts
    const base: Profile = { ...f, wordPack: path.wordPack, welcome: path.welcome };
    saveProfile({ ...base, practiceWords: await fetchPracticeWords(base) });
```
and import `fetchPracticeWords`.
- [ ] **Step 3: Verify** `npm run build`. After onboarding, `localStorage["handshake.profile.v1"]` has `practiceWords` for 2.x lessons, and 2.1 ends with up to 3 spelled words. Tell Teammate A that `refreshPracticeWords` is merged (group-2 Task 9).
- [ ] **Step 4: Commit** `git commit -am "feat: practice words per lesson, weak letters first"`

### Task 7: Pre-cache the demo (by H12)

**Files:** Create: `server/precache.json`.

- [ ] **Step 1:** With the real key, run the whole demo path once as Ryan → Lily, including deliberate common mistakes on L, I, Y and A (each made 1×, 2× and 3× so all three coach styles get cached).
- [ ] **Step 2:** `curl -s localhost:8787/api/cache > server/precache.json`. Open the file and check that there are no names in it and every tip reads well. Edit any bad tip by hand.
- [ ] **Step 3:** Restart the API. Expected log: `N precached`. Replay the path: tips appear instantly with the "cached" badge.
- [ ] **Step 4: Commit** `git add server/precache.json && git commit -m "data: precached demo replies (labelled cached)"`

### ✅ Gate M2 (H10)
- [ ] `docs/test-log.md`: every letter in `PRACTICEABLE` scores ≥ 8/10.
- [ ] 2.1–2.4 play with contrast, practice words and review.
- [ ] "Spell LILY" unlocks after the point family and plays.
- [ ] Same mistake twice → a different cue; 3rd time → reference beside the live hand.
- [ ] Progress shows mastered letters, weak letters and weak fingers. Merge, push, standup.

---

## M3 · Greetings (by H14)

### Task 8: Word pack + H12 decisions
- [ ] **Step 1: Word pack.** On `#/curriculum` with the saved profile, lesson 3.6 "Words for your coworker" lists the Gemini-picked signs (stretch). Check that every one exists in `SIGNS`; the server's enum guarantees this, so the check just confirms the wiring.
- [ ] **Step 2: Interviews (H12, human).** Talk to 5+ people at the venue using the 5 questions in the doc, and log every answer in `docs/notes.md` → Interviews. Get ≥ 1 quote from someone who signs or is learning, and use it to replace `[NEEDS: quote]` in the problem statement. **Decision rule:** if ≥ 3 of 5 say production feedback isn't what beginners need, narrow the pitch to "your first handshapes and names" and lead What's next with reading practice.
- [ ] **Step 3: n8n (H12).** Only if Gate M2 passed: decide whether to build session results → webhook → summary email. Log the decision in `docs/notes.md`. If yes, the summary contains letters and counts only, never names.
- [ ] **Step 4: Personalization cut (H12).** If doc items a, d, e or f aren't working, keep b (mistake memory) and c (practice order) and move the rest to What's next. Tell the team.

### ✅ Gate M3 (H14)
- [ ] 3.1 and 3.2 play end to end.
- [ ] Each sign ≥ 4/5 in `docs/test-log.md`, or `SIGNS_AUTO = false`.
- [ ] Accessibility checklist complete (Group 2). Merge, push, standup.

---

## M4 · Conversation (by H16 → freeze)

### Task 9: Devpost draft (H16)
- [ ] Starting from the spec's problem statement, write on Devpost: problem statement, solution, impact statement, scope we state openly ("matches the reference", static letters + 4 assisted signs), the research behind the scope, the honest competition (Signiq) and our difference.
- [ ] Gemini usage: personalized path from letters only, adaptive coach rewording landmark feedback, practice words with an enum-constrained schema, and cached replies labelled. Add the snapshot disclosure only if it was kept.

### ✅ Gate M4 (H16)
- [ ] Scene 4.1 runs in under 90 s on the demo laptop.
- [ ] `git tag freeze` (Ryan). From here on: polish and bug fixes only.

---

## Ship (H16 → H24)

### Task 10: Pitch and submission
- [ ] **H18:** Slides: problem → person → demo → why different → impact → what's next (reading practice, whole signs via ASL-LEX / ASL Citizen, facial grammar, SignGemma if released).
- [ ] **H20:** Record a backup demo video (≤ 4 min) of the full path: onboarding → name → LILY → HELLO → scene.
- [ ] **H21:** Submit on Devpost: repo link, Figma link ("anyone can view"), video, and opt-ins for all 5 prizes. Work through the doc's submission checklist; claim only what shipped.
- [ ] **H23:** Rehearse the pitch 3× with a timer. Prepare answers to likely judge questions: "Is it correct ASL?" (matches our reference, checked by a fluent signer), "Where do names go?" (nowhere: letters only), "Why not full signs?" (ASL Citizen baseline 63%), and "How is this different from Signiq?".
