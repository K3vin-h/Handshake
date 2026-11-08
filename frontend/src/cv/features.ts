import type { FeatureVector, HandFrame } from "./types";

// FEATURE LAYOUT — must match training/features.py exactly (checked by training/test_parity.py).
//   [0..62]  normalized landmarks: wrist origin, scaled by wrist→middle knuckle,
//            left hands mirrored, z multiplied by Z_WEIGHT (MediaPipe depth is noisy)
//   [63..67] curl per finger (thumb, index, middle, ring, pinky): 0 = straight, ~1 = fully bent
//   [68..77] pointing direction per finger: unit (x, y) from knuckle to tip
//   [78..87] distances between every pair of fingertips
export const FEATURE_VERSION = 2;
export const FEATURE_LENGTH = 88;
export const Z_WEIGHT = 0.5;

const WRIST = 0;
const MIDDLE_MCP = 9;
const CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const TIPS = [4, 8, 12, 16, 20];

type P = [number, number, number];

/** Step 1: position-, scale- and handedness-invariant points. */
export function normalizedPoints(frame: HandFrame): P[] {
  const { landmarks, handedness } = frame;
  const w = landmarks[WRIST];
  const m = landmarks[MIDDLE_MCP];
  const size = Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z) || 1;
  const flip = handedness === "Left" ? -1 : 1;
  return landmarks.map((p) => [(flip * (p.x - w.x)) / size, (p.y - w.y) / size, ((p.z - w.z) / size) * Z_WEIGHT]);
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: P) => Math.hypot(a[0], a[1], a[2]);

function angle(a: P, b: P, c: P): number {
  const u = sub(a, b);
  const v = sub(c, b);
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / ((len(u) * len(v)) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

/** Full feature vector used by both kNN and the trained model. */
export function extractFeatures(frame: HandFrame): FeatureVector {
  const pts = normalizedPoints(frame);
  const out: number[] = [];
  for (const p of pts) out.push(p[0], p[1], p[2]);

  // Curl: average bend at the two middle joints of each finger.
  for (const [a, b, c, d] of CHAINS) {
    const bend = (Math.PI - angle(pts[a], pts[b], pts[c]) + (Math.PI - angle(pts[b], pts[c], pts[d]))) / 2;
    out.push(bend / Math.PI);
  }
  // Direction: where each finger points (2D, unit length).
  for (const [a, , , d] of CHAINS) {
    const v = sub(pts[d], pts[a]);
    const l = Math.hypot(v[0], v[1]) || 1;
    out.push(v[0] / l, v[1] / l);
  }
  // Fingertip-to-fingertip distances.
  for (let i = 0; i < TIPS.length; i++) {
    for (let j = i + 1; j < TIPS.length; j++) out.push(len(sub(pts[TIPS[i]], pts[TIPS[j]])));
  }
  return out;
}

/** Curl values (0 straight .. 1 bent) by finger name, used by coach feedback. */
export function fingerCurls(features: FeatureVector) {
  return { thumb: features[63], index: features[64], middle: features[65], ring: features[66], pinky: features[67] };
}

/** Direction (x, y) by finger name. y < 0 means pointing up in image coordinates. */
export function fingerDirections(features: FeatureVector) {
  const names = ["thumb", "index", "middle", "ring", "pinky"] as const;
  return Object.fromEntries(names.map((n, i) => [n, [features[68 + i * 2], features[69 + i * 2]]])) as Record<
    (typeof names)[number],
    [number, number]
  >;
}
