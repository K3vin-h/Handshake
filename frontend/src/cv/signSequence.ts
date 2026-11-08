import type { HandFrame } from "./types";

// Recorded-sign matching (Units 3–4). Instead of rules, a sign is a few RECORDED takes of the learner's
// own landmarks over time; a live attempt is compared to them with dynamic time warping (DTW).
// No imports besides types so `node --test` can run it.
//
// Honest limits: this checks "matches our recording", not that the sign is right in ASL. It follows ONE hand.

/** Frames each take is resampled to. */
export const SEQ_LEN = 16;
/** Weight of where the wrist is on screen (place + movement) against the handshape numbers. */
const POS_WEIGHT = 4;

export type Seq = number[][];
export type SignTemplate = { takes: Seq[]; threshold: number; /** Hands the sign was recorded with (default 1). */ hands?: 1 | 2 };
export type SignTemplates = Record<string, SignTemplate>;

const shape = (hand: HandFrame, flip: number): number[] => {
  const lm = hand.landmarks;
  const w = lm[0], m = lm[9];
  const size = Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z) || 1;
  const v: number[] = [];
  for (const p of lm) v.push((flip * (p.x - w.x)) / size, (p.y - w.y) / size, ((p.z - w.z) / size) * 0.5);
  return v;
};

/**
 * One frame → handshape (wrist-centred, hand-size-scaled, left mirrored) + wrist position (mirrored for left).
 * With `twoHands`, a second block follows: the other hand's handshape and where it is RELATIVE to the first
 * (in hand sizes), so the sign reads the same at any camera distance. Zeros when the other hand is not seen.
 */
export function frameVector(hand: HandFrame, twoHands = false): number[] {
  // Two hands: MediaPipe's left/right labels flip when the hands overlap (NICE, NAME), so the roles are decided by
  // position instead. The signer's dominant hand sits on the lower-x side of the raw image (higher-x for a left-handed
  // signer); if the detector's "dominant" hand is on the wrong side, the two are swapped.
  let a = hand, b = hand.other;
  const dom = hand.handedness === "Left" ? -1 : 1; // -1 = the signer's dominant hand is the left one
  if (twoHands && b && (b.landmarks[0].x - a.landmarks[0].x) * dom < 0) [a, b] = [b, a];
  const w = a.landmarks[0], m = a.landmarks[9];
  const v = shape(a, dom);
  v.push(POS_WEIGHT * (dom === -1 ? 1 - w.x : w.x), POS_WEIGHT * w.y);
  if (!twoHands) return v;
  if (!b) return v.concat(new Array<number>(63 + 3).fill(0));
  const size = Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z) || 1;
  const ow = b.landmarks[0];
  return v.concat(shape(b, -dom), (dom * (ow.x - w.x)) / size, (ow.y - w.y) / size, ((ow.z - w.z) / size) * 0.5);
}

/** Linear resample of a sequence to n frames. */
export function resample(seq: Seq, n: number = SEQ_LEN): Seq {
  if (seq.length === 0) return [];
  if (seq.length === 1) return Array.from({ length: n }, () => seq[0].slice());
  return Array.from({ length: n }, (_, i) => {
    const pos = (i * (seq.length - 1)) / (n - 1);
    const lo = Math.floor(pos), hi = Math.min(seq.length - 1, lo + 1), f = pos - lo;
    return seq[lo].map((x, d) => x + (seq[hi][d] - x) * f);
  });
}

const dist = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
};

/** DTW distance between two sequences, divided by path length so different lengths compare. */
export function dtw(a: Seq, b: Seq): number {
  const n = a.length, m = b.length;
  if (!n || !m) return Infinity;
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const steps = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const c = dist(a[i - 1], b[j - 1]);
      const prev = [cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1]];
      const k = prev.indexOf(Math.min(...prev));
      const [pi, pj] = [[i - 1, j - 1], [i - 1, j], [i, j - 1]][k];
      cost[i][j] = c + prev[k];
      steps[i][j] = steps[pi][pj] + 1;
    }
  return cost[n][m] / steps[n][m];
}

