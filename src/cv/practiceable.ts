// Human-gated live letters: add a letter only after the required >=8/10 tests
// on a non-recorder and ASL-NOW hands are logged in docs/test-log.md.
// Recording templates alone does not qualify a letter for live grading.
// ponytail: restored the pre-gate list by Ryan's call (2026-11-07) so lessons have camera practice; not gate-tested yet, see docs/test-log.md.
export const PRACTICEABLE: string[] = ["A", "B", "C", "D", "F", "I", "L", "O", "V", "W", "Y", "5", "H"];
export const isPracticeable = (letter: string) => PRACTICEABLE.includes(letter);
