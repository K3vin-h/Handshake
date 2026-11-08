import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAINS, closeFingers, retargetPose, straightenFingers, STRAIGHT } from "./handRetarget.ts";
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

// --- closeFingers: U, H and B press their fingers together; everything else keeps its recorded spacing ---
const dist = (p: Vec3[], i: number, j: number) => Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]);
const gap = (p: Vec3[], a: number, b: number, k: number) => dist(p, CHAINS[a].ids[k], CHAINS[b].ids[k]);
// What the viewer draws: two fingers touch when their centres are one radius each apart (see RADII in handRetarget.ts).
const TOUCH = (k: number) => [[0.92, 0.64], [0.95, 0.66]].reduce((s, [r0, r1]) => s + r0 + (r1 - r0) * (k / 3), 0);

for (const [letter, pairs] of [["U", [[1, 2]]], ["H", [[1, 2]]], ["B", [[2, 1], [2, 3], [3, 4]]]] as const) {
  test(`${letter}: fingers that should touch do not move apart (0.3 cm slack for chained pairs), and no bone changes length`, { skip: !meanPose3D(letter, templates) && "no world data" }, () => {
    const before = retargetPose(meanPose3D(letter, templates)!);
    const after = closeFingers(before, letter);
    for (const [a, b] of pairs) for (let k = 1; k <= 3; k++) assert.ok(gap(after, a, b, k) <= gap(before, a, b, k) + 0.3, `${letter} fingers ${a}-${b} joint ${k}`);
    for (const { ids } of CHAINS) for (let i = 1; i < ids.length; i++) {
      const l0 = dist(before, ids[i], ids[i - 1]), l1 = dist(after, ids[i], ids[i - 1]);
      assert.ok(Math.abs(l1 - l0) / l0 < 0.01, `${letter} bone ${ids[i - 1]}-${ids[i]}: ${l0.toFixed(2)} -> ${l1.toFixed(2)} cm`);
    }
  });
}

test("U: index and middle end up (nearly) touching at every joint (within 3.5 mm of the two radii), V is left alone", { skip: !meanPose3D("U", templates) && "no world data" }, () => {
  const before = retargetPose(meanPose3D("U", templates)!);
  const after = closeFingers(before, "U");
  for (let k = 1; k <= 3; k++) assert.ok(gap(after, 1, 2, k) <= TOUCH(k) + 0.35, `joint ${k}: ${gap(after, 1, 2, k).toFixed(2)} cm vs touching ${TOUCH(k).toFixed(2)}`);
  const v = retargetPose(meanPose3D("V", templates)!);
  assert.deepEqual(closeFingers(v, "V"), v);
});

// --- straightenFingers: listed fingers become one straight line, bone lengths and overall direction kept ---
for (const letter of Object.keys(STRAIGHT)) {
  test(`${letter}: listed fingers are straight (all joints on one line), bones keep their length, tip direction is kept`, { skip: !meanPose3D(letter, templates) && "no world data" }, () => {
    const before = retargetPose(meanPose3D(letter, templates)!);
    const after = straightenFingers(before, letter);
    for (const f of STRAIGHT[letter]) {
      const ids = CHAINS[f].ids;
      const line = [0, 1, 2].map((c) => after[ids[3]][c] - after[ids[0]][c]);
      const ln = Math.hypot(...line);
      for (let i = 1; i < 4; i++) {
        const v = [0, 1, 2].map((c) => after[ids[i]][c] - after[ids[0]][c]);
        const cross = [v[1] * line[2] - v[2] * line[1], v[2] * line[0] - v[0] * line[2], v[0] * line[1] - v[1] * line[0]];
        assert.ok(Math.hypot(...cross) / ln < 1e-6, `${letter} finger ${f} joint ${i} is off the line`);
        assert.ok(Math.abs(dist(after, ids[i], ids[i - 1]) - dist(before, ids[i], ids[i - 1])) < 1e-6, `${letter} bone length changed`);
      }
      const dir0 = [0, 1, 2].map((c) => before[ids[3]][c] - before[ids[0]][c]);
      const dot = line.reduce((s, x, c) => s + x * dir0[c], 0) / (ln * Math.hypot(...dir0));
      assert.ok(dot > 0.999, `${letter} finger ${f} points elsewhere (cos ${dot})`);
    }
  });
}

test("letters not listed (e.g. A, a fist) are not straightened", { skip: !meanPose3D("A", templates) && "no world data" }, () => {
  const p = retargetPose(meanPose3D("A", templates)!);
  assert.deepEqual(straightenFingers(p, "A"), p);
});
