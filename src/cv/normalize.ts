import type { FeatureVector, HandFrame } from "./types";
import { extractFeatures } from "./features";

/** Kept for the CLAUDE.md interface: now returns the full feature vector from features.ts. */
export function normalize(frame: HandFrame): FeatureVector {
  return extractFeatures(frame);
}

export function distance(a: FeatureVector, b: FeatureVector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}
