import { distance } from "./normalize";
import { FEATURE_LENGTH, FEATURE_VERSION } from "./features";
import type { FeatureVector, Prediction, Template } from "./types";
import bundled from "./templates.json";

const STORAGE_KEY = "handshake.templates.v2";
const K = 5;
/** Reject a match if even the nearest example is further than this. Tune at the venue (debug panel shows distances). */
export let MAX_DISTANCE = 2.0;
export const setMaxDistance = (d: number) => (MAX_DISTANCE = d);

const valid = (t: Template) => t.features?.length === FEATURE_LENGTH && (t.v ?? FEATURE_VERSION) === FEATURE_VERSION;

/** Templates = committed templates.json + anything recorded locally on /record (old-format ones are skipped). */
export function loadTemplates(): Template[] {
  return [...(bundled as Template[]), ...getLocalTemplates()].filter(valid);
}

export function saveLocalTemplates(templates: Template[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* storage unavailable: recording still works for this session */
  }
}

export function getLocalTemplates(): Template[] {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Template[]).filter(valid);
  } catch {
    return [];
  }
}

/**
 * k-nearest neighbours. "Training" is just storing examples, so it's instant.
 * Confidence = fraction of the k nearest examples that vote for the winner.
 */
export function classify(features: FeatureVector, templates: Template[], allowed?: string[]): Prediction {
  const pool = allowed ? templates.filter((t) => allowed.includes(t.letter)) : templates;
  if (!pool.length) return { letter: null, confidence: 0, distance: Infinity };

  const nearest = pool
    .map((t) => ({ letter: t.letter, d: distance(features, t.features) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, K);

  if (nearest[0].d > MAX_DISTANCE) return { letter: null, confidence: 0, distance: nearest[0].d };

  const votes = new Map<string, number>();
  for (const n of nearest) votes.set(n.letter, (votes.get(n.letter) ?? 0) + 1);
  const [letter, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];

  return { letter, confidence: count / nearest.length, distance: nearest[0].d };
}

/** Average template for a letter, used by feedback.ts to explain mistakes. */
export function meanTemplate(letter: string, templates: Template[]): FeatureVector | null {
  const own = templates.filter((t) => t.letter === letter);
  if (!own.length) return null;
  const mean = new Array(own[0].features.length).fill(0);
  for (const t of own) t.features.forEach((v, i) => (mean[i] += v / own.length));
  return mean;
}
