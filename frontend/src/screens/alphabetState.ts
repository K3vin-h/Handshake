// State of each alphabet box on the #/alphabet screen. Pure data in, data out (no imports) so `node --test` runs it.
//   done   = the learner has passed the letter (3 correct in a row: `mastered` in progress.ts). J and Z move and are
//            self-checked, so they count as done once a lesson that teaches them is completed.
//   open   = taught by a lesson that is unlocked, not passed yet.
//   locked = taught by no unlocked lesson (or by none at all).

export type LetterState = "done" | "open" | "locked";
type LessonLike = { id: string; teaches?: string[] };

const MOVING = ["J", "Z"];
export const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export function alphabetStates(args: {
  lessons: LessonLike[];
  unlocked: Set<string>;
  completed: string[];
  items: Record<string, { mastered: boolean }>;
}): Record<string, LetterState> {
  const { lessons, unlocked, completed, items } = args;
  const out: Record<string, LetterState> = {};
  for (const letter of ALPHABET) {
    const teachers = lessons.filter((l) => l.teaches?.includes(letter));
    const selfDone = MOVING.includes(letter) && teachers.some((l) => completed.includes(l.id));
    if (items[letter]?.mastered || selfDone) out[letter] = "done";
    else if (teachers.some((l) => unlocked.has(l.id))) out[letter] = "open";
    else out[letter] = "locked";
  }
  return out;
}

/** Letters the lesson just finished taught that are now done (they get the pop animation). */
export function newlyEarned(lessons: LessonLike[], lessonId: string, states: Record<string, LetterState>): string[] {
  const lesson = lessons.find((l) => l.id === lessonId);
  return (lesson?.teaches ?? []).filter((l) => states[l] === "done");
}
