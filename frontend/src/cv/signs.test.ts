import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMovement, SIGNS } from "./signs.ts";

// A salute seen from the front: the hand travels outward along the image's x axis, level or slightly down.
const salute = (dy: number) => Array.from({ length: 12 }, (_, i) => ({ t: i * 50, x: 0.3 + i * 0.015, y: 0.2 + (i * dy) / 11, size: 0.2 }));

test("HELLO's salute is accepted whether the camera sees it level, down or up", () => {
  for (const dy of [0, 0.03, -0.06]) {
    const m = classifyMovement(salute(dy));
    assert.ok(m === SIGNS.HELLO.movement || SIGNS.HELLO.alsoMovement?.includes(m), `dy ${dy} classified as ${m}`);
  }
});

import { SignChecker } from "./signs.ts";
const hand = (y: number, x = 0.5) => ({ landmarks: Array.from({ length: 21 }, (_, i) => ({ x, y: y + (i === 9 ? 0.05 : 0), z: 0 })) }) as never;
const pred = (letter: string | null) => ({ letter, confidence: 1, distance: 0 });

test("a one-frame recognizer flicker does not send HELLO back to step 1, and the hint says what is wrong", () => {
  const c = new SignChecker(SIGNS.HELLO);
  assert.match(c.update(hand(0.7), pred("B"), 0).message, /forehead/);
  c.update(hand(0.2), pred("B"), 100);
  assert.equal(c.update(hand(0.2), pred("B"), 200).stage, "position");
  assert.equal(c.update(hand(0.2), pred("A"), 300).message, "Hold it there…"); // flicker
  assert.equal(c.update(hand(0.2), pred("B"), 500).stage, "movement");
  assert.match(new SignChecker(SIGNS.HELLO).update(hand(0.2), pred("A"), 0).message, /I see a A/);
});

import { zoneOf } from "./signs.ts";
test("zones follow the face: a low-sitting learner's forehead is not the top of the frame", () => {
  const face = { top: 0.45, chin: 0.75, cx: 0.5 }; // head sits low in the frame
  assert.equal(zoneOf(hand(0.5), face), "forehead"); // fixed zones would call y=0.5 "chest"
  assert.equal(zoneOf(hand(0.5)), "chest");
  assert.equal(zoneOf(hand(0.78), face), "chin");
  assert.equal(zoneOf(hand(0.95), face), "chest");
});

test("BYE (a wave in the open) passes from the middle of the frame, not only at the frame edge", () => {
  const c = new SignChecker(SIGNS.BYE);
  let r = c.update(hand(0.4), pred("5"), 0);
  r = c.update(hand(0.4), pred("5"), 100);
  r = c.update(hand(0.4), pred("5"), 500);
  assert.equal(r.stage, "movement");
  for (let i = 0; i < 20; i++) r = c.update(hand(0.4, 0.4 + (i % 4 < 2 ? 0.06 : -0.06)), pred("5"), 600 + i * 50);
  assert.equal(r.stage, "done");
});
