import { createHash, randomBytes } from "node:crypto";

export const COOKIE = "hs_session";
export const SESSION_DAYS = 30;
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t) => createHash("sha256").update(String(t)).digest();

export function readCookie(header, name) {
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export const cookieHeader = (token, { secure = false, maxAgeSec = SESSION_DAYS * 86400 } = {}) =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
export const clearCookie = (secure) => cookieHeader("", { secure, maxAgeSec: 0 });

// CSRF: a browser always sends Origin on cross-site POSTs. SPA and API share one origin, so hosts must match.
// Behind the Vercel /api rewrite, Host is the API host and X-Forwarded-Host is the site the browser saw.
// That header counts only when Express `trust proxy` is on (TRUST_PROXY_HOPS); only its first value is used.
export function sameOrigin(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* not a URL */ }
    const fwd = req.app?.get("trust proxy") ? String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim() : "";
    if (host !== (fwd || req.headers.host)) return res.status(403).json({ error: "forbidden" });
  }
  next();
}

export const requireUser = (db, now = () => new Date()) => async (req, res, next) => {
  const token = readCookie(req.headers.cookie, COOKIE);
  let user = null;
  try { user = token && db ? await db.sessionUser(hashToken(token), now()) : null; } catch { /* treated as signed out */ }
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  req.user = user;
  next();
};
