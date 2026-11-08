import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAINS, retargetPose } from "./handRetarget.ts";
import { meanPose3D, type Vec3 } from "./pose3d.ts";
import type { Template } from "./types.ts";

const len = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit = (a: Vec3, b: Vec3): Vec3 => { const l = len(a, b); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l]; };
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// A noisy right hand, wrist at the origin, palm toward +z: uneven random-ish bone lengths on purpose.
function noisyHand(): Vec3[] {
  const p: Vec3[] = [[0, 0, 0]];
  p[1] = [2.5, 2.5, 0.5]; p[2] = [4.5, 4.2, 1.2]; p[3] = [5.6, 6.5, 2.2]; p[4] = [6.0, 8.8, 2.9];
  const base = [[2.6, 9.5], [0.4, 10.4], [-1.6, 9.6], [-3.4, 8.1]];
  const lens = [[2.4, 2.9, 1.6], [4.6, 2.1, 3.1], [3.0, 3.3, 1.9], [1.8, 2.6, 2.4]];
  base.forEach(([x, y], f) => {
    const i = 5 + f * 4;
    p[i] = [x, y, 0];
    let cur = p[i];
    for (let s = 0; s < 3; s++) { cur = [cur[0] + 0.1 * s, cur[1] + lens[f][s], cur[2] + 0.4 * s]; p[i + s + 1] = cur; }
  });
  return p;
}

const bones = CHAINS.flatMap(({ ids }) => ids.slice(1).map((b, i) => [ids[i], b]));
const palmRays = [1, 5, 9, 13, 17].map((b) => [0, b]);

test("every bone keeps its recorded direction; palm rays keep their length", () => {
  const input = noisyHand();
  for (const fit of [0, 0.5, 1]) {
    const out = retargetPose(input, fit);
    for (const [a, b] of [...palmRays, ...bones]) assert.ok(dot(unit(input[a], input[b]), unit(out[a], out[b])) > 1 - 1e-9, `direction ${a}-${b} fit ${fit}`);
    for (const [a, b] of palmRays) assert.ok(Math.abs(len(out[a], out[b]) - len(input[a], input[b])) < 1e-9);
  }
});

test("segments get canonical proportions; chainFit 0 gives canonical lengths, 1 keeps each finger's reach", () => {
  const input = noisyHand();
  for (const { ids, lengths } of CHAINS) {
    const exact = retargetPose(input, 0);
    ids.slice(1).forEach((b, i) => assert.ok(Math.abs(len(exact[ids[i]], exact[b]) - lengths[i]) < 1e-9, `canonical ${b}`));
    const fit = retargetPose(input, 1);
    const total = (p: Vec3[]) => ids.slice(1).reduce((s, b, i) => s + len(p[ids[i]], p[b]), 0);
    assert.ok(Math.abs(total(fit) - total(input)) < 1e-9, `reach ${ids[0]}`);
    const sum = lengths.reduce((s, l) => s + l, 0);
    ids.slice(1).forEach((b, i) => assert.ok(Math.abs(len(fit[ids[i]], fit[b]) / total(fit) - lengths[i] / sum) < 1e-9, `proportion ${b}`));
  }
});

test("wrist stays at the origin and a mirrored hand gives the mirrored result", () => {
  const input = noisyHand();
  const out = retargetPose(input);
  assert.deepEqual(out[0], [0, 0, 0]);
  const mirrored = retargetPose(input.map(([x, y, z]) => [-x, y, z] as Vec3));
  mirrored.forEach((p, i) => p.forEach((c, k) => assert.ok(Math.abs(c - (k === 0 ? -out[i][0] : out[i][k])) < 1e-9)));
});

test("zero-length bones do not produce NaN", () => {
  const input = noisyHand();
  input[7] = [...input[6]] as Vec3; // middle segment of the index collapses
  input[1] = [0, 0, 0]; // thumb base on the wrist
  input[13] = [...input[0]] as Vec3; // ring knuckle on the wrist
  for (const i of [17, 18, 19, 20]) input[i] = [...input[17]] as Vec3; // whole pinky collapsed to one point
  for (const fit of [0, 1]) assert.ok(retargetPose(input, fit).flat().every(Number.isFinite), `fit ${fit}`);
});

// Real recordings: the thumb-across / tucked letters must keep their layout after retargeting.
let templates: Template[] = [];
try { templates = JSON.parse(readFileSync(new URL("./templates.json", import.meta.url), "utf8")); } catch { /* no data: skipped */ }

for (const letter of ["A", "S", "E", "M", "N", "T"]) {
  const pose = meanPose3D(letter, templates);
  test(`${letter}: thumb stays on its side of the palm and fingertip order across the palm is unchanged`, { skip: !pose && "no world data" }, () => {
    const out = retargetPose(pose!);
    const side = (p: Vec3[]) => { const n = cross(sub(p[5], p[0]), sub(p[17], p[0])); return dot(sub(p[4], p[0]), n) / Math.hypot(...n); };
    const before = side(pose!), after = side(out);
    // Same plane (wrist + the rays to index and pinky knuckles keep their direction), so the sign must match
    // unless the recorded tip is practically on the plane.
    if (Math.abs(before) > 0.3) assert.equal(Math.sign(after), Math.sign(before), `side ${before.toFixed(2)} → ${after.toFixed(2)}`);
    const order = (p: Vec3[]) => {
      const axis = sub(p[17], p[5]);
      const at = [4, 8, 12, 16, 20].map((i) => ({ i, t: dot(sub(p[i], p[5]), axis) / dot(axis, axis) }));
      return at;
    };
    const ob = order(pose!), oa = order(out);
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        if (Math.abs(ob[i].t - ob[j].t) < 0.08) continue; // tie in the recording (< ~0.5 cm): either order is fine
        assert.equal(Math.sign(oa[i].t - oa[j].t), Math.sign(ob[i].t - ob[j].t), `tips ${ob[i].i} / ${ob[j].i}`);
      }
  });
}
