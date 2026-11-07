import express from "express";
import { rateLimit } from "../limit.mjs";
import { UUID_RE, LESSON_RE, NAME_RE, isEmail } from "../validate.mjs";

// Lesson titles end up in emails: letters, digits and light punctuation only (no URLs, no line breaks).
const TITLE_RE = /^[\p{L}\p{N} '.,:-]{1,80}$/u;
const bad = (res) => res.status(400).json({ error: "bad_request" });
const limit = () => rateLimit({ windowMs: 60_000, max: 10 });

// Names and emails leave the server only here, only for n8n, only with consent (the client form requires the checkbox).
export function register(app, { n8n, fetch: f = fetch }) {
  async function forward(url, body) {
    try {
      const r = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Handshake-Secret": n8n.secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      return r.ok ? { ok: true } : { ok: false, reason: "upstream" };
    } catch (e) {
      console.error("n8n forwarding unavailable.");
      return { ok: false, reason: "upstream" };
    }
  }

  app.post("/api/subscribe", limit(), express.json({ limit: "16kb" }), async (req, res) => {
    const b = req.body ?? {};
    if (!UUID_RE.test(b.learnerId)) return bad(res);
    let payload;
    if (b.action === "unsubscribe") {
      payload = { action: "unsubscribe", learnerId: b.learnerId };
    } else if (b.action === "subscribe") {
      const names = ["userName", "theirName"].filter((k) => b[k] !== undefined);
      const emails = ["learnerEmail", "contactEmail"].filter((k) => b[k] !== undefined);
      const valid =
        b.consent === true && emails.length > 0 &&
        names.every((k) => typeof b[k] === "string" && NAME_RE.test(b[k])) && emails.every((k) => isEmail(b[k]));
      if (!valid) return bad(res);
      payload = { action: "subscribe", learnerId: b.learnerId };
      for (const k of [...names, ...emails]) payload[k] = b[k];
    } else {
      return bad(res);
    }
    if (!n8n) return res.json({ ok: false, reason: "disabled" });
    res.json(await forward(n8n.subscribeUrl, payload));
  });

  app.post("/api/lesson-complete", limit(), express.json({ limit: "16kb" }), async (req, res) => {
    const { learnerId, lessonId, lessonTitle, xp } = req.body ?? {};
    const valid =
      UUID_RE.test(learnerId) && LESSON_RE.test(lessonId) &&
      typeof lessonTitle === "string" && TITLE_RE.test(lessonTitle) &&
      Number.isInteger(xp) && xp >= 0 && xp <= 1000;
    if (!valid) return bad(res);
    if (!n8n) return res.json({ ok: false, reason: "disabled" });
    res.json(await forward(n8n.eventUrl, { learnerId, lessonId, lessonTitle, xp }));
  });
}
