import type { HandFrame, Landmark } from "./types";

// One Euro Filter (Casiez et al., CHI 2012): the standard filter for jittery tracked points.
// Smooths heavily when the hand is still (removing jitter, worst in dim light)
// and lightly when it moves fast (so it doesn't lag).

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  last() {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

const alphaFor = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private t: number | null = null;
  constructor(
    private minCutoff = 1.2,
    private beta = 0.02,
    private dCutoff = 1.0,
  ) {}

  filter(value: number, tMs: number) {
    const dt = this.t === null ? 1 / 60 : Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const prev = this.x.last();
    const deriv = prev === null ? 0 : (value - prev) / dt;
    const edx = this.dx.filter(deriv, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
  reset() {
    this.x.reset();
    this.dx.reset();
    this.t = null;
  }
}

/** Smooths all 21 × 3 landmark coordinates. Resets when the hand disappears. */
export class LandmarkSmoother {
  private filters = Array.from({ length: 63 }, () => new OneEuro());

  smooth(hand: HandFrame | null, tMs: number): HandFrame | null {
    if (!hand) {
      this.filters.forEach((f) => f.reset());
      return null;
    }
    const landmarks: Landmark[] = hand.landmarks.map((p, i) => ({
      x: this.filters[i * 3].filter(p.x, tMs),
      y: this.filters[i * 3 + 1].filter(p.y, tMs),
      z: this.filters[i * 3 + 2].filter(p.z, tMs),
    }));
    return { landmarks, worldLandmarks: hand.worldLandmarks, handedness: hand.handedness };
  }
}
