import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPrecache } from "./precache.mjs";
import { createApp } from "./app.mjs";
import { serve } from "./testutil.mjs";

test("bundled mock file serves labelled coach and word replies without a key", async (t) => {
  const precache = loadPrecache();
  assert.ok(Object.keys(precache).length > 0);
  const server = await serve((app) => app.use(createApp({ precache })));
  t.after(() => server.close());
  const coach = await server.post("/api/coach", { target: "L", feedback: [], repeat: 1 });
  assert.deepEqual(coach.body, { tip: "Compare your hand with the L reference and hold still.", cached: true });
  const words = await server.post("/api/words", { knownLetters: ["L", "I", "Y"], weakLetters: ["L"] });
  assert.deepEqual(words.body, { words: ["LILY", "ILL"], cached: true });
});

test("loader reads response entries from disk", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "handshake-precache-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "precache.json");
  writeFileSync(file, '{"words:LIY:L":{"words":["ILL"]}}');
  assert.deepEqual(loadPrecache(file), { "words:LIY:L": { words: ["ILL"] } });
});

test("loader tolerates missing, malformed and non-object files", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "handshake-precache-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "precache.json");
  const warnings = [];
  const warn = (message) => warnings.push(message);
  assert.deepEqual(loadPrecache(file, warn), {});
  assert.equal(warnings.length, 0);
  for (const content of ["{broken", "null", "[]", '"text"', "42"]) {
    writeFileSync(file, content);
    assert.deepEqual(loadPrecache(file, warn), {});
  }
  assert.equal(warnings.length, 5);
});
