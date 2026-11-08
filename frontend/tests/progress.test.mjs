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
    assert.match(empty, /<h1[^>]*>[^<]*0 of \d+ lessons done/);
    assert.match(empty, /aria-label="Lessons done"[^>]*aria-valuenow="0"/);
    assert.match(empty, /Your first page is waiting\. Finish a lesson to write it down\./);
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

    // attempts-0 mastered item: not listed, no NaN
    saved.set("handshake.progress.v1", JSON.stringify({ xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: { Q: item(0, 0, true, 3, 1) } }));
    const zero = render();
    assert.doesNotMatch(zero, /NaN/);
    assert.doesNotMatch(zero, /Q<\/span>[^<]*matches the reference most/);
    assert.match(zero, /Nothing is giving you trouble right now\./);

    // next lesson locked: complete 1.2 only so the first incomplete (1.1) ... use a state where 1.1 is not done but 1.2 is
    saved.set("handshake.progress.v1", JSON.stringify({ xp: 0, streakDays: 0, lastActiveDay: null, completed: ["1.1"], items: {} }));
    const mid = render();
    assert.doesNotMatch(mid, /finished every lesson/);

    // everything done
    const { buildCurriculum } = await vite.ssrLoadModule("/src/lib/curriculum.ts");
    const demo = buildCurriculum({ userName: "Ryan", theirName: "Lily" }).flatMap((u) => u.lessons).filter((l) => l.scope === "demo");
    const items = {};
    for (const l of demo) for (const c of l.teaches ?? []) items[c] = item(6, 0, true, 3, 3);
    saved.set("handshake.progress.v1", JSON.stringify({ xp: 99, streakDays: 3, lastActiveDay: null, completed: demo.map((l) => l.id), items }));
    const done = render();
    assert.match(done, /You finished every lesson that is available right now\./);
    assert.match(done, /Nothing is giving you trouble right now\./);
    assert.match(done, /mastered: 3 in a row/);
    assert.doesNotMatch(done, /NaN/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
    await vite.close();
  }
});
