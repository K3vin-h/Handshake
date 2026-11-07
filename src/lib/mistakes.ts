import type { ErrorCode } from "../cv/types";

// STUB (Group 1 replaces in group-1 Task 2). Per letter, per error code: how often and when last.
export type Mistakes = Record<string, Partial<Record<ErrorCode, { count: number; lastAt: number }>>>;
export const loadMistakes = (): Mistakes => ({});
export const saveMistakes = (_m: Mistakes) => {};
export const recordMistake = (m: Mistakes, _letter: string, _code: ErrorCode, _now = Date.now()): Mistakes => m;
export const mistakeCount = (_m: Mistakes, _letter: string, _code: ErrorCode) => 0;
export const weakFingers = (_m: Mistakes, _limit = 3): { finger: string; count: number }[] => [];
