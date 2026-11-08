// Reward line after a match the app ALREADY confirmed. No imports, so `node --test` runs it.
// Only an id, two small numbers and the last 5 lines shown ever go to the server; never names.

export type PraiseKind = "letter" | "sign" | "lesson";
export type Praise = { message: string; cached: boolean };
type Send = (body: Record<string, unknown>) => Promise<unknown>;

const TARGET: Record<PraiseKind, RegExp> = { letter: /^([A-Z]|5)$/, sign: /^[A-Z][A-Z-]{1,19}$/, lesson: /^\d+\.\d+$/ };

/** Shown when the server is down or slow. Same style as the server's pool; labelled "cached" in the UI. */
export const FALLBACK = [
  "That {target} matches the reference. Nice work!",
  "Nice {target}!",
  "Lovely {target}, nice and steady.",
  "Clean {target}. Keep going!",
  "Steady hand, clear {target}.",
  "Great {target}. On to the next one.",
  "Look at that {target}!",
  "You've got {target} down.",
  "Smooth {target}!",
  "Well done on {target}.",
];
const LESSON_FALLBACK = ["Lesson {target} complete. Great signing!", "You finished lesson {target}. Well done!", "Lesson {target} is done. Nice work!"];

/** The last 5 lines shown, oldest first; sent as `recent` so the next line differs. */
export const recentPraise: string[] = [];

export const streakAfter = (streak: number, event: "match" | "miss" | "skip") => (event === "match" ? Math.min(50, streak + 1) : 0);
export const triesFrom = (misses: number) => Math.max(1, Math.min(20, Math.floor(misses) + 1));

export function pickFallback(kind: PraiseKind, target: string, recent: string[] = recentPraise, random = Math.random) {
  const all = (kind === "lesson" ? LESSON_FALLBACK : FALLBACK).map((m) => m.replaceAll("{target}", target));
  const fresh = all.filter((m) => !recent.includes(m));
  const pool = fresh.length ? fresh : all;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

function remember(p: Praise): Praise {
  recentPraise.push(p.message);
  recentPraise.splice(0, Math.max(0, recentPraise.length - 5));
  return p;
}

/** Never throws and never blocks: any failure gives a local line marked cached. */
export async function requestPraise(kind: PraiseKind, target: string, opts: { streak?: number; tries?: number }, send: Send): Promise<Praise> {
  if (!TARGET[kind]?.test(target)) return remember({ message: "That matches the reference. Nice work!", cached: true });
  const recent = recentPraise.filter((m) => m.length <= 80);
  try {
    const r = (await send({ kind, target, recent, ...(opts.streak !== undefined && { streak: Math.max(0, Math.min(50, opts.streak)) }), ...(opts.tries !== undefined && { tries: triesFrom(opts.tries - 1) }) })) as { message?: unknown; cached?: unknown } | null;
    const message = typeof r?.message === "string" ? r.message.trim() : "";
    if (message && message.length <= 90) return remember({ message, cached: r?.cached === true });
  } catch { /* offline, slow or rate limited: fall through */ }
  return remember({ message: pickFallback(kind, target, recent), cached: true });
}
