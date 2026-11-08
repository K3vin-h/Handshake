import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Complete reads saved completion and never awards XP on navigation or reload", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const saved = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  try {
    const { expand, LessonPlayer } = await vite.ssrLoadModule("/src/screens/LessonPlayer.tsx");
    const { inFrame } = await vite.ssrLoadModule("/src/cv/useLetterCheck.ts");
    assert.equal(inFrame({ landmarks: [] }), false);
    assert.equal(inFrame({ landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })) }), true);
    assert.equal(inFrame({ landmarks: Array.from({ length: 21 }, () => ({ x: 0, y: 0.5, z: 0 })) }), false);
    const blank = { xp: 0, streakDays: 0, lastActiveDay: null, completed: [], items: {} };
    const items = expand([{ kind: "spell", word: "LILY", showReference: false }], blank);
    assert.equal(items.length, 4);
    assert.ok(items.every((item) => item.kind === "check")); // L, I, Y are live letters (src/cv/practiceable.ts)
    assert.doesNotMatch(renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "2.1" })), /<video/);
    assert.match(renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "2.1" })), /Locked/);
    // Units 3 (greetings) and 4 (scene 4.1) are in scope: they exist but stay locked until the lessons before them are done.
    assert.match(renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "3.1" })), /Locked/);
    assert.match(renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "4.1" })), /Locked/);
    assert.match(renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "5.1" })), /Lesson not found/);
    // Every static letter is live (src/cv/practiceable.ts), so lesson 1.1 (RYAN) opens with a live check of R and the camera.
    const firstLesson = renderToStaticMarkup(createElement(LessonPlayer, { lessonId: "1.1" }));
    assert.match(firstLesson, /Sign R/);
    assert.match(firstLesson, /<video/);
    // The whole static alphabet is live and taught in a demo lesson; J and Z move, so they are never live.
    const { PRACTICEABLE } = await vite.ssrLoadModule("/src/cv/practiceable.ts");
    const { buildCurriculum } = await vite.ssrLoadModule("/src/lib/curriculum.ts");
    const taught = new Set(buildCurriculum({ userName: "Ryan", theirName: "Lily" }).flatMap((u) => u.lessons).filter((l) => l.scope === "demo").flatMap((l) => l.teaches ?? []));
    for (const letter of "ABCDEFGHIKLMNOPQRSTUVWXY") {
      assert.ok(PRACTICEABLE.includes(letter), `${letter} is live`);
      assert.ok(taught.has(letter), `${letter} is in a demo lesson`);
    }
    assert.ok(!PRACTICEABLE.includes("J") && !PRACTICEABLE.includes("Z"));
    const { Complete } = await vite.ssrLoadModule("/src/screens/Complete.tsx");
    const render = (lessonId) => renderToStaticMarkup(createElement(Complete, { lessonId }));
    assert.match(render("1.1"), /Keep practising/);
    assert.equal(saved.size, 0);
    const progress = { xp: 40, streakDays: 1, lastActiveDay: null, completed: ["1.1"], items: {} };
    saved.set("handshake.progress.v1", JSON.stringify(progress));
    const completed = render("1.1");
    assert.match(completed, /Lesson complete/);
    assert.match(completed, /#\/lesson\/1.2/);
    assert.match(completed, /Total XP<\/dt><dd>40/);
    render("1.1");
    assert.deepEqual(JSON.parse(saved.get("handshake.progress.v1")), progress);
    assert.match(render("9.9"), /Lesson unavailable/);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", previous);
    await vite.close();
  }
});
