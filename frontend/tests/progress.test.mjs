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

test("Progress journal spreads 3 and 4 (my hands, review plan)", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const saved = new Map();
  saved.set("handshake.profile.v1", JSON.stringify({ userName: "Ryan", theirName: "Lily", leftHanded: false }));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) } });
  try {
    const { ProgressScreen } = await vite.ssrLoadModule("/src/screens/Progress.tsx");
    const render = () => renderToStaticMarkup(createElement(ProgressScreen));
    const prog = (items) => saved.set("handshake.progress.v1", JSON.stringify({ xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items }));
    const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // no mistakes, nothing due
    const empty = render();
    assert.match(empty, /No finger differences recorded yet\. Practise a lesson and they will appear here\./);
    assert.match(empty, /Nothing is due today\./);
    assert.match(empty, /How often the camera measured each finger away from the reference\. Fewer is better\./);
    assert.doesNotMatch(empty, /NaN/);

    // mistakes
    saved.set("handshake.mistakes.v1", JSON.stringify({ D: { "index:curl": { count: 4, lastAt: 1 } }, Y: { "index:curl": { count: 1, lastAt: 1 } } }));
    const m = text(render());
    assert.match(m, /index 5 differences/);
    assert.match(m, /Most often: index finger curl on D and Y/);
    assert.match(m, /curl[^a-z]+5/);
    assert.doesNotMatch(m, /No finger differences recorded yet/);
    assert.doesNotMatch(m, /NaN/);

    // due today, singular
    const item = (box, due) => ({ attempts: 3, misses: 0, mastered: false, streak: 2, box, due });
    prog({ L: item(0, Date.now() - 1000) });
    const due = render();
    const dt = text(due);
    assert.match(dt, /Due today/);
    assert.match(dt, /1 letter is due for a quick review\./);
    assert.match(due, /aria-label="L, due today"/);
    assert.doesNotMatch(due, /NaN/);

    // plural + coming up + box counts as text
    const future = (d) => Date.now() + d * 86_400_000 + 3_600_000;
    prog({ L: item(0, 0), B: item(0, 0), K: item(1, future(1)), V: item(2, future(3)), W: item(3, future(7)), A: item(4, future(10)) });
    const t = text(render());
    assert.match(t, /2 letters are due for a quick review\./);
    assert.match(t, /Tomorrow K/);
    assert.match(t, /In 3 days V/);
    assert.match(t, /In a week W/);
    assert.match(t, /2 letters today/);
    assert.match(t, /1 letter 14 days/);
    assert.match(t, /A letter moves up a box each time it matches the reference, and drops back to today on a miss\./);
    assert.doesNotMatch(t, /NaN/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
    await vite.close();
  }
});
