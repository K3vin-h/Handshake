// Teammate B owns this file. Keeps the Gemini key on the server.
// Without GEMINI_API_KEY it returns mock data, so the frontend works offline.
import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json({ limit: "5mb" })); // snapshots are base64 images

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

/** Calls Gemini and parses a JSON reply. `image` is an optional base64 JPEG. */
async function askJson(prompt, image) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.replace(/^data:image\/\w+;base64,/, "") } });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature: 0.7 },
  });
  return JSON.parse(res.text);
}

// Simple cache so repeated demo calls don't burn the free-tier rate limit.
const cache = new Map();
async function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const value = await fn();
  cache.set(key, value);
  return value;
}

// 1. Onboarding: personalize the curriculum (src/lib/curriculum.ts builds the lessons themselves).
// Gemini only CHOOSES from signs the app can teach (`allowedWords`), so it can't invent signs.
const MOCK_PACKS = {
  coworker: ["WORK", "COFFEE", "MEETING"],
  friend: ["FRIEND", "COFFEE"],
  family: ["MOM", "DAD", "LOVE"],
  classmate: ["SCHOOL", "FRIEND"],
  partner: ["LOVE", "COFFEE"],
};

app.post("/api/path", async (req, res) => {
  const { userName = "", learningFor = "", relationship = "friend", allowedWords = [] } = req.body;
  const allowed = new Set(allowedWords);
  const fallback = {
    wordPack: (MOCK_PACKS[relationship] ?? MOCK_PACKS.friend).filter((w) => !allowed.size || allowed.has(w)),
    welcome: `Let's start with your name, ${userName || "friend"}. In a few lessons you'll be saying hello to ${learningFor || "them"}.`,
  };
  if (!ai) return res.json(fallback);
  try {
    const out = await cached(`path:${userName}:${learningFor}:${relationship}`, () =>
      askJson(
        `A hearing beginner named "${userName}" is learning ASL to talk with "${learningFor}", their ${relationship}.
Pick the 3 or 4 signs from this list that would be most useful in their everyday conversations: ${[...allowed].join(", ")}.
Also write one warm welcome sentence (under 25 words) mentioning both names. No emojis.
Return JSON {"wordPack": string[], "welcome": string}. Only use signs from the list, spelled exactly as given.`,
      ),
    );
    // Guard: never return a sign the app can't teach.
    out.wordPack = (out.wordPack || []).filter((w) => allowed.has(w));
    if (!out.wordPack.length) out.wordPack = fallback.wordPack;
    res.json({ ...fallback, ...out });
  } catch (e) {
    console.error(e);
    res.json(fallback); // onboarding must never fail on stage
  }
});

// 2. Coach: turn "what's off" into a friendly, specific tip.
app.post("/api/coach", async (req, res) => {
  const { target, feedback = [], snapshot } = req.body;
  if (!ai) {
    const first = feedback[0];
    return res.json({
      tip: first ? `Almost! Your ${first.finger} is ${first.issue}. Adjust it and hold for a second.` : `Try the ${target} handshape again, palm facing the camera.`,
    });
  }
  try {
    const issues = feedback.map((f) => `${f.finger}: ${f.issue}`).join("; ") || "no clear difference";
    const out = await askJson(
      `You are a kind, concise ASL fingerspelling coach. The learner is trying to sign the letter "${target}".
Measured differences from the correct handshape: ${issues}.
${snapshot ? "A photo of their hand is attached." : ""}
Return JSON {"tip": string}: one or two short sentences, specific and encouraging, telling them exactly what to move. No emojis.`,
      snapshot,
    );
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "gemini_failed" });
  }
});

// 3. Practice: words built from known letters, drilling weak ones.
app.post("/api/words", async (req, res) => {
  const { knownLetters = [], weakLetters = [] } = req.body;
  if (!ai) return res.json({ words: ["BOY", "LILY", "DOLL", "WILD"] });
  try {
    const out = await cached(`words:${knownLetters.join("")}:${weakLetters.join("")}`, () =>
      askJson(
        `Generate 6 real, common English words for ASL fingerspelling practice.
Use ONLY these letters: ${knownLetters.join(",")}. Prefer words containing: ${weakLetters.join(",") || "any"}.
3 to 5 letters each, uppercase. Return JSON {"words": string[]}.`,
      ),
    );
    // Guard against Gemini sneaking in letters the user hasn't learned.
    const allowed = new Set(knownLetters);
    out.words = (out.words || []).filter((w) => [...w].every((c) => allowed.has(c)));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "gemini_failed" });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`API on http://localhost:${port} (${ai ? `Gemini ${MODEL}` : "mock mode: no GEMINI_API_KEY"})`));
