import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { planSession } from "./plan.mjs";

const { AGENT_TOKEN, GEMINI_API_KEY, APP_URL, GEMINI_MODEL = "gemini-3.6-flash", PORT = 8080 } = process.env;
if (!AGENT_TOKEN || !GEMINI_API_KEY || !APP_URL) {
  console.error("AGENT_TOKEN, GEMINI_API_KEY and APP_URL are required");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MAX_BODY = 20_000;
let active = 0;

const authorized = (header = "") => {
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${AGENT_TOKEN}`);
  return a.length === b.length && timingSafeEqual(a, b);
};

http
  .createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
    if (req.method !== "POST" || req.url !== "/plan") return send(404, { error: "not_found" });
    if (!authorized(req.headers.authorization)) return send(401, { error: "unauthorized" });
    if (active >= 4) return send(429, { error: "busy" });
    active++;
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > MAX_BODY) return send(413, { error: "too_large" });
      }
      let body;
      try { body = JSON.parse(raw); } catch { return send(400, { error: "bad_request" }); }
      const { learnerId, candidates, knownLetters } = body ?? {};
      const letters = (a) => Array.isArray(a) && a.length <= 26 && a.every((l) => typeof l === "string" && /^[A-Z]$/.test(l));
      if (typeof learnerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(learnerId) ||
          !Array.isArray(candidates) || candidates.length < 1 || candidates.length > 20 ||
          !candidates.every((c) => c && typeof c.id === "string" && /^\d+\.\d+$/.test(c.id) && letters(c.letters)) || !letters(knownLetters)) {
        return send(400, { error: "bad_request" });
      }
      send(200, await planSession({ ai, model: GEMINI_MODEL, appUrl: APP_URL, learnerId, candidates, knownLetters }));
    } catch (e) {
      console.error("Planner request failed.");
      send(502, { error: "agent_failed" });
    } finally { active--; }
  })
  .listen(Number(PORT), "0.0.0.0", () => console.log(`planner agent on :${PORT}`));
