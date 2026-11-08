import { flatLessons, type Unit } from "../lib/curriculum";
import { isUnlocked, type Progress } from "../lib/progress";
import { ALPHABET, alphabetStates, newlyEarned, type LetterState } from "../screens/alphabetState";

// The alphabet, shown in place (the completion screen) instead of behind a button. Same states and classes as
// #/alphabet, in a smaller grid. Every state is also text (aria-label, check, lock icon): never colour alone.
const LABEL: Record<LetterState, string> = { done: "matches the reference", open: "unlocked, not done yet", locked: "locked" };

export function AlphabetStrip({ units, progress, lessonId }: { units: Unit[]; progress: Progress; lessonId: string }) {
  const lessons = flatLessons(units);
  const unlocked = new Set(lessons.filter((l) => isUnlocked(units, progress, l.id)).map((l) => l.id));
  const states = alphabetStates({ lessons, unlocked, completed: progress.completed, items: progress.items });
  const fresh = newlyEarned(lessons, lessonId, states);
  const done = ALPHABET.filter((l) => states[l] === "done").length;
  return (
    <section className="card alpha-strip alpha-roomy" aria-label="Your alphabet">
      <div className="alpha-strip-head">
        <h2 className="small-title">Your alphabet: {done} of 26</h2>
        <a href="#/alphabet">Full view</a>
      </div>
      <div className="alpha-bar" role="progressbar" aria-label="Letters done" aria-valuemin={0} aria-valuemax={26} aria-valuenow={done}>
        <i style={{ "--p": done / 26 } as React.CSSProperties} />
      </div>
      {fresh.length > 0 && <p role="status" className="alpha-fresh">New: {fresh.join(", ")}</p>}
      <ol className="alpha-grid" aria-label="Alphabet">
        {ALPHABET.map((letter) => {
          const st = states[letter];
          const idx = fresh.indexOf(letter);
          return (
            <li key={letter} className={`alpha-box alpha-${st}${idx >= 0 ? " alpha-new" : ""}`} style={idx >= 0 ? ({ "--i": idx } as React.CSSProperties) : undefined} aria-label={`${letter}, ${LABEL[st]}`}>
              <span aria-hidden="true">{letter}</span>
              {st === "done" && <b className="alpha-check" aria-hidden="true">✓</b>}
              {st === "locked" && <span className="alpha-lock-text" aria-hidden="true">🔒</span>}
            </li>
          );
        })}
      </ol>
      <p className="muted small alpha-legend">✓ matches the reference · grey: open · 🔒 not unlocked yet</p>
    </section>
  );
}
