import express from "express";
import { rateLimit } from "../limit.mjs";
import { isEmail } from "../validate.mjs";
import { hashPassword, verifyPassword, DUMMY_HASH, MIN_PASSWORD, MAX_PASSWORD } from "../password.mjs";
import { newToken, hashToken, cookieHeader, clearCookie, readCookie, COOKIE, sameOrigin, SESSION_DAYS } from "../session.mjs";

const DAY = 86_400_000;
const bad = (res, error = "bad_request") => res.status(400).json({ error });
const norm = (e) => String(e ?? "").trim().toLowerCase();
const strong = (p) => typeof p === "string" && p.length >= MIN_PASSWORD && p.length <= MAX_PASSWORD;
const publicUser = (u) => ({ email: u.email, hasPassword: !!u.password_hash, google: !!u.google_sub });

export function register(app, { db, verifyGoogle, sendResetEmail, googleClientId = null, appOrigin = null, secure = false, now = Date.now }) {
  const json = express.json({ limit: "20kb" });
  const needDb = (_req, res, next) => (db ? next() : res.status(503).json({ error: "accounts_unavailable" }));
  const resetEnabled = !!(db && appOrigin && sendResetEmail);

  async function startSession(res, userId) {
    const token = newToken();
    await db.createSession(hashToken(token), userId, new Date(now() + SESSION_DAYS * DAY));
    res.append("Set-Cookie", cookieHeader(token, { secure }));
  }
  const fail = (res) => { console.error("Accounts unavailable."); res.status(503).json({ error: "accounts_unavailable" }); };

  app.get("/api/auth/config", (_req, res) =>
    res.json({ accounts: !!db, googleClientId: db ? googleClientId : null, resetEmail: resetEnabled }));

  app.post("/api/auth/signup", sameOrigin, rateLimit({ windowMs: 3_600_000, max: 10 }), json, needDb, async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!isEmail(email)) return bad(res);
    if (!strong(password)) return bad(res, "weak_password");
    try {
      const user = await db.createUser({ email: norm(email), passwordHash: await hashPassword(password) });
      if (!user) return res.status(409).json({ error: "email_taken" });
      await startSession(res, user.id);
      res.status(201).json({ user: publicUser(user) });
    } catch { fail(res); }
  });

  const perEmail = (windowMs, max) => rateLimit({ windowMs, max, key: (req) => norm(req.body?.email) || req.ip });

  app.post("/api/auth/login", sameOrigin, rateLimit({ windowMs: 600_000, max: 10 }), json, perEmail(600_000, 10), needDb, async (req, res) => {
    const { email, password } = req.body ?? {};
    try {
      const user = isEmail(email) ? await db.findUserByEmail(norm(email)) : null;
      // Always run one scrypt, so timing does not reveal whether the email has an account.
      const ok = await verifyPassword(typeof password === "string" ? password.slice(0, MAX_PASSWORD) : "", user?.password_hash ?? DUMMY_HASH);
      if (!user || !user.password_hash || !ok) return res.status(401).json({ error: "invalid_credentials" });
      await startSession(res, user.id);
      res.json({ user: publicUser(user) });
    } catch { fail(res); }
  });

  app.post("/api/auth/google", sameOrigin, rateLimit({ windowMs: 600_000, max: 30 }), json, needDb, async (req, res) => {
    const { credential } = req.body ?? {};
    if (typeof credential !== "string" || credential.length > 4096) return bad(res);
    const g = googleClientId && verifyGoogle ? await verifyGoogle(credential, googleClientId).catch(() => null) : null;
    if (!g || !g.emailVerified || !isEmail(g.email)) return res.status(401).json({ error: "invalid_token" });
    try {
      const email = norm(g.email);
      let user = await db.findUserByGoogleSub(g.sub);
      let isNew = false;
      if (!user) {
        const existing = await db.findUserByEmail(email);
        if (existing?.google_sub) {
          // Already tied to a different Google identity: match by sub only, never by email alone.
          return res.status(401).json({ error: "invalid_token" });
        } else if (existing) {
          // Linking rule: Google verified this address. If the password account never verified it, drop its
          // password and end its live sessions first, so a squatter who registered the address cannot keep access.
          const clearPassword = !existing.email_verified_at;
          if (clearPassword) await db.deleteUserSessions(existing.id);
          user = await db.linkGoogle(existing.id, g.sub, { clearPassword });
        } else {
          user = await db.createUser({ email, googleSub: g.sub, verified: true });
          isNew = true;
        }
      }
      if (!user) return fail(res);
      await startSession(res, user.id);
      res.json({ user: publicUser(user), isNew });
    } catch { fail(res); }
  });

  app.post("/api/auth/logout", sameOrigin, async (req, res) => {
    const token = readCookie(req.headers.cookie, COOKIE);
    if (token && db) { try { await db.deleteSession(hashToken(token)); } catch { /* cookie is cleared anyway */ } }
    res.append("Set-Cookie", clearCookie(secure));
    res.sendStatus(204);
  });

  app.post("/api/auth/forgot", sameOrigin, rateLimit({ windowMs: 3_600_000, max: 10 }), json, perEmail(3_600_000, 3), needDb, async (req, res) => {
    res.status(202).json({ ok: true }); // identical answer whether or not the account exists
    const { email } = req.body ?? {};
    if (!resetEnabled || !isEmail(email)) return;
    try {
      const user = await db.findUserByEmail(norm(email));
      if (!user) return;
      const token = newToken();
      await db.createReset(hashToken(token), user.id, new Date(now() + 30 * 60_000));
      await sendResetEmail({ to: user.email, link: `${appOrigin}/#/reset/${token}` });
    } catch { console.error("Password reset email failed."); }
  });

  app.post("/api/auth/reset", sameOrigin, rateLimit({ windowMs: 600_000, max: 20 }), json, needDb, async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || token.length > 100) return bad(res, "invalid_token");
    if (!strong(password)) return bad(res, "weak_password");
    try {
      const userId = await db.consumeReset(hashToken(token), new Date(now()));
      if (!userId) return bad(res, "invalid_token");
      await db.setPassword(userId, await hashPassword(password));
      await db.deleteUserSessions(userId);
      res.sendStatus(204);
    } catch { fail(res); }
  });
}
