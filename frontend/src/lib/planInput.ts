import type { Lesson, Unit } from "./curriculum.ts";

export type PlanRequest = {
  learnerId: string;
  candidates: { id: string; letters: string[] }[];
  knownLetters: string[];
  weakLetters: string[];
};
type ProgressLike = { completed: string[]; items: Record<string, { attempts: number }> };

const MAX_REVIEW = 4;
const isLetter = (s: string) => /^[A-Z]$/.test(s);

/** Letters a lesson touches. Titles are never used: they contain the learner's names. */
export function lessonLetters(l: Lesson): string[] {
  const out = new Set<string>(l.teaches ?? []);
  for (const s of l.steps) {
    if (s.kind === "learn" || s.kind === "practice" || s.kind === "identify") out.add(s.letter);
    else if (s.kind === "contrast" || s.kind === "mix") s.letters.forEach((c) => out.add(c));
    else if (s.kind === "spell") [...s.word.toUpperCase()].forEach((c) => out.add(c));
  }
  return [...out].filter(isLetter).sort();
}

/**
 * Candidates = next lesson (unlocked by definition) + the most recently completed lessons to review.
 * Same rules as flatLessons/nextLesson in curriculum.ts/progress.ts, inlined because those files import
 * ../cv without a .ts extension and so can't load under `node --test`.
 */
export function buildPlanRequest(units: Unit[], p: ProgressLike, weak: string[], learnerId: string): PlanRequest | null {
  const all = units.flatMap((u) => u.lessons);
  const next = all.find((l) => l.scope === "demo" && !p.completed.includes(l.id)); // same as nextLesson: stretch lessons are never "next"
  const byId = new Map(all.map((l) => [l.id, l]));
  // p.completed is in completion order (progress.ts completeLesson appends), so "recent" = the end of it.
  const review = [...p.completed].reverse().map((id) => byId.get(id)).filter((l): l is Lesson => !!l).slice(0, MAX_REVIEW);
  const picks = next ? [next, ...review] : review;
  if (!picks.length) return null;
  const known = new Set<string>();
  for (const [item, s] of Object.entries(p.items)) if (isLetter(item) && s.attempts > 0) known.add(item);
  for (const l of all) if (p.completed.includes(l.id)) (l.teaches ?? []).forEach((c) => known.add(c));
  return {
    learnerId,
    candidates: picks.map((l) => ({ id: l.id, letters: lessonLetters(l) })),
    knownLetters: [...known].sort(),
    weakLetters: weak.filter((w) => known.has(w)),
  };
}
