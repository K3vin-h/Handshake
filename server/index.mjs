import "dotenv/config";
import { DEFAULT_GEMINI_MODEL } from "./gemini.mjs";
import { existsSync, readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { createApp } from "./app.mjs";
import { registerIntegrations } from "./integrations.mjs";
import express from "express";

const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const file = new URL("./precache.json", import.meta.url);
let precache = {};
try {
  precache = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  if (!precache || typeof precache !== "object" || Array.isArray(precache)) precache = {};
} catch {
  console.warn("Precache could not be loaded; starting with live generation and local fallbacks.");
}
const snapshot = process.env.SNAPSHOT_ENABLED === "1";
const port = Number(process.env.PORT) || 8787;

// Register attempt ingestion before Gemini's global JSON parser so even bad JSON is rate-limited.
const app = express();
const { db } = registerIntegrations(app);
app.use(createApp({ ai, model, precache, snapshot, cacheExport: process.env.CACHE_EXPORT_ENABLED === "1" }));
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
