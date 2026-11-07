import { learnerId } from "./learner.ts";

type Send = (url: string, body: unknown) => Promise<unknown>;
const ITEM_RE = /^[A-Z][A-Z0-9_-]{0,19}$/;
const defaultSend: Send = (url, body) => fetch(url, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), keepalive: true, signal: AbortSignal.timeout(8000),
});

/** Optional telemetry. Local progress is saved first and never waits for the network. */
export function reportAttempt(item: string, correct: boolean, codes: string[] = [], send: Send = defaultSend, id?: string) {
  if (!ITEM_RE.test(item)) return; // fs:* word ids may contain names.
  try {
    void send("/api/attempts", {
      learnerId: id ?? learnerId(), attempts: [{ item, correct, codes, ts: Date.now() }],
    }).catch(() => { /* expected offline/disabled failure; never interrupt signing */ });
  } catch { /* storage, crypto or network setup may be unavailable */ }
}
