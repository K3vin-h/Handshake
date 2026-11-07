import type { Prediction } from "./types";

/**
 * Majority vote over the last N predictions. Removes single-frame flicker
 * before HoldConfirm decides a sign was made.
 */
export class VoteBuffer {
  private buf: Prediction[] = [];
  constructor(private size = 10) {}

  push(p: Prediction): Prediction {
    this.buf.push(p);
    if (this.buf.length > this.size) this.buf.shift();

    const counts = new Map<string, { n: number; conf: number }>();
    for (const q of this.buf) {
      if (!q.letter) continue;
      const c = counts.get(q.letter) ?? { n: 0, conf: 0 };
      c.n += 1;
      c.conf += q.confidence;
      counts.set(q.letter, c);
    }
    let best: [string, { n: number; conf: number }] | null = null;
    for (const e of counts) if (!best || e[1].n > best[1].n) best = e;

    // Need a majority of the window, otherwise "not sure".
    if (!best || best[1].n < Math.ceil(this.buf.length / 2)) {
      return { letter: null, confidence: 0, distance: p.distance, source: p.source };
    }
    return { letter: best[0], confidence: best[1].conf / best[1].n, distance: p.distance, source: p.source };
  }

  reset() {
    this.buf = [];
  }
}
