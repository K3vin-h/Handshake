import type { Lesson } from "../lib/curriculum";

/**
 * The line at the top of Home ("Learn the letters of your name"). Written by hand, one per lesson, no AI and no network:
 * it only says what the learner is doing now, never what they will achieve.
 *
 * - Unit 1, 3 and 4 lessons have fixed ids, so they are matched by id.
 * - Unit 2 ids shift when "Spell <their name>" is slotted in, so those are matched by their family title.
 * - Anything unknown (a new lesson added later) falls back to "Next up: <title>", so no lesson is ever left without a line.
 *
 * @param lesson the lesson shown as "next" on Home
 * @param them   their first name as the learner typed it (stays in the browser)
 */
export function lessonHeadline(lesson: Lesson, them: string): string {
  const byId: Record<string, string> = {
    "1.1": "Learn the letters of your name",
    "1.2": "Spell your whole name",
    "1.3": "Checkpoint: spell your name from memory",
    "3.1": "Learn the signs for your introduction",
    "3.2": "Put it together: hello, nice to meet you, my name is…",
    "3.3": "Polite words: please, thank you, sorry",
    "3.4": "Learn how to ask questions",
    "3.5": "Answering: yes, no, good, fine",
    "4.1": "Your first conversation",
    "4.2": "Ask how someone is, and answer",
    "4.3": "Practise a little small talk",
    "4.4": "The full conversation",
  };
  if (byId[lesson.id]) return byId[lesson.id];

  const byTitle: Record<string, string> = {
    "Flat and curved": "Flat and curved hands: B, C and O",
    "Point and pinky": "Pointing and pinky shapes: D, I, L and Y",
    "Two and three fingers": "Two and three fingers: V, W and F",
    "The fist": "The fist: the letter A",
    "More finger shapes": "More finger shapes: U, K and R",
    "The fist family": "The fist family: S, E, T, M and N",
    "Sideways shapes": "Sideways shapes: G, H, P, Q and X",
    "Moving letters": "Letters that move: J and Z",
    "Alphabet checkpoint": "Alphabet checkpoint",
  };
  if (byTitle[lesson.title]) return byTitle[lesson.title];

  if (/^Spell /i.test(lesson.title) && lesson.id.startsWith("2.")) return `Spell ${them}'s name`;
  if (lesson.id === "3.6") return lesson.title; // "Words for your coworker" or "Everyday words"
  return `Next up: ${lesson.title}`;
}
