import type { HandFrame, Prediction } from "./types";

// Whole-sign checking for Units 3–4 ("assisted" grading).
// A sign = HANDSHAPE (recognized like a letter) + LOCATION (zone on the body) + MOVEMENT
// (from the wrist's path). That's how ASL dictionaries describe signs, and it's checkable
// with what we already have. Two-handed or face-dependent signs fall back to self-check.
//
// IMPORTANT: descriptions are simplified. Before the demo, have someone fluent check each
// one against a Deaf-led source such as Lifeprint (lifeprint.com). `verified` tracks that.

export type Zone = "forehead" | "chin" | "chest" | "side";
export type Movement = "none" | "away" | "down" | "side" | "tap" | "circle";

export type SignDef = {
  id: string; // gloss, e.g. "THANK-YOU"
  english: string;
  /** Recognizer label for the handshape: a letter, or "5" (open hand; record it on #/record). */
  handshape: string;
  zone: Zone;
  movement: Movement;
  /** Other movements that also count (a camera sees the same real motion as different directions). */
  alsoMovement?: Movement[];
  howTo: string;
  /** "assisted" = auto-checked as above; "self" = two-handed / needs the face: learner confirms. */
  grading: "assisted" | "self";
  /** Topic packs Gemini can pick from during onboarding. */
  packs?: ("coworker" | "friend" | "family" | "classmate" | "partner")[];
  verified?: boolean;
};

export const SIGNS: Record<string, SignDef> = {
  HELLO: { id: "HELLO", english: "hello", handshape: "B", zone: "forehead", movement: "away", alsoMovement: ["side"], grading: "assisted", howTo: "Flat hand at the side of your forehead, then move it outward, like a small salute." },
  BYE: { id: "BYE", english: "bye", handshape: "5", zone: "side", movement: "side", grading: "assisted", howTo: "Open hand, palm out, and wave." },
  MY: { id: "MY", english: "my", handshape: "B", zone: "chest", movement: "none", grading: "assisted", howTo: "Flat palm placed on your chest." },
  NAME: { id: "NAME", english: "name", handshape: "H", zone: "chest", movement: "tap", grading: "assisted", howTo: "Both hands in the H shape; tap the top fingers on the bottom fingers twice." },
  YOU: { id: "YOU", english: "you", handshape: "D", zone: "chest", movement: "away", grading: "assisted", howTo: "Point your index finger at the person you're talking to." },
  NICE: { id: "NICE", english: "nice", handshape: "B", zone: "chest", movement: "side", grading: "self", howTo: "Slide one flat palm across the other flat palm." },
  MEET: { id: "MEET", english: "meet", handshape: "D", zone: "chest", movement: "side", grading: "self", howTo: "Two index fingers pointing up come together in front of you." },
  PLEASE: { id: "PLEASE", english: "please", handshape: "B", zone: "chest", movement: "circle", grading: "assisted", howTo: "Flat hand on your chest, rub in a circle." },
  "THANK-YOU": { id: "THANK-YOU", english: "thank you", handshape: "B", zone: "chin", movement: "away", grading: "assisted", howTo: "Fingertips of a flat hand start at your chin and move forward and down." },
  SORRY: { id: "SORRY", english: "sorry", handshape: "A", zone: "chest", movement: "circle", grading: "assisted", howTo: "A-hand (fist, thumb at the side) on your chest, rub in a circle." },
  GOOD: { id: "GOOD", english: "good", handshape: "B", zone: "chin", movement: "down", grading: "assisted", howTo: "Flat hand starts at your chin and moves down onto your other palm." },
  FINE: { id: "FINE", english: "fine", handshape: "5", zone: "chest", movement: "tap", grading: "assisted", howTo: "Open hand, tap your thumb on your chest." },
  YES: { id: "YES", english: "yes", handshape: "S", zone: "chest", movement: "tap", grading: "assisted", howTo: "Fist in front of you, nod it up and down like a head nodding." },
  NO: { id: "NO", english: "no", handshape: "U", zone: "chest", movement: "tap", grading: "self", howTo: "Index and middle fingers snap down onto your thumb." },
  HOW: { id: "HOW", english: "how", handshape: "A", zone: "chest", movement: "away", grading: "self", howTo: "Bent hands back to back, roll forward. Eyebrows down for the question." },
  WHAT: { id: "WHAT", english: "what", handshape: "5", zone: "chest", movement: "side", grading: "self", howTo: "Open hands, palms up, small shake. Eyebrows down." },
  YOUR: { id: "YOUR", english: "your", handshape: "B", zone: "chest", movement: "away", grading: "assisted", howTo: "Flat palm facing the person you're talking to." },
  WORK: { id: "WORK", english: "work", handshape: "S", zone: "chest", movement: "tap", grading: "assisted", packs: ["coworker"], howTo: "Tap the wrist of one fist on the back of the other fist twice." },
  COFFEE: { id: "COFFEE", english: "coffee", handshape: "S", zone: "chest", movement: "circle", grading: "assisted", packs: ["coworker", "friend", "partner"], howTo: "One fist on top of the other, circle the top one like grinding beans." },
  MEETING: { id: "MEETING", english: "meeting", handshape: "5", zone: "chest", movement: "side", grading: "self", packs: ["coworker"], howTo: "Open hands with fingers spread come together, fingertips meeting." },
  MOM: { id: "MOM", english: "mom", handshape: "5", zone: "chin", movement: "tap", grading: "assisted", packs: ["family"], howTo: "Open hand, tap your thumb on your chin." },
  DAD: { id: "DAD", english: "dad", handshape: "5", zone: "forehead", movement: "tap", grading: "assisted", packs: ["family"], howTo: "Open hand, tap your thumb on your forehead." },
  LOVE: { id: "LOVE", english: "love", handshape: "S", zone: "chest", movement: "none", grading: "self", packs: ["family", "partner"], howTo: "Cross both fists over your chest." },
  FRIEND: { id: "FRIEND", english: "friend", handshape: "X", zone: "chest", movement: "tap", grading: "self", packs: ["friend", "classmate"], howTo: "Hook index fingers together, then switch which is on top." },
  SCHOOL: { id: "SCHOOL", english: "school", handshape: "B", zone: "chest", movement: "tap", grading: "self", packs: ["classmate"], howTo: "Clap your top flat hand on your bottom palm twice." },
};

