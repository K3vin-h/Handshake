import { fingerCurls, fingerDirections } from "./features.ts";
import type { FeatureVector, FingerFeedback } from "./types";

// Fingerpose-style feedback: describe each finger by curl and pointing direction,
// compare with the average template for the target letter, and name what's off.
// The Gemini coach turns these into a friendly tip.

const CURL_LEVEL = (c: number) => (c < 0.2 ? "straight" : c < 0.5 ? "half-curled" : "fully curled");

function directionWord([x, y]: [number, number]): string {
  const deg = (Math.atan2(-y, x) * 180) / Math.PI; // 90 = up (image y grows downward)
  if (deg > 60 && deg < 120) return "up";
  if (deg >= 120 && deg < 160) return "diagonally up-left";
  if (deg > 20 && deg <= 60) return "diagonally up-right";
  if (deg >= 160 || deg <= -160) return "left";
  if (deg <= 20 && deg >= -20) return "right";
  return "down";
}

const angleBetween = (a: [number, number], b: [number, number]) =>
  (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180) / Math.PI;

export function getHandFeedback(user: FeatureVector, target: FeatureVector, curlThreshold = 0.22, dirThresholdDeg = 35): FingerFeedback[] {
  const uc = fingerCurls(user);
  const tc = fingerCurls(target);
  const ud = fingerDirections(user);
  const td = fingerDirections(target);
  const issues: FingerFeedback[] = [];

  for (const finger of Object.keys(uc) as (keyof typeof uc)[]) {
    const diff = uc[finger] - tc[finger];
    if (Math.abs(diff) > curlThreshold) {
      issues.push({ finger, code: `${finger}:curl`, issue: `is ${CURL_LEVEL(uc[finger])} but should be ${CURL_LEVEL(tc[finger])}` });
      continue;
    }
    // Direction only matters for fingers that are extended in the target sign.
    if (tc[finger] < 0.5 && angleBetween(ud[finger], td[finger]) > dirThresholdDeg) {
      issues.push({ finger, code: `${finger}:direction`, issue: `points ${directionWord(ud[finger])} but should point ${directionWord(td[finger])}` });
    }
  }

  // Thumb placement relative to the index knuckle separates A vs S vs T (indices from features.ts layout).
  const thumbGap = (f: FeatureVector) => Math.hypot(f[12] - f[15], f[13] - f[16]);
  const gap = thumbGap(user) - thumbGap(target);
  if (Math.abs(gap) > 0.35 && !issues.some((i) => i.finger === "thumb")) {
    issues.push({ finger: "thumb", code: "thumb:placement", issue: gap > 0 ? "is too far from the index finger" : "is too close to the index finger" });
  }
  return issues;
}
