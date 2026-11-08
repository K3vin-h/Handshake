import type { Prediction, SignDetection } from "./types";

/**
 * Only fires once the same letter has been predicted confidently for `holdMs`.
 * Stops one noisy frame from counting as a correct sign.
 */
export class HoldConfirm {
  private current: string | null = null;
  private since = 0;
  private fired = false;

  constructor(
    private holdMs = 800,
    private minConfidence = 0.6,
  ) {}

  /** Returns a detection exactly once per hold, otherwise null. */
  update(p: Prediction, now: number): SignDetection | null {
    const letter = p.confidence >= this.minConfidence ? p.letter : null;
    if (letter !== this.current) {
      this.current = letter;
      this.since = now;
      this.fired = false;
      return null;
    }
    if (letter && !this.fired && now - this.since >= this.holdMs) {
      this.fired = true;
      return { letter, confidence: p.confidence };
    }
    return null;
  }

  /** 0..1 progress of the current hold, for a progress ring in the UI. */
  progress(now: number): number {
    if (!this.current || this.fired) return this.fired ? 1 : 0;
    return Math.min(1, (now - this.since) / this.holdMs);
  }

  reset() {
    this.current = null;
    this.fired = false;
  }
}
