import type { Vec3 } from "./pose3d";

// Picks the default viewing angle for the big 3D reference hand, per pose.
// Angles are radians in the same convention as the viewer's group rotation (three.js Euler "XYZ"):
//   y (yaw)   turns about the vertical axis; NEGATIVE y brings the hand's +x side toward the camera.
//   x (pitch) tips about the horizontal axis; POSITIVE x tips the top toward the camera (seen from above),
//             negative x shows the hand from slightly below.
// Poses are in three.js axes (y up, z toward the viewer), recorded palm toward the camera.
// No imports besides a type, so `node --test` runs it.

export type View = { x: number; y: number };

const DEG = Math.PI / 180;
// Tuning knobs (degrees / weights). Change by eye, then rerun handView.test.ts.
export const YAW_RANGE = [-80, 80];
export const PITCH_RANGE = [-40, 50];
export const STEP = 10;
const W_AREA = 1.0; //       projected silhouette area (bigger = easier to read)
const W_SEP = 0.8; //        smallest gap between projected fingertips + thumb tip
const W_THUMB = 0.6; //      thumb tip not hidden behind the fingers
const W_BEHIND = 2.0; //     penalty per unit the palm normal points away from the camera
const W_NATURAL = 0.5; //    pull toward a natural 25-35° off front-on
const NATURAL = [25, 35];
/** The automatic pick is "unclear" when a letter's override scores at least this share of it; the override then wins. */
export const OVERRIDE_MIN_RATIO = 0.8;

/**
 * Fixed angles for look-alike letters where geometry gives a clear answer. Yaw is "toward the thumb side"
 * (flipped automatically for mirrored, left-handed poses). Degrees.
 * A: thumb alongside the fist, seen side-three-quarter. M N T: thumb tucked under the fingers, seen a little from
 * below so the 3, 2 or 1 fingers over the thumb can be counted. S E: front three-quarter.
 */
export const LETTER_VIEW_OVERRIDES: Record<string, { pitch: number; yawTowardThumb: number }> = {
  A: { pitch: 10, yawTowardThumb: 50 },
  M: { pitch: -25, yawTowardThumb: 25 },
  N: { pitch: -25, yawTowardThumb: 25 },
  T: { pitch: -20, yawTowardThumb: 30 },
  S: { pitch: 10, yawTowardThumb: 30 },
  E: { pitch: 10, yawTowardThumb: 30 },
};

const TIPS = [4, 8, 12, 16, 20];
const FINGER_POINTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

