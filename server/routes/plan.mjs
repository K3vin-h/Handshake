import express from "express";
import { rateLimit } from "../limit.mjs";
import { UUID_RE, LESSON_RE, isLetters } from "../validate.mjs";

const LOCAL_TIP = "Short, steady practice beats a long session. Take your time with each handshape.";
const MAX_TIP = 200;
const AGENT_TIMEOUT_MS = 8000;
const bad = (res) => res.status(400).json({ error: "bad_request" });

function localPlan({ candidates, knownLetters, weakLetters }) {
  const known = new Set(knownLetters);
  return { lessonId: candidates[0].id, focus: weakLetters.filter((l) => known.has(l)).slice(0, 3), words: [], tip: LOCAL_TIP, source: "local" };
}

// The agent is an LLM: accept its reply only if it picks a real candidate and stays inside what the learner knows.
function guardAgentPlan(raw, { candidates, knownLetters }) {
  if (!raw || typeof raw !== "object") return null;
  const known = new Set(knownLetters);
  const { lessonId, focus, words, tip } = raw;
  if (!candidates.some((c) => c.id === lessonId)) return null;
  if (!isLetters(focus, 3) || !focus.every((l) => known.has(l))) return null;
  if (!Array.isArray(words) || words.length > 6) return null;
  if (!words.every((w) => typeof w === "string" && /^[A-Z]{2,8}$/.test(w) && [...w].every((c) => known.has(c)))) return null;
  if (typeof tip !== "string" || !tip.trim()) return null;
  return { lessonId, focus, words, tip: tip.slice(0, MAX_TIP), source: "agent" };
}

export function register(app, { agent, fetch: f = fetch }) {
  app.post("/api/plan", rateLimit({ windowMs: 60_000, max: 20 }), express.json({ limit: "16kb" }), async (req, res) => {
    const { learnerId, candidates, knownLetters, weakLetters = [] } = req.body ?? {};
    const valid =
      UUID_RE.test(learnerId) && Array.isArray(candidates) && candidates.length >= 1 && candidates.length <= 20 &&
      candidates.every((c) => c && LESSON_RE.test(c.id) && isLetters(c.letters, 26)) &&
      isLetters(knownLetters, 26) && isLetters(weakLetters, 26);
    if (!valid) return bad(res);
    // Rebuild each candidate so no extra client field (a title, a name) can reach the agent.
    const input = { candidates: candidates.map((c) => ({ id: c.id, letters: c.letters })), knownLetters, weakLetters };
    if (!agent) return res.json(localPlan(input));
    try {
      const r = await f(agent.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.token}` },
        body: JSON.stringify({ learnerId, candidates: input.candidates, knownLetters }),
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`agent ${r.status}`);
      res.json(guardAgentPlan(await r.json(), input) ?? localPlan(input));
    } catch (e) {
      console.error("Planner agent unavailable; using local plan.");
      res.json(localPlan(input));
    }
  });
}
