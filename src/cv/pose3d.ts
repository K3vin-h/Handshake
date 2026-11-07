import type { HandFrame, Template } from "./types";

// 3D poses for the hand viewer, built from real recordings (MediaPipe world landmarks),
// so the model shows exactly how the sign was made. Nothing is hand-posed.

export type Vec3 = [number, number, number];

/** Wrist-centred world landmarks, mirrored so every pose is a right hand. 63 numbers. */
export function worldPose(frame: HandFrame): number[] | undefined {
  const w = frame.worldLandmarks;
  if (!w || w.length !== 21) return undefined;
  const flip = frame.handedness === "Left" ? -1 : 1;
  const o = w[0];
  const out: number[] = [];
  for (const p of w) out.push(flip * (p.x - o.x), p.y - o.y, p.z - o.z);
  return out;
}

/**
 * Average pose for a letter, converted to Three.js axes (y up, z toward viewer),
 * scaled up so the hand is ~10 units tall. Pass mirror=true for left-handed users.
 */
export function meanPose3D(letter: string, templates: Template[], mirror = false): Vec3[] | null {
  const own = templates.filter((t) => t.letter === letter && t.world?.length === 63);
  if (!own.length) return null;
  const sum = new Array(63).fill(0);
  for (const t of own) t.world!.forEach((v, i) => (sum[i] += v / own.length));

  const SCALE = 100; // metres → roughly 10 units for a 10 cm hand
  const pts: Vec3[] = [];
  for (let i = 0; i < 21; i++) {
    const x = sum[i * 3] * SCALE * (mirror ? -1 : 1);
    pts.push([x, -sum[i * 3 + 1] * SCALE, -sum[i * 3 + 2] * SCALE]);
  }
  // Centre the hand on its bounding box so OrbitControls spins around the middle.
  const c: Vec3 = [0, 1, 2].map((k) => (Math.min(...pts.map((p) => p[k])) + Math.max(...pts.map((p) => p[k]))) / 2) as Vec3;
  return pts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
}

/** Bone list: pairs of landmark indices, grouped by finger for colouring. */
export const HAND_BONES: { finger: "palm" | "thumb" | "index" | "middle" | "ring" | "pinky"; a: number; b: number }[] = [
  { finger: "palm", a: 0, b: 1 }, { finger: "palm", a: 0, b: 5 }, { finger: "palm", a: 5, b: 9 },
  { finger: "palm", a: 9, b: 13 }, { finger: "palm", a: 13, b: 17 }, { finger: "palm", a: 0, b: 17 },
  { finger: "thumb", a: 1, b: 2 }, { finger: "thumb", a: 2, b: 3 }, { finger: "thumb", a: 3, b: 4 },
  { finger: "index", a: 5, b: 6 }, { finger: "index", a: 6, b: 7 }, { finger: "index", a: 7, b: 8 },
  { finger: "middle", a: 9, b: 10 }, { finger: "middle", a: 10, b: 11 }, { finger: "middle", a: 11, b: 12 },
  { finger: "ring", a: 13, b: 14 }, { finger: "ring", a: 14, b: 15 }, { finger: "ring", a: 15, b: 16 },
  { finger: "pinky", a: 17, b: 18 }, { finger: "pinky", a: 18, b: 19 }, { finger: "pinky", a: 19, b: 20 },
];
