// Letters + handshapes the recognizer is trusted on. Group 1 removes any that fail the H8 accuracy test.
export const PRACTICEABLE = ["A", "B", "C", "D", "F", "I", "L", "O", "V", "W", "Y", "5", "H"];
export const isPracticeable = (l: string) => PRACTICEABLE.includes(l);
