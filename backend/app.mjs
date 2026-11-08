// Teammate B owns this file. Gemini coaches and personalizes; it never judges signs and never sees names.
import express from "express";
import { DEFAULT_GEMINI_MODEL, generateWithRetry } from "./gemini.mjs";
import { Type } from "@google/genai";

const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const MOCK_WORDS = ["LILY", "BOY", "DOLL", "WILD", "COLD", "BOLD", "FOIL", "CLAY", "BODY", "IDOL", "FOLD", "VOID", "COW", "LAW", "DAY", "BAY", "OIL"];

const CODE = /^(thumb|index|middle|ring|pinky):(curl|direction|placement)$/;
// Only wording that feedback.ts can produce reaches the prompt (blocks prompt injection via `issue`).
const ISSUE = /^(is (straight|half-curled|fully curled) but should be (straight|half-curled|fully curled)|points (up|down|left|right|diagonally up-left|diagonally up-right) but should point (up|down|left|right|diagonally up-left|diagonally up-right)|is too (far from|close to) the index finger)$/;
const FORBIDDEN = /\b(correct|incorrect)\b/i; // Gemini never judges the sign
const SNAPSHOT = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
const MAX_SNAPSHOT = 200_000; // a 256 px JPEG is ~30 KB of base64

function matchesIssue(f) {
  const kind = f.code.split(":")[1];
  return kind === "curl" ? f.issue.startsWith("is ") && f.issue.includes(" but should be ")
    : kind === "direction" ? f.issue.startsWith("points ")
    : f.finger === "thumb" && f.issue.startsWith("is too ");
}

// Gemini selects only from cues grounded in the measured issue. Free text cannot override CV.
function cuesFor(first, target, repeat) {
  let cue = `Compare your hand with the ${target} reference and hold still.`;
  if (first) {
    if (first.code.endsWith(":curl")) cue = `Make your ${first.finger} ${first.issue.split("should be ")[1]}.`;
    else if (first.code.endsWith(":direction")) cue = `Point your ${first.finger} ${first.issue.split("should point ")[1]}.`;
    else cue = first.issue.includes("too far") ? "Move your thumb a little closer to your index finger." : "Move your thumb a little farther from your index finger.";
  }
  if (repeat === 1) return [cue, `Slowly: ${cue}`];
  if (repeat === 2) return [`Try a smaller adjustment: ${cue}`, `Focus on one change: ${cue}`];
  return [`Compare with the reference beside your camera. ${cue}`, `Look at the reference, then adjust: ${cue}`];
}

const letters = (xs) => [...new Set((Array.isArray(xs) ? xs : []).filter((s) => typeof s === "string").map((s) => s.toUpperCase()).filter((s) => /^[A-Z]$/.test(s)))];

