import type { ReactNode } from "react";
import { isPracticeable } from "../cv";
import { CoachTip } from "./CoachTip";
import { HoldRing } from "./HoldRing";
import { StatusMessage, type StatusKind } from "./StatusMessage";

// The lesson layout. Presentational only: LessonPlayer (Ryan) supplies the camera, the 3D reference and the text.
// Keep these prop names; they are the agreed contract in CLAUDE.md.
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
  status: string; // announced via aria-live, e.g. "Matches our recording: L"
  stepLabel: string; // "Step 2 of 9"
  actionLabel: string; // "Skip" or "Continue"
  onAction: () => void;
  onSelfCheck?: () => void; // self-graded signs: "I signed it"
};

/** Picks the status style from the wording the player sends. The text always carries the meaning. */
function kindOf(status: string): StatusKind {
  if (/^matches/i.test(status)) return "match";
  if (/^not /i.test(status)) return "notyet";
  return "info";
}

export function LessonView(p: LessonViewProps) {
  return (
    <div className={`page lesson${p.sideBySide ? " lesson-compare" : ""}`}>
      <header className="lesson-head">
        <p className="eyebrow">{p.stepLabel}</p>
        <h1>{p.title}</h1>
      </header>

      {p.word && (
        <ol className="word-tiles" aria-label="Letters of the word">
          {p.word.letters.map((l, i) => {
            const state = i < p.word!.index ? "done" : i === p.word!.index ? "current" : "todo";
            return (
              <li key={i} className={`tile tile-${state}`} aria-current={state === "current" ? "step" : undefined}>
                <span className="tile-letter">{l}</span>
                <span className="tile-state">
                  {state === "done" ? "✓ Done" : state === "current" ? "Now" : isPracticeable(l) ? "Next" : "Reference only"}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="lesson-main">
        <div className="lesson-left">
          <section className="card lesson-camera" aria-label="Your camera">
            <h2 className="small-title">Your hand</h2>
            {p.camera}
          </section>
          <div className="row">
            {p.onSelfCheck && (
              <button type="button" onClick={p.onSelfCheck}>
                I signed it
              </button>
            )}
            <button type="button" className={p.onSelfCheck ? "secondary" : p.actionLabel === "Continue" ? "" : "secondary"} onClick={p.onAction}>
              {p.actionLabel}
            </button>
          </div>
        </div>

        {/* Side panel: hold progress, the live result, the coach, and the reference. Sticky on wide screens. */}
        <aside className="card coach-panel" aria-label="Coach and reference">
          <div className="panel-ring-row">
            <HoldRing progress={p.progress} label={`Hold progress for ${p.target}`} size={84} />
            <p className="panel-target">
              Target <strong>{p.target}</strong>
            </p>
          </div>
          <StatusMessage kind={kindOf(p.status)} label={false} message={p.status} />
          <CoachTip instantTip={p.landmarkTip} coachText={p.coachTip || undefined} coachCached={p.coachCached} />
          {(p.showReference || p.sideBySide) && (
            <section aria-label={p.sideBySide ? "Compare: reference vs your hand" : "Reference"}>
              <h2 className="small-title">{p.sideBySide ? "Compare: reference vs your hand" : "Reference"}</h2>
              {p.reference}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
