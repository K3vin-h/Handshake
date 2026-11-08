// Human-gated live letters: add a letter only after the required >=8/10 tests
// on a non-recorder and ASL-NOW hands are logged in docs/test-log.md.
// Recording templates alone does not qualify a letter for live grading.
export const PRACTICEABLE: string[] = [];
export const isPracticeable = (letter: string) => PRACTICEABLE.includes(letter);
