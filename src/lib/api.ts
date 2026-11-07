import type { FingerFeedback } from "../cv";

// Frontend → backend. Keep these shapes in sync with CLAUDE.md and server/index.mjs.

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

export type Cached = { cached?: boolean };

/** Set to true ONLY if the H4 snapshot test passes (Group 3). Then a hand photo is sent to Google's API. */
export const SEND_SNAPSHOT = false;

/** Onboarding: letters only (never names). The welcome uses {you}/{them}; fill with fillNames(). */
export const personalizePath = (letters: string[], relationship: string, allowedWords: string[]) =>
  post<{ wordPack: string[]; welcome: string } & Cached>("/api/path", { letters, relationship, allowedWords });

/** repeat = how many times this learner has made this mistake on this letter (from mistakes.ts). */
export const getCoachTip = (target: string, feedback: FingerFeedback[], repeat: number, snapshot?: string) =>
  post<{ tip: string } & Cached>("/api/coach", { target, feedback, repeat, snapshot });

export const getPracticeWords = (knownLetters: string[], weakLetters: string[]) =>
  post<{ words: string[] } & Cached>("/api/words", { knownLetters, weakLetters });
