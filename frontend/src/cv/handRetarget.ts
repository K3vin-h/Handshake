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

/** Finger radii the viewer draws (knuckle end, tip end), cm. KEEP IN SYNC with FINGERS in components/HandModel3D.tsx. Index = CHAINS index. */
const RADII: [number, number][] = [[1.15, 0.78], [0.92, 0.64], [0.95, 0.66], [0.9, 0.62], [0.8, 0.55]];
const radiusAt = (finger: number, k: number) => RADII[finger][0] + (RADII[finger][1] - RADII[finger][0]) * (k / 3);

/**
 * Letters whose neighbouring fingers press together, as [anchor finger, finger that leans toward it] (1 index, 2 middle, 3 ring, 4 pinky).
 * Recordings of these letters average out slightly apart (MediaPipe noise), which looks wrong on the model.
 * Only letters listed here change; V, W, 5 and the rest keep their recorded spacing.
 */
export const TOGETHER: Record<string, [number, number][]> = {
  U: [[1, 2]],
  H: [[1, 2]],
  B: [[2, 1], [2, 3], [3, 4]], // anchored on the middle finger: index and ring lean in, then the pinky leans toward the ring
};

/**
 * Letters whose listed fingers are held straight (1 index, 2 middle, 3 ring, 4 pinky). Averaged recordings leave a
 * slight curl in them (MediaPipe noise), which looks wrong on the model. Only listed letters change.
 */
export const STRAIGHT: Record<string, number[]> = {
  U: [1, 2],
  H: [1, 2],
  V: [1, 2],
  B: [1, 2, 3, 4],
};

/**
 * Lay each listed finger out along one straight line from its knuckle to where its tip was pointing. Every bone keeps
 * its length, the knuckle stays put, and the overall direction of the finger is the recorded one: only the curl goes.
 */
export function straightenFingers(pose: Vec3[], letter: string): Vec3[] {
  const fingers = STRAIGHT[letter];
  if (!fingers) return pose;
  const out: Vec3[] = pose.map((p) => [...p] as Vec3);
  for (const f of fingers) {
    const ids = CHAINS[f].ids;
    const axis = sub(pose[ids[3]], pose[ids[0]]);
    const n = norm(axis);
    if (n < EPS) continue;
    let reach = 0;
    for (let i = 1; i < ids.length; i++) {
      reach += norm(sub(pose[ids[i]], pose[ids[i - 1]]));
      out[ids[i]] = [pose[ids[0]][0] + (axis[0] / n) * reach, pose[ids[0]][1] + (axis[1] / n) * reach, pose[ids[0]][2] + (axis[2] / n) * reach];
    }
  }
  return out;
}

/**
 * Lean each listed finger toward its neighbour until the drawn fingers just touch (centre distance = sum of the two
 * radii at that joint). The finger is re-placed bone by bone from its knuckle, so every bone keeps its length: only
 * the direction changes. Fingers already closer are left alone; the knuckle never moves.
 */
export function closeFingers(pose: Vec3[], letter: string): Vec3[] {
  const pairs = TOGETHER[letter];
  if (!pairs) return pose;
  const out: Vec3[] = pose.map((p) => [...p] as Vec3);
  for (const [a, b] of pairs) {
    const ids = CHAINS[b].ids;
    for (let k = 1; k <= 3; k++) {
      const pa = out[CHAINS[a].ids[k]];
      const d = sub(pose[ids[k]], pa);
      const n = norm(d);
      const touch = radiusAt(a, k) + radiusAt(b, k);
      // Where the joint should be to touch the neighbour; if already as close, keep the recorded spot.
      const want: Vec3 = n > touch && n > EPS ? [pa[0] + (d[0] / n) * touch, pa[1] + (d[1] / n) * touch, pa[2] + (d[2] / n) * touch] : pose[ids[k]];
      const prev = out[ids[k - 1]];
      const len = norm(sub(pose[ids[k]], pose[ids[k - 1]]));
      const to = sub(want, prev);
      const tn = norm(to);
      if (tn > EPS) out[ids[k]] = [prev[0] + (to[0] / tn) * len, prev[1] + (to[1] / tn) * len, prev[2] + (to[2] / tn) * len];
    }
  }
  return out;
}
