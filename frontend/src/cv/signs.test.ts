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
