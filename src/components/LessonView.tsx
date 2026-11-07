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
  // Optional, Duolingo-style footer (added by Group 1; old callers unaffected):
  lessonProgress?: number; // 0..1 through the lesson, drawn as a bar at the top
  feedback?: "match" | "miss"; // colours the footer AND adds a ✓/✗ icon (never colour alone)
  actionDisabled?: boolean; // "Continue" stays disabled until the sign matches
  onRetry?: () => void; // "Try again" after a match
  onSkip?: () => void; // move on without a match (not counted as one)
};

// STUB (Group 2 replaces in group-2 Task 3).
export function LessonView(p: LessonViewProps) {
  const icon = p.feedback === "match" ? "✓ " : p.feedback === "miss" ? "✗ " : "";
  return (
    <div className="page">
      {p.lessonProgress !== undefined && <progress className="lesson-progress" value={p.lessonProgress} max={1} aria-label={p.stepLabel} />}
      <h1>{p.title}</h1>
      <p className="muted">{p.stepLabel}</p>
      {p.word && <p>{p.word.letters.map((l, i) => (i === p.word!.index ? `[${l}]` : l)).join(" ")}</p>}
      <div className="lesson-grid">
        <section>{p.showReference && p.reference}</section>
        <section>{p.camera}</section>
      </div>
      <div className={`lesson-footer ${p.feedback ?? ""}`}>
        <p className="lesson-status" role="status" aria-live="polite">{icon}{p.status}</p>
        {p.landmarkTip && <div className="tip">{p.landmarkTip}</div>}
        {p.coachTip && <div className="tip">Coach{p.coachCached ? " (cached)" : ""}: {p.coachTip}</div>}
        <div className="row">
          {p.onSelfCheck && <button onClick={p.onSelfCheck}>I signed it</button>}
          {p.onSkip && <button className="secondary" onClick={p.onSkip}>Skip</button>}
          {p.onRetry && <button className="secondary" onClick={p.onRetry}>Try again</button>}
          <button className={p.onRetry || p.actionDisabled !== undefined ? "" : "secondary"} onClick={p.onAction} disabled={p.actionDisabled}>{p.actionLabel}</button>
        </div>
      </div>
    </div>
  );
}
