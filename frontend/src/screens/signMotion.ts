// Pure animation maths for the sign guide (no React, so `node --test` can run it).
// A sign is shown in four timed phases: bring the hand up to the place, hold it, do the movement, finish.
import type { Movement } from "../cv/signs";

export type Phase = "approach" | "hold" | "move" | "rest";
export const PHASE_MS = { approach: 900, hold: 400, move: 1500, rest: 800 } as const;
export const TOTAL_MS = PHASE_MS.approach + PHASE_MS.hold + PHASE_MS.move + PHASE_MS.rest;

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Offset from the place dot while doing the movement; u runs 0 → 1. Matches the static arrows in SignGuide. */
export function moveOffset(m: Movement, u: number): { dx: number; dy: number } {
  switch (m) {
    case "away": return { dx: lerp(0, 38, ease(u)), dy: lerp(0, -14, ease(u)) };
    case "down": return { dx: 0, dy: lerp(-4, 34, ease(u)) };
    case "side": return { dx: 22 * Math.sin(4 * Math.PI * u), dy: 0 }; // out, back, out, back: a wave
    case "tap": return { dx: 0, dy: -8 + 16 * Math.abs(Math.sin(2 * Math.PI * u)) }; // two bumps
    case "circle": return { dx: 14 * Math.sin(2 * Math.PI * u), dy: -14 * Math.cos(2 * Math.PI * u) };
    default: return { dx: 0, dy: 0 };
  }
}

/** Where the hand marker is at time t (ms since the loop started). `rest` is where the hand starts from. */
export function handAt(place: readonly [number, number], movement: Movement, t: number, rest: readonly [number, number]) {
  const ms = ((t % TOTAL_MS) + TOTAL_MS) % TOTAL_MS;
  const start = moveOffset(movement, 0);
  const sx = place[0] + start.dx, sy = place[1] + start.dy;
  if (ms < PHASE_MS.approach) {
    const u = ease(ms / PHASE_MS.approach);
    return { x: lerp(rest[0], sx, u), y: lerp(rest[1], sy, u), phase: "approach" as Phase };
  }
  if (ms < PHASE_MS.approach + PHASE_MS.hold) return { x: sx, y: sy, phase: "hold" as Phase };
  const m = ms - PHASE_MS.approach - PHASE_MS.hold;
  const u = Math.min(1, m / PHASE_MS.move);
  const o = moveOffset(movement, u);
  return { x: place[0] + o.dx, y: place[1] + o.dy, phase: (m < PHASE_MS.move ? "move" : "rest") as Phase };
}

export const PHASE_TEXT: Record<Phase, string> = {
  approach: "Bring your hand up to the place",
  hold: "Hold it there",
  move: "Now do the movement",
  rest: "Done. It repeats",
};
