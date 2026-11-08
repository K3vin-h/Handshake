import type { Vec3 } from "./pose3d";

// Retarget a recorded pose (21 MediaPipe world landmarks, 1 unit ≈ 1 cm) onto evenly proportioned fingers.
// Every bone keeps the DIRECTION it had in the recording; only its LENGTH changes, so noisy MediaPipe segment
// lengths (one stubby middle segment, one long one) no longer give lumpy fingers. The hand still "matches our recording".
// No imports besides a type, so `node --test` runs it.
//
// What is canonical and what is kept:
// - Palm rays (wrist → thumb base and → each knuckle) keep their recorded length: they place the knuckles.
// - Each finger and the thumb get canonical segment PROPORTIONS. Their total length is blended between the canonical
//   total and the recorded one by CHAIN_FIT. With fully canonical totals (CHAIN_FIT = 0) N's tucked thumb tip slid
//   past the ring fingertip in our data (handRetarget.test.ts caught it), so the default keeps the recorded reach.

/** Canonical segment lengths per chain in cm (medians over every recorded frame in templates.json, ~4,000 frames). */
export const CHAINS: { ids: number[]; lengths: number[] }[] = [
  { ids: [1, 2, 3, 4], lengths: [3.5, 3.6, 3.0] }, // thumb: CMC → MCP → IP → tip
  { ids: [5, 6, 7, 8], lengths: [3.0, 2.2, 2.7] }, // index
  { ids: [9, 10, 11, 12], lengths: [3.7, 2.8, 2.8] }, // middle
  { ids: [13, 14, 15, 16], lengths: [3.3, 2.6, 2.4] }, // ring
  { ids: [17, 18, 19, 20], lengths: [2.4, 2.1, 2.0] }, // pinky
];
const PALM_RAYS = [1, 5, 9, 13, 17];

/** 1 = keep each chain's recorded total length (tip reach), 0 = canonical totals. Tuning knob. */
export const CHAIN_FIT = 1;

const EPS = 1e-9;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/**
 * Same bone directions, even segment proportions. The wrist (point 0) stays where it is.
 * A zero-length bone (two landmarks on top of each other) borrows its parent bone's direction, else points up.
 */
export function retargetPose(pose: Vec3[], chainFit = CHAIN_FIT): Vec3[] {
  const out: Vec3[] = pose.map((p) => [...p] as Vec3);
  const up: Vec3 = [0, 1, 0];
  const place = (a: number, b: number, len: number, fallback: Vec3): Vec3 => {
    const d = sub(pose[b], pose[a]);
    const n = norm(d);
    const dir: Vec3 = n > EPS ? [d[0] / n, d[1] / n, d[2] / n] : fallback;
    out[b] = [out[a][0] + dir[0] * len, out[a][1] + dir[1] * len, out[a][2] + dir[2] * len];
    return dir;
  };
  const rayDir: Record<number, Vec3> = {};
  for (const id of PALM_RAYS) rayDir[id] = place(0, id, norm(sub(pose[id], pose[0])), up);
  for (const { ids, lengths } of CHAINS) {
    let recorded = 0;
    for (let i = 1; i < ids.length; i++) recorded += norm(sub(pose[ids[i]], pose[ids[i - 1]]));
    const canonical = lengths.reduce((s, l) => s + l, 0);
    const total = recorded > EPS ? canonical + (recorded - canonical) * chainFit : canonical;
    let dir = rayDir[ids[0]];
    for (let i = 1; i < ids.length; i++) dir = place(ids[i - 1], ids[i], (lengths[i - 1] / canonical) * total, dir);
  }
  return out;
}

/** Shift so the bounding box is centred on the origin (the view spins around the middle of the hand). */
export function centrePose(pose: Vec3[]): Vec3[] {
  const c = [0, 1, 2].map((k) => (Math.min(...pose.map((p) => p[k])) + Math.max(...pose.map((p) => p[k]))) / 2);
  return pose.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
}
