import { register as registerNotify } from "./routes/notify.mjs";
import { register as registerPlan } from "./routes/plan.mjs";
import { createDb } from "./db.mjs";
import { register as registerAttempts } from "./routes/attempts.mjs";

export function registerIntegrations(app, env = process.env) {
  const db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  // Production: Vercel rewrite -> Caddy -> Express, so TRUST_PROXY_HOPS=2 makes req.ip the visitor (see backend/deploy/README.md).
  const hops = Number(env.TRUST_PROXY_HOPS);
  if (Number.isInteger(hops) && hops > 0) app.set("trust proxy", hops);
  registerAttempts(app, { db });
  const n8n = env.N8N_SUBSCRIBE_URL && env.N8N_EVENT_URL && env.N8N_SECRET
    ? { subscribeUrl: env.N8N_SUBSCRIBE_URL, eventUrl: env.N8N_EVENT_URL, secret: env.N8N_SECRET } : null;
  const agent = env.MARITIME_AGENT_URL && env.MARITIME_AGENT_TOKEN
    ? { url: env.MARITIME_AGENT_URL, token: env.MARITIME_AGENT_TOKEN } : null;
  registerNotify(app, { n8n });
  registerPlan(app, { agent });
  app.get("/api/features", (_req, res) => res.json({ stats: !!db, notify: !!n8n, agent: !!agent }));
  return { db };
}
