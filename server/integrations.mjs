import { createDb } from "./db.mjs";
import { register as registerAttempts } from "./routes/attempts.mjs";

export function registerIntegrations(app, env = process.env) {
  const db = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  // Production is loopback-only behind one Caddy hop (see index.mjs).
  if (env.SERVE_STATIC === "1") app.set("trust proxy", 1);
  registerAttempts(app, { db });
  // Other sponsor integrations are not implemented by the Tiger Data task.
  app.get("/api/features", (_req, res) => res.json({ stats: !!db, notify: false, agent: false }));
  return { db };
}
