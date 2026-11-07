import type { ReactNode } from "react";

export type LessonViewProps = {
  title: string; // "Sign L", "Spell LILY", "Sign hello"
  target: string; // letter or sign id being checked
  word?: { letters: string[]; index: number }; // spell steps: letter row with the current one highlighted
  reference: ReactNode; // 3D hand, supplied by LessonPlayer
  showReference: boolean;
  camera: ReactNode; // <Camera {...cam} />
  progress: number; // 0..1 hold progress
  landmarkTip: string; // instant tip from getHandFeedback (shown first)
  coachTip: string; // Gemini tip, '' while loading
  coachCached: boolean; // label "cached" when true
  sideBySide: boolean; // 3rd repeat of the same mistake: reference beside the live hand, large
  status: string; // announced via aria-live, e.g. "Matches the reference: L"
  stepLabel: string; // "Step 2 of 9"
  actionLabel: string; // "Skip" or "Continue"
  onAction: () => void;
  onSelfCheck?: () => void; // self-graded signs: "I signed it"
};

// STUB (Group 2 replaces in group-2 Task 3).
export function LessonView(p: LessonViewProps) {
  return (
    <div className="page">
      <h1>{p.title}</h1>
      <p className="muted">{p.stepLabel}</p>
      {p.word && <p>{p.word.letters.map((l, i) => (i === p.word!.index ? `[${l}]` : l)).join(" ")}</p>}
      <div className="lesson-grid">
        <section>{p.showReference && p.reference}</section>
        <section>{p.camera}</section>
      </div>
      <p role="status" aria-live="polite">{p.status}</p>
      {p.landmarkTip && <div className="tip">{p.landmarkTip}</div>}
      {p.coachTip && <div className="tip">Coach{p.coachCached ? " (cached)" : ""}: {p.coachTip}</div>}
      {p.onSelfCheck && <button onClick={p.onSelfCheck}>I signed it</button>}
      <button className="secondary" onClick={p.onAction}>{p.actionLabel}</button>
    </div>
  );
}