export const PACK_WORDS = (pack: string) => Object.values(SIGNS).filter((s) => s.packs?.includes(pack as never)).map((s) => s.id);

/** Vertical zones as a fraction of frame height (0 = top). Tune at the venue: depends on camera framing. */
export const ZONES: Record<Exclude<Zone, "side">, [number, number]> = {
  forehead: [0, 0.32],
  chin: [0.32, 0.48],
  chest: [0.48, 0.9],
};

type Sample = { t: number; x: number; y: number; size: number };

function handCenter(hand: HandFrame) {
  const lm = hand.landmarks;
  const x = lm.reduce((s, p) => s + p.x, 0) / lm.length;
  const y = lm.reduce((s, p) => s + p.y, 0) / lm.length;
  const size = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y);
  return { x, y, size };
}

export function zoneOf(hand: HandFrame): Zone {
  const { x, y } = handCenter(hand);
  if (x < 0.15 || x > 0.85) return "side";
  if (y < ZONES.forehead[1]) return "forehead";
  if (y < ZONES.chin[1]) return "chin";
  return "chest";
}

/** Number of direction changes larger than minAmp (2+ = back-and-forth, like a tap or a wave). */
function reversals(values: number[], minAmp: number) {
  let count = 0, dir = 0, hi = values[0], lo = values[0];
  for (const v of values) {
    hi = Math.max(hi, v);
    lo = Math.min(lo, v);
    if (dir !== -1 && v < hi - minAmp) {
      if (dir === 1) count++;
      dir = -1;
      hi = lo = v;
    } else if (dir !== 1 && v > lo + minAmp) {
      if (dir === -1) count++;
      dir = 1;
      hi = lo = v;
    }
  }
  return count;
}

