import { test } from "node:test";
import assert from "node:assert/strict";
import { SequenceChecker, buildTemplate, dtw, frameVector, matches, resample, trimStill } from "./signSequence.ts";
import type { HandFrame } from "./types.ts";

// A fake hand: 21 landmarks near the wrist, with the wrist at (x, y). `spread` changes the handshape.
const hand = (x: number, y: number, spread = 0.1, handedness: "Left" | "Right" = "Right"): HandFrame => ({
  handedness,
  landmarks: Array.from({ length: 21 }, (_, i) => ({ x: x + (i % 5) * spread * 0.1, y: y - i * spread * 0.05, z: 0 })),
});

// A "hello": the hand sweeps from (0.3,0.2) to (0.6,0.2). Noise makes each take slightly different.
const take = (noise: number, fn: (t: number) => [number, number], n = 30): number[][] =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = fn(i / (n - 1));
    return frameVector(hand(x + noise * Math.sin(i), y + noise * Math.cos(i)));
  });
const sweep = (t: number): [number, number] => [0.3 + 0.3 * t, 0.2];
const rise = (t: number): [number, number] => [0.5, 0.7 - 0.4 * t];

test("resample gives n frames and keeps the ends", () => {
  const s = take(0, sweep, 30);
  const r = resample(s, 16);
  assert.equal(r.length, 16);
  assert.deepEqual(r[0], s[0]);
  assert.deepEqual(r[15], s[29]);
});

test("dtw is 0 for the same sequence and larger for a different motion", () => {
  const a = resample(take(0, sweep));
  assert.equal(dtw(a, a), 0);
  assert.ok(dtw(a, resample(take(0, rise))) > 0.5);
});

test("a new take of the same sign matches; a different motion does not", () => {
  const tpl = buildTemplate([0, 0.003, 0.006, 0.009].map((n) => take(n, sweep)));
  assert.ok(matches(take(0.004, sweep, 22), tpl).ok, "same sign, different speed");
  assert.ok(!matches(take(0, rise), tpl).ok, "a different motion is rejected");
});

test("trimStill drops the ready/rest frames but keeps a held sign whole", () => {
  const rest = Array.from({ length: 6 }, () => frameVector(hand(0.3, 0.2)));
  const moving = take(0, sweep, 12);
  const trimmed = trimStill([...rest, ...moving, ...rest]);
  assert.ok(trimmed.length < 24, `trimmed to ${trimmed.length}`);
  const held = Array.from({ length: 10 }, () => frameVector(hand(0.5, 0.6)));
  assert.equal(trimStill(held).length, 10);
});

test("a left hand is mirrored to the same vector as a right hand in the mirrored place", () => {
  const r = frameVector(hand(0.3, 0.4, 0.1, "Right"));
  const l = frameVector({ ...hand(0.7, 0.4, 0.1, "Left"), handedness: "Left" });
  assert.equal(r.length, l.length);
  assert.ok(Math.abs(r[r.length - 2] - l[l.length - 2]) < 1e-9, "position x mirrored");
});

test("SequenceChecker fires on a live attempt and not on a different motion", () => {
  const tpl = buildTemplate([0, 0.003, 0.006].map((n) => take(n, sweep)));
  const run = (fn: (t: number) => [number, number]) => {
    const c = new SequenceChecker(tpl);
    for (let i = 0; i < 40; i++) {
      const [x, y] = fn(Math.min(1, i / 30));
      if (c.update(hand(x, y), 1000 + i * 40).done) return true;
    }
    return false;
  };
  assert.equal(run(sweep), true);
  assert.equal(run(rise), false);
});

// ---- two-handed signs (NICE, MEET, NAME) ----
const two = (x: number, y: number, ox: number, oy: number): HandFrame => ({ ...hand(x, y), other: hand(ox, oy) });
const slide = (t: number): [number, number, number, number] => [0.5, 0.5, 0.3 + 0.4 * t, 0.5]; // second hand slides across the first
const together = (t: number): [number, number, number, number] => [0.4 + 0.1 * t, 0.5, 0.7 - 0.2 * t, 0.5]; // hands come together
const twoTake = (noise: number, fn: (t: number) => [number, number, number, number], n = 30): number[][] =>
  Array.from({ length: n }, (_, i) => {
    const [x, y, ox, oy] = fn(i / (n - 1));
    return frameVector(two(x + noise * Math.sin(i), y, ox + noise * Math.cos(i), oy), true);
  });

test("a two-handed frame vector carries the relative offset of the second hand", () => {
  const one = frameVector(hand(0.5, 0.5));
  const withOther = frameVector(two(0.5, 0.5, 0.7, 0.5), true);
  assert.ok(withOther.length > one.length, "second-hand block is added");
  assert.equal(frameVector(hand(0.5, 0.5), true).length, withOther.length, "missing hand keeps the same length");
  const farther = frameVector(two(0.5, 0.5, 0.9, 0.5), true);
  assert.notDeepEqual(withOther, farther, "offset changes the vector");
});

test("two-handed sign: same relative motion matches, a different one does not", () => {
  const tpl = buildTemplate([0, 0.003, 0.006].map((n) => twoTake(n, slide)));
  assert.ok(matches(twoTake(0.004, slide, 24), tpl).ok);
  assert.ok(!matches(twoTake(0, together), tpl).ok);
});

test("the second hand is read relative to the first: moving both together keeps the offset block the same", () => {
  const a = frameVector(two(0.3, 0.5, 0.5, 0.5), true);
  const b = frameVector(two(0.4, 0.6, 0.6, 0.6), true);
  const offset = (v: number[]) => v.slice(-3);
  offset(a).forEach((x, i) => assert.ok(Math.abs(x - offset(b)[i]) < 1e-9));
});

test("two-handed checker waits for both hands, then fires", () => {
  const tpl = buildTemplate([0, 0.003, 0.006].map((n) => twoTake(n, slide)));
  const c = new SequenceChecker(tpl, 2);
  const oneHandOnly = c.update(hand(0.5, 0.5), 1000);
  assert.equal(oneHandOnly.done, false);
  assert.match(oneHandOnly.message, /both hands/i);
  let done = false;
  for (let i = 0; i < 40; i++) {
    const [x, y, ox, oy] = slide(Math.min(1, i / 30));
    if (c.update(two(x, y, ox, oy), 2000 + i * 40).done) done = true;
  }
  assert.equal(done, true);
});

test("two hands: the same pose gives the same vector even when MediaPipe swaps which hand is 'dominant'", () => {
  // dominant (right) hand at the lower-x side, other hand at the higher-x side
  const right = hand(0.4, 0.5, 0.1, "Right"), left = hand(0.6, 0.5, 0.1, "Left");
  const proper = frameVector({ ...right, other: left }, true);
  // swapped labels: the detector calls the higher-x hand the dominant one
  const swapped = frameVector({ ...left, handedness: "Right", other: { ...right, handedness: "Left" } }, true);
  assert.equal(proper.length, swapped.length);
  proper.forEach((x, i) => assert.ok(Math.abs(x - swapped[i]) < 1e-9, `index ${i}`));
});
