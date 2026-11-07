import type { ErrorCode } from "../cv/types";

// Mistake memory (doc item b): per letter, how often each error happened and when last. Browser only.
export type Mistakes = Record<string, Partial<Record<ErrorCode, { count: number; lastAt: number }>>>;

const KEY = "handshake.mistakes.v1";
let memory: Mistakes = {};

export function loadMistakes(): Mistakes {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : memory;
  } catch {
    return memory;
  }
}

export function saveMistakes(m: Mistakes) {
  memory = m;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* session only */
  }
}

export function recordMistake(m: Mistakes, letter: string, code: ErrorCode, now = Date.now()): Mistakes {
  const count = (m[letter]?.[code]?.count ?? 0) + 1;
  const next = { ...m, [letter]: { ...m[letter], [code]: { count, lastAt: now } } };
  saveMistakes(next);
  return next;
}

export const mistakeCount = (m: Mistakes, letter: string, code: ErrorCode) => m[letter]?.[code]?.count ?? 0;

export function weakFingers(m: Mistakes, limit = 3) {
  const by = new Map<string, number>();
  for (const codes of Object.values(m))
    for (const [code, s] of Object.entries(codes)) {
      const finger = code.split(":")[0];
      by.set(finger, (by.get(finger) ?? 0) + (s?.count ?? 0));
    }
  return [...by].map(([finger, count]) => ({ finger, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