type P2 = [number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotate like the viewer (Euler XYZ: yaw first, then pitch). Returns [screen x, screen y, depth (bigger = nearer)]. */
export function rotate(p: Vec3, v: View): Vec3 {
  const cy = Math.cos(v.y), sy = Math.sin(v.y), cx = Math.cos(v.x), sx = Math.sin(v.x);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  return [x1, p[1] * cx - z1 * sx, p[1] * sx + z1 * cx];
}

/** Unit normal pointing out of the PALM side (fingers flex toward the palm, which fixes the sign for either hand). */
export function palmNormal(pose: Vec3[]): Vec3 {
  const n = cross(sub(pose[5], pose[0]), sub(pose[17], pose[0]));
  const len = Math.hypot(...n) || 1;
  let flex = 0;
  for (const [m, t] of [[5, 8], [9, 12], [13, 16], [17, 20]]) flex += dot(sub(pose[t], pose[m]), n);
  const s = flex < 0 ? -1 : 1;
  return [(s * n[0]) / len, (s * n[1]) / len, (s * n[2]) / len];
}

/**
 * +1 for a right hand (as recorded: palm toward the camera puts the thumb on +x), -1 for a mirrored left hand.
 * Read from chirality (which way the fingers flex relative to index×pinky), so it holds whatever way the hand points.
 */
export function thumbSide(pose: Vec3[]): 1 | -1 {
  const n = cross(sub(pose[5], pose[0]), sub(pose[17], pose[0]));
  return dot(n, palmNormal(pose)) >= 0 ? 1 : -1;
}

function hull(pts: P2[]): P2[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const c = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [], hi: P2[] = [];
  for (const p of s) { while (lo.length >= 2 && c(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (hi.length >= 2 && c(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const area = (h: P2[]) => Math.abs(h.reduce((s, p, i) => { const q = h[(i + 1) % h.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
function inside(h: P2[], p: P2): boolean {
  if (h.length < 3) return false;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) return false;
  }
  return true;
}

/** Raw readability terms for one view (area in cm², gaps in cm). Exported for tests and tuning. */
export function viewTerms(pose: Vec3[], v: View) {
  const r = pose.map((p) => rotate(p, v));
  const p2 = r.map((p) => [p[0], p[1]] as P2);
  const silhouette = area(hull(p2));
  let sep = Infinity;
  for (let i = 0; i < TIPS.length; i++)
    for (let j = i + 1; j < TIPS.length; j++) sep = Math.min(sep, Math.hypot(p2[TIPS[i]][0] - p2[TIPS[j]][0], p2[TIPS[i]][1] - p2[TIPS[j]][1]));
  // Thumb hidden: its tip projects inside the fingers' outline AND is behind the nearest finger point.
  const t = r[4];
  let near = FINGER_POINTS[0], best = Infinity;
  for (const i of FINGER_POINTS) { const d = Math.hypot(r[i][0] - t[0], r[i][1] - t[1]); if (d < best) { best = d; near = i; } }
  const thumbHidden = inside(hull(FINGER_POINTS.map((i) => p2[i])), [t[0], t[1]]) && t[2] < r[near][2] - 0.3;
  const facing = rotate(palmNormal(pose), v)[2]; // 1 = palm straight at the camera, < 0 = seen from behind
  const off = Math.acos(Math.max(-1, Math.min(1, Math.cos(v.x) * Math.cos(v.y)))) / DEG;
  return { silhouette, sep, thumbHidden, facing, off };
}

function grid(): View[] {
  const out: View[] = [];
  for (let p = PITCH_RANGE[0]; p <= PITCH_RANGE[1]; p += STEP)
    for (let y = YAW_RANGE[0]; y <= YAW_RANGE[1]; y += STEP) out.push({ x: p * DEG, y: y * DEG });
  return out;
}

function score(t: ReturnType<typeof viewTerms>, maxArea: number): number {
  const naturalMiss = Math.max(0, NATURAL[0] - t.off, t.off - NATURAL[1]) / 45;
  return (
    W_AREA * (t.silhouette / maxArea) +
    W_SEP * Math.min(1, t.sep / 2.5) +
    W_THUMB * (t.thumbHidden ? 0 : 1) -
    W_BEHIND * Math.max(0, 0.15 - t.facing) -
    W_NATURAL * naturalMiss * naturalMiss
  );
}

/** Scores for every grid view, smoothed over the 3×3 neighbourhood so a lone lucky angle does not win. */
function scored(pose: Vec3[]): { view: View; score: number; raw: number; off: number }[] {
  const views = grid();
  const terms = views.map((v) => viewTerms(pose, v));
  const maxArea = Math.max(...terms.map((t) => t.silhouette)) || 1;
  const raw = terms.map((t) => score(t, maxArea));
  const cols = (YAW_RANGE[1] - YAW_RANGE[0]) / STEP + 1;
  const rows = views.length / cols;
  return views.map((view, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    let sum = 0, n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) { sum += raw[rr * cols + cc] * (dr || dc ? 0.5 : 1); n += dr || dc ? 0.5 : 1; }
      }
    return { view, score: Math.round((sum / n) * 1e6) / 1e6, raw: raw[i], off: terms[i].off };
  });
}

/** Best automatic view. Ties go to the angle closest to 30° off front-on, then to grid order (deterministic). */
export function bestView(pose: Vec3[]): View & { score: number } {
  const all = scored(pose);
  let best = all[0];
  for (const s of all) {
    if (s.score > best.score || (s.score === best.score && Math.abs(s.off - 30) < Math.abs(best.off - 30))) best = s;
  }
  return { ...best.view, score: best.raw }; // raw (unsmoothed) score, comparable with scoreView
}

/** Unsmoothed score of any view (used to compare an override with the automatic pick). */
export function scoreView(pose: Vec3[], v: View): number {
  const terms = grid().map((g) => viewTerms(pose, g));
  const maxArea = Math.max(...terms.map((t) => t.silhouette)) || 1;
  return score(viewTerms(pose, v), maxArea);
}

/** The angle the big view starts at (and "Reset view" returns to). */
export function defaultView(letter: string, pose: Vec3[]): View & { source: "auto" | "override" } {
  const auto = bestView(pose);
  const o = LETTER_VIEW_OVERRIDES[letter];
  if (o) {
    const v = { x: o.pitch * DEG, y: -thumbSide(pose) * o.yawTowardThumb * DEG };
    if (scoreView(pose, v) >= auto.score * OVERRIDE_MIN_RATIO) return { ...v, source: "override" };
  }
  return { x: auto.x, y: auto.y, source: "auto" };
}
