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

/** Onboarding: Gemini picks a word pack for the relationship from signs the app can teach. */
export const personalizePath = (userName: string, learningFor: string, relationship: string, allowedWords: string[]) =>
  post<{ wordPack: string[]; welcome: string }>("/api/path", { userName, learningFor, relationship, allowedWords });

export const getCoachTip = (target: string, feedback: FingerFeedback[], snapshot?: string) =>
  post<{ tip: string }>("/api/coach", { target, feedback, snapshot });

export const getPracticeWords = (knownLetters: string[], weakLetters: string[]) =>
  post<{ words: string[] }>("/api/words", { knownLetters, weakLetters });