export function createApp({ ai = null, model = DEFAULT_GEMINI_MODEL, precache = {}, snapshot = false, cacheExport = false } = {}) {
  const app = express();
  app.use(express.json({ limit: "300kb" })); // fits one snapshot, nothing bigger
  const cache = new Map(Object.entries(precache && typeof precache === "object" && !Array.isArray(precache) ? precache : {}).slice(-256));

  let activeGenerations = 0;
  let windowStart = Date.now();
  let windowCalls = 0;
  async function askJson(prompt, schema, image) {
    if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); windowCalls = 0; }
    if (activeGenerations >= 4 || windowCalls >= 30) throw new Error("generation budget reached");
    activeGenerations++;
    const parts = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.replace(/^data:image\/jpeg;base64,/, "") } });
    let res;
    try {
      res = await generateWithRetry(ai, {
        model, contents: [{ role: "user", parts }],
        config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7 },
      }, { beforeAttempt: () => {
        if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); windowCalls = 0; }
        if (windowCalls >= 30) throw new Error("generation budget reached");
        windowCalls++;
      } });
    } finally { activeGenerations--; }
    return JSON.parse(res.text);
  }

  // Cache hits (including precache.json) are labelled so the UI can say "cached".
  async function cached(key, fn) {
    if (cache.has(key)) return { ...cache.get(key), cached: true };
    const value = await fn();
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return value;
  }

  // 1. Coach: reword the landmark feedback. Adapts to how often this learner made this mistake.
  app.post("/api/coach", async (req, res) => {
    const target = String(req.body?.target ?? "").toUpperCase();
    if (!/^([A-Z]|5)$/.test(target)) return res.json({ tip: "Choose a letter reference, then compare your hand and hold still.", cached: true });
    const feedback = (Array.isArray(req.body?.feedback) ? req.body.feedback : [])
      .filter((f) => FINGERS.includes(f?.finger) && typeof f?.code === "string" && typeof f?.issue === "string" && CODE.test(f.code) && f.code.startsWith(`${f.finger}:`) && ISSUE.test(f?.issue) && matchesIssue(f))
      .slice(0, 5)
      .map((f) => ({ finger: f.finger, issue: f.issue, code: f.code }));
    const repeat = Math.max(1, Math.min(3, Math.floor(Number(req.body?.repeat)) || 1));
    const s = req.body?.snapshot;
    const image = snapshot && typeof s === "string" && s.length < MAX_SNAPSHOT && SNAPSHOT.test(s) ? s : undefined;
    const first = feedback[0];
    const cues = cuesFor(first, target, repeat);
    const landmark = { tip: cues[0], cached: true };
    const key = `coach:${target}:${first?.code ?? "none"}:${first?.issue ?? ""}:${Math.min(repeat, 3)}`;
    const cacheKey = feedback.length > 1 ? `${key}:${JSON.stringify(feedback.slice(1))}` : key;
    const saved = cache.get(cacheKey);
    if (!image && saved && cues.includes(saved.tip)) return res.json({ tip: saved.tip, cached: true });
    cache.delete(cacheKey);
    if (!ai) return res.json({ tip: cues[0], cached: true });
    const style =
      repeat === 1
        ? "Give one short cue (max 15 words)."
        : repeat === 2
          ? "They made this same mistake before: give a DIFFERENT cue or a comparison to an everyday object (max 25 words)."
          : "They keep making this mistake: the reference is now shown beside their camera; tell them exactly what to compare (max 30 words).";
    try {
      const fn = async () => {
        const out = await askJson(
          `You coach ASL fingerspelling handshapes. Target letter: ${target}.
Measured by hand landmarks (this is the truth; never contradict it): ${feedback.map((f) => `${f.finger} ${f.issue}`).join("; ") || "no clear difference"}.
${image ? "A photo of their hand is attached; use it only to make the cue more specific." : ""}
${style} Say what to move. Never say the sign is correct or incorrect. No emojis.`,
          { type: Type.OBJECT, properties: { tip: { type: Type.STRING, enum: cues } }, required: ["tip"] },
          image,
        );
        // Enforce the grounded cue enum even if the provider ignores its schema.
        if (typeof out.tip !== "string" || !out.tip.trim() || FORBIDDEN.test(out.tip) || !cues.includes(out.tip)) throw new Error("tip failed guard");
        return { tip: out.tip.trim() }; // Cache only the public response.
      };
      res.json(image ? await fn() : await cached(cacheKey, fn)); // photo replies are never cached
    } catch (e) {
      console.warn("Coach or word generation failed; using fallback.");
      res.json(landmark);
    }
  });

  // 3. How to form a letter, from Gemini's general ASL knowledge (not from our recordings). Unverified by a fluent signer,
  //    so the UI says so. Empty text = Gemini unsure or unavailable → the UI shows nothing.
  app.post("/api/explain", async (req, res) => {
    const none = { text: "", cached: true };
    const target = String(req.body?.target ?? "").toUpperCase();
    if (!/^([A-Z]|5)$/.test(target) || !ai) return res.json(none);
    const what = target === "5" ? "the open-hand '5' handshape (the number 5)" : `the ASL fingerspelling letter ${target}`;
    try {
      res.json(await cached(`explain:${target}`, async () => {
        const out = await askJson(
          `Explain to a beginner how to form ${what} in American Sign Language, using your general knowledge of ASL.
Write at most 2 short sentences (max 40 words): say what the fingers and thumb do, and how the palm faces. Plain words, no emojis.
If you are not sure how this handshape is formed, set confident to false and leave text empty. Never invent details.`,
          { type: Type.OBJECT, properties: { text: { type: Type.STRING }, confident: { type: Type.BOOLEAN } }, required: ["text", "confident"] },
        );
        const text = typeof out?.text === "string" ? out.text.trim() : "";
        if (out?.confident !== true || !text || text.length > 320) throw new Error("explain not usable");
        return { text };
      }));
    } catch {
      console.warn("Explain generation failed; showing no how-to.");
      res.json(none);
    }
  });

  // 2. Practice words from known letters only, weak letters first.
  app.post("/api/words", async (req, res) => {
    const known = letters(req.body?.knownLetters);
    const weak = letters(req.body?.weakLetters).filter((l) => known.includes(l));
    const ok = (w) => w.length >= 2 && [...w].every((c) => known.includes(c));
    const weakScore = (w) => [...w].filter((c) => weak.includes(c)).length;
    const fallback = { words: MOCK_WORDS.filter(ok).sort((a, b) => weakScore(b) - weakScore(a)).slice(0, 6), cached: true };
    if (known.length < 2) return res.json(fallback);
    try {
      const key = `words:${known.join("")}:${weak.join("")}`;
      const normalize = (out) => {
        if (!out || !Array.isArray(out.words)) throw new Error("bad words");
        const words = [...new Set(out.words.map((w) => Array.isArray(w) && w.every((c) => typeof c === "string" && /^[A-Z]$/.test(c)) ? w.join("") : typeof w === "string" ? w : ""))]
          .filter((w) => w.length <= 5 && ok(w)).sort((a, b) => weakScore(b) - weakScore(a)).slice(0, 6);
        if (!words.length) throw new Error("no usable words");
        return { words };
      };
      if (cache.has(key)) {
        try { return res.json({ ...normalize(cache.get(key)), cached: true }); }
        catch { cache.delete(key); }
      }
      if (!ai) return res.json(fallback);
      const out = await cached(key, async () => normalize(await askJson(
        `List 6 real, common English words for fingerspelling practice, 3 to 5 letters each, using ONLY these letters: ${known.join(", ")}. Prefer words containing: ${weak.join(", ") || "any"}. Return each word as an array of single letters.`,
        { type: Type.OBJECT, properties: { words: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING, enum: known } } } }, required: ["words"] },
      )));
      res.json(out);
    } catch (e) {
      console.warn("Coach or word generation failed; using fallback.");
      res.json(fallback);
    }
  });

  // Dev: dump the cache to pre-generate demo replies → backend/precache.json (contains no names).
  if (cacheExport) app.get("/api/cache", (_req, res) => res.json(Object.fromEntries(cache)));

  app.use((error, req, res, next) => {
    if (req.path === "/api/coach") return res.json({ tip: "Compare your hand with the reference and hold still.", cached: true });
    if (req.path === "/api/words") return res.json({ words: [], cached: true });
    if (req.path === "/api/explain") return res.json({ text: "", cached: true });
    next(error);
  });
  return app;
}