/** Drop still frames at the start and end (the learner getting ready / dropping the hand). Keeps everything if the sign is held still. */
export function trimStill(seq: Seq, eps = 0.05): Seq {
  if (seq.length < 4) return seq;
  const moving = seq.map((f, i) => (i === 0 ? 0 : dist(f.slice(-2), seq[i - 1].slice(-2))));
  const first = moving.findIndex((d, i) => i > 0 && d > eps);
  let last = -1;
  moving.forEach((d, i) => { if (d > eps) last = i; });
  if (first === -1 || last - first < 3) return seq; // held still: the whole take is the sign
  return seq.slice(Math.max(0, first - 1), last + 1);
}

/** Smallest DTW distance from a live sequence to any take. */
export function nearest(seq: Seq, takes: Seq[]): number {
  const s = resample(seq);
  return Math.min(...takes.map((t) => dtw(s, t)));
}

/** Build a template from raw takes: resample, then set the threshold from how much the takes differ from each other. */
export function buildTemplate(rawTakes: Seq[], hands: 1 | 2 = 1): SignTemplate {
  const takes = rawTakes.map((t) => resample(trimStill(t)));
  const loo = takes.map((t, i) => Math.min(...takes.filter((_, j) => j !== i).map((o) => dtw(t, o))));
  // Slack on top of the worst leave-one-out distance; a floor stops identical takes from making an impossible bar.
  const threshold = Math.max(...loo, 0.2) * 1.4;
  return { takes, threshold, ...(hands === 2 ? { hands } : {}) };
}

/** True when the live sequence is within the template's threshold. */
export function matches(seq: Seq, tpl: SignTemplate): { ok: boolean; distance: number } {
  const distance = nearest(seq, tpl.takes);
  return { ok: distance <= tpl.threshold, distance };
}

const WINDOWS_MS = [900, 1300, 1800, 2400];
const EVERY_MS = 120;
const MIN_FRAMES = 6;

/**
 * Live checker: keeps the last ~2.4 s of hand frames and, a few times a second, tries several window lengths
 * ending now. A match on any of them counts. Missing the hand for 0.4 s clears the buffer.
 */
export class SequenceChecker {
  private buf: { t: number; v: number[] }[] = [];
  private lastTry = 0;
  private lastSeen = 0;
  tpl: SignTemplate;
  hands: 1 | 2;
  constructor(tpl: SignTemplate, hands?: 1 | 2) {
    this.tpl = tpl;
    this.hands = hands ?? tpl.hands ?? 1;
  }

  reset() {
    this.buf = [];
    this.lastTry = 0;
  }

  update(hand: HandFrame | null, now: number): { done: boolean; message: string } {
    if (!hand) {
      if (now - this.lastSeen > 400) this.buf = [];
      return { done: false, message: "Show your hand to the camera" };
    }
    if (this.hands === 2 && !hand.other) {
      if (now - this.lastSeen > 400) this.buf = [];
      return { done: false, message: "Show both hands to the camera" };
    }
    this.lastSeen = now;
    this.buf.push({ t: now, v: frameVector(hand, this.hands === 2) });
    const keep = now - WINDOWS_MS[WINDOWS_MS.length - 1];
    while (this.buf.length && this.buf[0].t < keep) this.buf.shift();
    if (now - this.lastTry < EVERY_MS) return { done: false, message: "Sign it at a natural speed" };
    this.lastTry = now;
    for (const w of WINDOWS_MS) {
      const win = this.buf.filter((f) => f.t >= now - w).map((f) => f.v);
      if (win.length < MIN_FRAMES) continue;
      if (matches(win, this.tpl).ok) {
        this.buf = [];
        return { done: true, message: "That matches our recording" };
      }
    }
    return { done: false, message: "Sign it at a natural speed" };
  }
}
