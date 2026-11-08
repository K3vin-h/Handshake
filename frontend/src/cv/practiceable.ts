// Live letters: the ones the lessons grade with the camera. J and Z move, so they are never live.
// The letter gate (CLAUDE.md) wants >=8/10 tries by a person who did NOT record the templates, logged in docs/test-log.md.
// ponytail: A-Y without J/Z and the 5 handshape are ALL live by Ryan's call (2026-11-07) so the whole alphabet is playable.
// Not gate-tested yet. Until docs/test-log.md has the scores, UI and Devpost say "matches our recording", never "accurate".
// Weakest look-alikes in the trained model: U/R, M/N, P/Q, T/A, E/S, X/P, G/H, D/F.
export const PRACTICEABLE: string[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "5",
];
export const isPracticeable = (letter: string) => PRACTICEABLE.includes(letter);
