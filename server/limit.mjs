// Fixed-window per-IP limiter. In production Express trusts one proxy hop (Caddy), so req.ip is the real client.
export function rateLimit({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  return (req, res, next) => {
    const t = now();
    if (hits.size >= 5000) for (const [ip, h] of hits) if (t - h.start >= windowMs) hits.delete(ip);
    const h = hits.get(req.ip);
    if (!h || t - h.start >= windowMs) {
      if (!h && hits.size >= 5000) return res.status(429).json({ error: "rate_limited" });
      hits.set(req.ip, { start: t, n: 1 });
      return next();
    }
    if (h.n >= max) return res.status(429).json({ error: "rate_limited" });
    h.n++;
    next();
  };
}
