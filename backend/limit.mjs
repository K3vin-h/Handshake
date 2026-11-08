// Fixed-window limiter, per req.ip by default (or per `key(req)`). Behind proxies Express trusts TRUST_PROXY_HOPS hops (see backend/integrations.mjs); verify req.ip is the visitor.
export function rateLimit({ windowMs, max, now = Date.now, key = (req) => req.ip }) {
  const hits = new Map();
  return (req, res, next) => {
    const t = now();
    const k = key(req);
    if (hits.size >= 5000) for (const [id, h] of hits) if (t - h.start >= windowMs) hits.delete(id);
    const h = hits.get(k);
    if (!h || t - h.start >= windowMs) {
      if (!h && hits.size >= 5000) return res.status(429).json({ error: "rate_limited" });
      hits.set(k, { start: t, n: 1 });
      return next();
    }
    if (h.n >= max) return res.status(429).json({ error: "rate_limited" });
    h.n++;
    next();
  };
}
