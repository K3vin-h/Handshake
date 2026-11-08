import committed from "./signTemplates.json";
import { SIGNS } from "./signs";
import { buildTemplate, resample, trimStill, type Seq, type SignTemplate, type SignTemplates } from "./signSequence";

// Recorded sign takes. Committed file: cv/signTemplates.json (exported from #/record-signs).
// Takes recorded in this browser (localStorage) override it, so you can try a recording before committing it.

const KEY = "handshake.signtakes.v1";
export const MIN_TAKES = 3;

export function loadLocalTakes(): Record<string, Seq[]> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function saveLocalTakes(t: Record<string, Seq[]>) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* session only */ }
}
/** A raw take (one vector per frame) → the stored form: still frames trimmed, resampled. */
export const storeTake = (raw: Seq): Seq => resample(trimStill(raw));

/** The template for a sign id, or null when fewer than MIN_TAKES takes exist. */
export function getSignTemplate(id: string): SignTemplate | null {
  const local = loadLocalTakes()[id];
  if (local && local.length >= MIN_TAKES) return buildTemplate(local, SIGNS[id]?.hands ?? 1);
  const c = (committed as SignTemplates)[id];
  return c && c.takes?.length >= MIN_TAKES ? c : null;
}

/** Everything recorded in this browser, as the file to commit as cv/signTemplates.json. Numbers rounded to keep it small. */
export function exportTemplates(): SignTemplates {
  const out: SignTemplates = { ...(committed as SignTemplates) };
  for (const [id, takes] of Object.entries(loadLocalTakes())) {
    if (takes.length < MIN_TAKES) continue;
    const t = buildTemplate(takes, SIGNS[id]?.hands ?? 1);
    out[id] = { ...(t.hands ? { hands: t.hands } : {}), threshold: +t.threshold.toFixed(4), takes: t.takes.map((s) => s.map((f) => f.map((x) => +x.toFixed(4)))) };
  }
  return out;
}
