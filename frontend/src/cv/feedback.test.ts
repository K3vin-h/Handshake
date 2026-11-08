import { test } from "node:test";
import assert from "node:assert/strict";
import { getHandFeedback } from "./feedback.ts";

// Builds an 88-number feature vector with given curls (thumb..pinky) and directions; everything else 0.
const UP: [number, number] = [0, -1];
function vec(curls: number[], dirs: [number, number][] = [UP, UP, UP, UP, UP]) {
  const f = new Array(88).fill(0);
  curls.forEach((c, i) => (f[63 + i] = c));
  dirs.forEach(([x, y], i) => ((f[68 + i * 2] = x), (f[69 + i * 2] = y)));
  return f;
}

test("curl difference gets a finger:curl code", () => {
  const out = getHandFeedback(vec([0, 0.9, 0, 0, 0]), vec([0, 0, 0, 0, 0]));
  assert.deepEqual(out.map((o) => o.code), ["index:curl"]);
  assert.equal(out[0].finger, "index");
});

test("direction difference on an extended finger gets finger:direction", () => {
  const out = getHandFeedback(vec([0, 0, 0, 0, 0], [UP, [1, 0], UP, UP, UP]), vec([0, 0, 0, 0, 0]));
  assert.deepEqual(out.map((o) => o.code), ["index:direction"]);
});

test("thumb far from index knuckle gets thumb:placement", () => {
  const user = vec([0, 0, 0, 0, 0]);
  user[12] = 1; // thumb tip x
  const out = getHandFeedback(user, vec([0, 0, 0, 0, 0]));
  assert.deepEqual(out.map((o) => o.code), ["thumb:placement"]);
  assert.match(out[0].issue, /too far/);
});
