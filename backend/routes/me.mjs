import express from "express";
import { rateLimit } from "../limit.mjs";
import { validateState } from "../stateValidate.mjs";
import { sameOrigin, requireUser, clearCookie } from "../session.mjs";

const publicUser = (u) => ({ email: u.email, hasPassword: !!u.password_hash, google: !!u.google_sub });

export function register(app, { db, secure = false }) {
  const needDb = (_req, res, next) => (db ? next() : res.status(503).json({ error: "accounts_unavailable" }));
  const auth = requireUser(db);
  const fail = (res) => { console.error("Accounts unavailable."); res.status(503).json({ error: "accounts_unavailable" }); };

  app.get("/api/me", sameOrigin, needDb, auth, async (req, res) => {
    try { res.json({ user: publicUser(req.user), state: await db.getState(req.user.id) }); } catch { fail(res); }
  });

  app.put("/api/me/state", sameOrigin, needDb, auth, rateLimit({ windowMs: 60_000, max: 60, key: (req) => req.user.id }), express.json({ limit: "100kb" }), async (req, res) => {
    const s = validateState(req.body);
    if (!s) return res.status(400).json({ error: "bad_request" });
    try {
      const r = await db.saveState(req.user.id, s.profile, s.progress, s.baseRev);
      if (r.conflict) return res.status(409).json({ error: "conflict", state: r.state });
      res.json({ rev: r.rev });
    } catch { fail(res); }
  });

  app.delete("/api/me", sameOrigin, needDb, auth, async (req, res) => {
    try {
      await db.deleteUser(req.user.id);
      res.append("Set-Cookie", clearCookie(secure));
      res.sendStatus(204);
    } catch { fail(res); }
  });
}
