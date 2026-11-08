import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestView, defaultView, LETTER_VIEW_OVERRIDES, palmNormal, PITCH_RANGE, rotate, thumbSide, YAW_RANGE, type View } from "./handView.ts";
import { centrePose, retargetPose } from "./handRetarget.ts";
import { meanPose3D, type Vec3 } from "./pose3d.ts";
import type { Template } from "./types.ts";

const DEG = Math.PI / 180;
let templates: Template[] = [];
try { templates = JSON.parse(readFileSync(new URL("./templates.json", import.meta.url), "utf8")); } catch { /* no data: skipped */ }
// The viewer renders the retargeted, centred pose, so test that.
const poseFor = (l: string, mirror = false) => { const p = meanPose3D(l, templates, mirror); return p && centrePose(retargetPose(p)); };

test("rotate matches three.js Euler XYZ: negative yaw brings +x toward the camera, positive pitch shows the top", () => {
  assert.ok(rotate([1, 0, 0], { x: 0, y: -0.5 })[2] > 0);
  assert.ok(rotate([0, 1, 0], { x: 0.5, y: 0 })[2] > 0);
});

const inRange = (v: View) =>
  v.x >= PITCH_RANGE[0] * DEG - 1e-9 && v.x <= PITCH_RANGE[1] * DEG + 1e-9 && v.y >= YAW_RANGE[0] * DEG - 1e-9 && v.y <= YAW_RANGE[1] * DEG + 1e-9;

const letters = ["A", "M", "N", "T", "S", "E", "B", "L", "Y", "5"];
for (const l of letters) {
  test(`${l}: default view is inside the grid, deterministic, and shows the palm side`, { skip: !poseFor(l) && "no world data" }, () => {
    const p = poseFor(l)!;
    const v = defaultView(l, p);
    assert.ok(inRange(v), JSON.stringify(v));
    assert.deepEqual(defaultView(l, p), v);
    assert.ok(rotate(palmNormal(p), v)[2] > 0, "palm faces the camera");
    // Not dead-on front: the whole point is a more readable angle.
    assert.ok(Math.abs(v.x) + Math.abs(v.y) > 5 * DEG);
  });
}

test("override angles stay in their documented ranges (pitch -40..50°, yaw toward thumb 0..60°)", () => {
  for (const o of Object.values(LETTER_VIEW_OVERRIDES)) {
    assert.ok(o.pitch >= -40 && o.pitch <= 50);
    assert.ok(o.yawTowardThumb >= 0 && o.yawTowardThumb <= 60);
  }
  assert.ok(LETTER_VIEW_OVERRIDES.A.yawTowardThumb >= 45, "A is seen side-three-quarter");
  for (const l of ["M", "N", "T"]) assert.ok(LETTER_VIEW_OVERRIDES[l].pitch < 0, `${l} is seen slightly from below`);
});

test("a mirrored (left-handed) pose gets the mirrored yaw", { skip: !poseFor("A") && "no world data" }, () => {
  for (const l of ["A", "M", "B"]) {
    const r = poseFor(l)!, m = poseFor(l, true)!;
    assert.equal(thumbSide(r), 1);
    assert.equal(thumbSide(m), -1);
    const vr = defaultView(l, r), vm = defaultView(l, m);
    assert.ok(Math.abs(vr.x - vm.x) < 1e-9 && Math.abs(vr.y + vm.y) < 1e-9, `${l}: ${JSON.stringify(vr)} vs ${JSON.stringify(vm)}`);
  }
});

// Projected thumb tip + fingertips relative to the wrist, scaled by the hand's projected size.
function layout(p: Vec3[], v: View): number[] {
  const r = p.map((q) => rotate(q, v));
  const size = Math.hypot(r[9][0] - r[0][0], r[9][1] - r[0][1]) || 1;
  return [4, 8, 12, 16, 20].flatMap((i) => [(r[i][0] - r[0][0]) / size, (r[i][1] - r[0][1]) / size]);
}

test("A, M, N and T look different from each other at their default views", { skip: !poseFor("N") && "no world data" }, () => {
  const ls = ["A", "M", "N", "T"];
  const lay = ls.map((l) => { const p = poseFor(l)!; return layout(p, defaultView(l, p)); });
  for (let i = 0; i < ls.length; i++)
    for (let j = i + 1; j < ls.length; j++) {
      const d = Math.hypot(...lay[i].map((x, k) => x - lay[j][k]));
      assert.ok(d > 0.2, `${ls[i]} vs ${ls[j]}: ${d.toFixed(3)}`);
    }
});

test("synthetic flat hand: picks an angle off front-on, not from behind", () => {
  // Wrist at origin, palm toward +z, fingers slightly flexed toward the palm (+z).
  const p: Vec3[] = [[0, 0, 0], [2.5, 2, 0.5], [4, 4, 1], [5, 6, 1.5], [5.5, 8, 2]];
  [2.5, 0.5, -1.5, -3.3].forEach((x, f) => { for (let s = 0; s < 4; s++) p.push([x, 9 + s * 2.6, s * 0.4]); });
  const v = bestView(p);
  assert.ok(inRange(v));
  assert.ok(rotate(palmNormal(p), v)[2] > 0);
  assert.deepEqual(bestView(p), v);
});
