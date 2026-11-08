import { test } from "node:test";
import assert from "node:assert/strict";
import { handAt, moveOffset, TOTAL_MS, PHASE_MS } from "./signMotion.ts";

const place = [132, 52] as const, rest = [100, 190] as const;

test("the hand starts at rest, reaches the place, then moves, and the loop repeats", () => {
  const a = handAt(place, "away", 0, rest);
  assert.deepEqual([a.x, a.y, a.phase], [100, 190, "approach"]);
  const h = handAt(place, "away", PHASE_MS.approach + 10, rest);
  assert.equal(h.phase, "hold");
  assert.ok(Math.abs(h.x - 132) < 0.01 && Math.abs(h.y - 52) < 0.01);
  const end = handAt(place, "away", TOTAL_MS - 1, rest);
  assert.equal(end.phase, "rest");
  assert.ok(Math.abs(end.x - (132 + 38)) < 0.5);
  assert.deepEqual(handAt(place, "away", TOTAL_MS, rest), handAt(place, "away", 0, rest));
});

test("a wave goes out and back twice, a tap bumps twice, a hold stays put", () => {
  const xs = Array.from({ length: 101 }, (_, i) => moveOffset("side", i / 100).dx);
  assert.ok(Math.max(...xs) > 21 && Math.min(...xs) < -21);
  assert.ok(Math.abs(xs[0]) < 1e-9 && Math.abs(xs[50]) < 1e-9 && Math.abs(xs[100]) < 1e-9);
  const ys = Array.from({ length: 101 }, (_, i) => moveOffset("tap", i / 100).dy);
  assert.equal(ys.filter((y, i) => i > 0 && i < 100 && y > ys[i - 1] && y > ys[i + 1]).length, 2);
  assert.deepEqual(moveOffset("none", 0.5), { dx: 0, dy: 0 });
});
