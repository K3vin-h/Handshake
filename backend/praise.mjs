// Praise after a match the app ALREADY confirmed (landmarks judge; Gemini only cheers). No names ever reach here:
// the body is an id, two small numbers, and messages the server itself issued.
import { LESSON_RE } from "./validate.mjs";

// SIGNS ids from frontend/src/cv/signs.ts. An allowlist, because ITEM_RE would also accept a name like "RYAN".
export const SIGN_IDS = new Set(["HELLO", "BYE", "MY", "NAME", "YOU", "NICE", "MEET", "PLEASE", "THANK-YOU", "SORRY", "GOOD", "FINE",
  "YES", "NO", "HOW", "WHAT", "YOUR", "WORK", "COFFEE", "MEETING", "MOM", "DAD", "LOVE", "FRIEND", "SCHOOL"]);
const TARGET = { letter: (t) => /^([A-Z]|5)$/.test(t), sign: (t) => SIGN_IDS.has(t), lesson: (t) => LESSON_RE.test(t) };
const KEYS = new Set(["kind", "target", "streak", "tries", "recent"]);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** The request body if it fits the contract exactly, else null (→ 400). */
export function praiseBody(b) {
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some((k) => !KEYS.has(k))) return null;
  const target = typeof b.target === "string" ? b.target.toUpperCase() : "";
  if (!Object.hasOwn(TARGET, b.kind) || !TARGET[b.kind](target)) return null;
  if (b.streak !== undefined && !int(b.streak, 0, 50)) return null;
  if (b.tries !== undefined && !int(b.tries, 1, 20)) return null;
  const recent = b.recent ?? [];
  if (!Array.isArray(recent) || recent.length > 5 || !recent.every((m) => typeof m === "string" && m.length <= 80)) return null;
  return { kind: b.kind, target, ...(b.streak !== undefined && { streak: b.streak }), ...(b.tries !== undefined && { tries: b.tries }), recent };
}

export const STYLES = ["cheerful", "calm", "playful", "coach-like", "proud", "warm", "upbeat", "gentle"];

export const CANNED = [
  "That {target} matches the reference. Nice work!",
  "Nice {target}!",
  "Your {target} matches the reference. Keep going!",
  "Lovely {target}, nice and steady.",
  "{target} landed. Great hand shape!",
  "Clean {target}. You're getting the hang of this.",
  "That's a solid {target}.",
  "Smooth {target}! On to the next one.",
  "Steady hand, clear {target}.",
  "{target} matches the reference. Well signed!",
  "Great {target}. Your hand knew just what to do.",
  "Look at that {target}!",
  "Nicely held {target}.",
  "That {target} looks great.",
  "Good one! {target} matches the reference.",
  "You've got {target} down.",
  "Sharp {target}. Keep that rhythm.",
  "{target}, signed and matched. Nice!",
  "Well done on {target}.",
  "That {target} came out clear and calm.",
  "Brilliant {target}!",
  "Strong {target}. Onward!",
  "{target} is looking natural now.",
  "Another one down: {target}!",
  "Your {target} is spot on with the reference.",
  "Great focus on that {target}.",
  "Neat {target}. You're building real skill.",
  "That {target} was a joy to watch.",
];
export const LESSON_CANNED = [
  "Lesson {target} complete. Great signing!",
  "You finished lesson {target}. Well done!",
  "Lesson {target} is done. Your hands are learning fast.",
  "Every step of lesson {target} matched. Nice work!",
  "Lesson {target} complete. On to the next one!",
  "That's lesson {target} finished. Be proud of that.",
];

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A canned line (labelled cached by the caller), never one of `recent` unless every line was shown. */
export function pickCanned(kind, target, recent = [], random = Math.random) {
  const seen = new Set(recent.map(norm));
  const all = (kind === "lesson" ? LESSON_CANNED : CANNED).map((m) => m.replaceAll("{target}", target));
  const fresh = all.filter((m) => !seen.has(norm(m)));
  const pool = fresh.length ? fresh : all;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

const REFUSAL = /\b(i can'?t|i cannot|i'm sorry|i am sorry|as an ai|unable to|i won'?t)\b/i;
const JUDGE = /\b(correct|incorrect|perfect)\b/i;

/** Model text → a safe single line, or null if it must be replaced. */
export function cleanPraise(raw, recent = []) {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().replace(/^["'“‘]+|["'”’]+$/g, "").trim();
  if (!s || s.length > 90 || !/\p{L}{2}/u.test(s) || JUDGE.test(s) || REFUSAL.test(s)) return null;
  if ((s.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) return null;
  if (recent.some((m) => norm(m) === norm(s))) return null;
  return s;
}

export function praisePrompt({ kind, target, streak, tries }, style, avoid) {
  const what = kind === "lesson" ? `finished every step of lesson ${target}`
    : kind === "sign" ? `just signed the sign ${target}`
    : target === "5" ? "just made the open-hand 5 handshape" : `just fingerspelled the letter ${target}`;
  const facts = [
    kind !== "lesson" && streak >= 3 ? `This is ${streak} matches in a row; mention that.` : "",
    kind !== "lesson" && tries === 1 ? "They matched it on the first try; you may mention that." : "",
  ].filter(Boolean).join(" ");
  return `Write ONE short, warm line of praise (max 12 words) for a beginner who ${what} in American Sign Language.
The app's hand tracker already confirmed it matches the reference; you are not judging it.
Tone: ${style}. ${facts}
Rules: never use a person's name; never say "correct" or "perfect" (say it matches the reference, or simple praise like "Nice ${kind === "lesson" ? "work" : target}!"); at most one emoji; no quotes.
${avoid.length ? `Do not repeat or closely copy any of these: ${avoid.map((m) => JSON.stringify(m)).join("; ")}.` : ""}`;
}
