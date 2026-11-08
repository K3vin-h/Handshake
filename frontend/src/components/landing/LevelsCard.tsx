import type { LessonState } from "./LevelDeck";
import "./landing.css";

/**
 * Sits next to the progress panel on Home. A little preview of the winding circles with a button to the full path page.
 * State is a symbol plus text (check, lock, number), never colour alone; the trail itself is decoration.
 */
export function LevelsCard(props: { unitNumber: number; unitTitle: string; lessons: { id: string; state: LessonState }[]; onOpen(): void }) {
  const { unitNumber, unitTitle, lessons, onOpen } = props;
  const shown = lessons.slice(0, 5);
  const OFFSET = [0, 34, 56, 34, 0];
  return (
    <section className="lp-duo-col lp-levels-card" aria-labelledby="lp-levelscard-title">
      <div className="lp-section-head">
        <h2 id="lp-levelscard-title">Levels</h2>
        <p className="muted">Your trail, one circle per lesson.</p>
      </div>
      <div className="lp-trail-card">
        <p className="lp-trail-unit">
          Level {unitNumber}: {unitTitle}
        </p>
        <ol className="lp-trail" aria-label={`Lessons in level ${unitNumber}`}>
          {shown.map((l, i) => (
            <li key={l.id} className={`lp-orb lp-orb-${l.state}`} style={{ ["--o" as string]: `${OFFSET[i % OFFSET.length]}px`, ["--k" as string]: i }}>
              <span aria-hidden="true">{l.state === "done" ? "✓" : l.state === "locked" ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /></svg> : l.id}</span>
              <span className="sr-only">
                Lesson {l.id}, {l.state === "current" ? "up next" : l.state === "available" ? "ready" : l.state}
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="lp-cta lp-cta-sm" onClick={onOpen}>
          Open the level path
        </button>
      </div>
    </section>
  );
}
