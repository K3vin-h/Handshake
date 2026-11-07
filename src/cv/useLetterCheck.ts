import { useHandTracking } from "./useHandTracking";
import { loadTemplates } from "./classifier";
import type { FingerFeedback, HandFrame, Prediction, SignDetection } from "./types";

export type LetterCheckOptions = {
  leftHanded?: boolean;
  holdMs?: number;
  enabled?: boolean;
  onMatch?: (d: SignDetection) => void;
  onMiss?: (feedback: FingerFeedback[], missCount: number) => void;
  onFrame?: (hand: HandFrame | null, pred: Prediction, now: number) => void;
};

export const inFrame = (h: HandFrame) => h.landmarks.every((p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99);

// STUB (Group 1 replaces in group-1 Task 4). Same return shape as the real hook.
export function useLetterCheck(_target: string, _lessonLetters: string[], _opts: LetterCheckOptions = {}) {
  const cam = useHandTracking(() => {});
  return {
    cam,
    progress: 0,
    prediction: null as Prediction | null,
    missCount: 0,
    hint: "",
    templates: loadTemplates(),
    snapshot: () => cam.snapshot(null),
    reset: () => {},
  };
}
