import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Progress journal spreads 1 and 2 render empty and filled states", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const saved = new Map();
  saved.set("handshake.profile.v1", JSON.stringify({ userName: "Ryan", theirName: "Lily", leftHanded: false }));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) } });
  try {
    const { ProgressScreen } = await vite.ssrLoadModule("/src/screens/Progress.tsx");
    const render = () => renderToStaticMarkup(createElement(ProgressScreen));
    const empty = render();
    assert.match(empty, /<h1[^>]*>[^<]*0<!-- --> of <!-- -->\d+<!-- --> lessons done|<h1[^>]*>0 of \d+ lessons done/);
    assert.match(empty, /No tries yet/);
    assert.match(empty, /Nothing here yet\. Practise a lesson and this page fills in\./);
    assert.match(empty, /reward-dawn/);
    assert.doesNotMatch(empty, /NaN/);

    const item = (attempts, misses, mastered, streak, box) => ({ attempts, misses, mastered, streak, box, due: 0 });
    saved.set("handshake.progress.v1", JSON.stringify({ xp: 30, streakDays: 2, lastActiveDay: null, completed: ["1.1"], items: { L: item(12, 1, true, 3, 2), B: item(5, 2, false, 2, 1) } }));
    const full = render();
    assert.match(full, /11 of 12/);
    assert.match(full, /B is 1 away from mastered/);
    assert.match(full, /aria-label="L, matches the reference"/);
    assert.match(full, /Practise next: /);
    assert.doesNotMatch(full, /NaN/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
    await vite.close();
  }
});
