// CORS for the Vercel frontend calling this API directly. Only exact origins listed in ALLOWED_ORIGIN
// (comma-separated) get headers; unset means no CORS (same-origin dev through the Vite proxy).
export function cors(allowed = process.env.ALLOWED_ORIGIN) {
  const origins = new Set(String(allowed ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean));
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Max-Age", "600");
        return res.status(204).end();
      }
    }
    next();
  };
}