/** Classify the movement in a window of hand samples (image coords). */
export function classifyMovement(samples: Sample[]): Movement {
  if (samples.length < 6) return "none";
  const a = samples[0], b = samples[samples.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  let path = 0;
  for (let i = 1; i < samples.length; i++) path += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  const net = Math.hypot(dx, dy);
  const xs = samples.map((s) => s.x), ys = samples.map((s) => s.y);
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);

  // Toward the camera: the hand grows on screen even if it barely moves across it.
  if (b.size > a.size * 1.15) return "away";
  if (path < 0.04) return "none";
  if (reversals(ys, 0.015) >= 2 && spanX < 0.06) return "tap";
  if (path > 3 * net && spanX > 0.04 && spanY > 0.04) return "circle";
  if (dy < -0.04 && Math.abs(dx) > 0.03) return "away"; // outward from the head (e.g. HELLO's salute)
  if (dy > 0.07 && Math.abs(dy) > Math.abs(dx)) return "down";
  if (Math.abs(dx) > 0.07 || reversals(xs, 0.03) >= 2) return "side";
  return "none";
}

export type SignStage = "handshape" | "position" | "movement" | "done";
export type SignCheck = { stage: SignStage; message: string };

/**
 * Step-by-step checker: 1) right handshape, 2) in the right place (held ~0.3 s),
 * 3) the right movement within ~1.5 s. Feed it every frame with the recognizer's prediction.
 */
export class SignChecker {
  private stage: SignStage = "handshape";
  private placedSince = 0;
  private samples: Sample[] = [];
  private moveStart = 0;

  sign: SignDef;
  constructor(sign: SignDef) {
    this.sign = sign; // explicit (not a parameter property) so `node --test` can strip types
  }

  reset() {
    this.stage = "handshape";
    this.samples = [];
  }

  update(hand: HandFrame | null, pred: Prediction, now: number): SignCheck {
    const s = this.sign;
    if (this.stage === "done") return { stage: "done", message: `${s.english}: nice!` };
    if (!hand) return { stage: this.stage, message: "Show your hand to the camera" };

    const shapeOk = pred.letter === s.handshape;
    const zone = zoneOf(hand);

    if (this.stage !== "movement") {
      if (!shapeOk) {
        this.stage = "handshape";
        return { stage: "handshape", message: `Make the ${s.handshape === "5" ? "open hand" : s.handshape} handshape` };
      }
      if (zone !== s.zone) {
        this.stage = "position";
        this.placedSince = now;
        return { stage: "position", message: `Good handshape. Now move your hand to your ${s.zone}` };
      }
      if (now - this.placedSince < 300) return { stage: "position", message: "Hold it there…" };
      if (s.movement === "none") {
        this.stage = "done";
        return { stage: "done", message: `${s.english}: nice!` };
      }
      this.stage = "movement";
      this.moveStart = now;
      this.samples = [];
    }

    const c = handCenter(hand);
    this.samples.push({ t: now, ...c });
    const move = classifyMovement(this.samples);
    if (move === s.movement || s.alsoMovement?.includes(move)) {
      this.stage = "done";
      return { stage: "done", message: `${s.english}: nice!` };
    }
    if (now - this.moveStart > 1500) {
      this.stage = "handshape"; // start over, the coach can explain what happened
      return { stage: "handshape", message: `Try the movement again: ${s.howTo}` };
    }
    return { stage: "movement", message: movementHint(s.movement) };
  }
}

function movementHint(m: Movement) {
  return {
    none: "Hold still",
    away: "Now move it away from you",
    down: "Now move it down",
    side: "Now move it side to side",
    tap: "Now tap twice",
    circle: "Now make a small circle",
  }[m];
}
