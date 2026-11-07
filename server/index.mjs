import "dotenv/config";
import { DEFAULT_GEMINI_MODEL } from "./gemini.mjs";
import { loadPrecache } from "./precache.mjs";
import { GoogleGenAI } from "@google/genai";
import { createApp } from "./app.mjs";
import { registerIntegrations } from "./integrations.mjs";
import express from "express";
import { fileURLToPath } from "node:url";

const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const precache = loadPrecache();
const snapshot = process.env.SNAPSHOT_ENABLED === "1";
const port = Number(process.env.PORT) || 8787;

// Register attempt ingestion before Gemini's global JSON parser so even bad JSON is rate-limited.
const app = express();
const { db } = registerIntegrations(app);
app.use(createApp({ ai, model, precache, snapshot, cacheExport: process.env.CACHE_EXPORT_ENABLED === "1" }));
if (process.env.SERVE_STATIC === "1") {
  app.use(express.static(fileURLToPath(new URL("../dist/", import.meta.url))));
}
app.use((error, _req, res, next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "bad_request" });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "body_too_large" });
  console.error("Unhandled request error.");
  res.status(error.status || 500).json({ error: "server_error" });
});
const server = app.listen(port, process.env.SERVE_STATIC === "1" ? "127.0.0.1" : undefined, () =>
  console.log(`API on http://localhost:${port} (${ai ? `Gemini ${model}` : "mock mode: no GEMINI_API_KEY"}, ${Object.keys(precache).length} precached, snapshot ${snapshot ? "on" : "off"})`),
);

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    try { await db?.close(); }
    catch { console.error("Database shutdown failed."); process.exitCode = 1; }
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
