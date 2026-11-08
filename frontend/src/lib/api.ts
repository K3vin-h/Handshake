import { apiUrl } from "./apiBase";
import type { FingerFeedback } from "../cv";

// Frontend → backend. Keep these shapes in sync with CLAUDE.md and backend/index.mjs.

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(14000), // a stalled Gemini call rejects, so every caller's fallback runs
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

export type Cached = { cached?: boolean };

/** Set to true ONLY if the H4 snapshot test passes (Group 3). Then a hand photo is sent to Google's API. */
export const SEND_SNAPSHOT = false;

/** repeat = how many times this learner has made this mistake on this letter (from mistakes.ts).
 *  The snapshot is dropped here unless SEND_SNAPSHOT is on, so no caller can leak a photo. */
export const getCoachTip = (target: string, feedback: FingerFeedback[], repeat: number, snapshot?: string) =>
  post<{ tip: string } & Cached>("/api/coach", { target, feedback, repeat, ...(SEND_SNAPSHOT && snapshot ? { snapshot } : {}) });

/** How to form a letter, from Gemini's general ASL knowledge. text is "" when Gemini is unsure or unavailable. */
export const getHowTo = (target: string) => post<{ text: string } & Cached>("/api/explain", { target });

export const getPracticeWords = (knownLetters: string[], weakLetters: string[]) =>
  post<{ words: string[] } & Cached>("/api/words", { knownLetters, weakLetters });

async function get<T>(url: string): Promise<T> {
  const res = await fetch(apiUrl(url), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

export type Features = { stats: boolean; notify: boolean; agent: boolean };
export type Stats = {
  daily: { day: string; attempts: number; accuracy: number }[];
  items: { item: string; attempts: number; accuracy: number }[];
};
export type Plan = { lessonId: string; focus: string[]; words: string[]; tip: string; source: "agent" | "local" };

export const getFeatures = () => get<Features>("/api/features");
export const getStats = (learnerId: string) => get<Stats>(`/api/stats/${learnerId}`);
export const planToday = (req: import("./planInput").PlanRequest) => post<Plan>("/api/plan", req);

export type SubscribeBody =
  | { action: "subscribe"; learnerId: string; consent: true; userName?: string; theirName?: string; learnerEmail?: string; contactEmail?: string }
  | { action: "unsubscribe"; learnerId: string };
export const subscribe = (body: SubscribeBody) => post<{ ok: boolean; reason?: string }>("/api/subscribe", body);
