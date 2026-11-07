import { PRACTICEABLE, isPracticeable } from "../cv";
import { loadMistakes, weakFingers } from "../lib/mistakes";
import { loadProgress } from "../lib/progress";

// Progress by letter and by finger. Every chart-like element has the numbers as text.
// Reads localStorage only.

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];

export function ProgressScreen() {
  const progress = loadProgress();
  const fingerCounts = new Map(weakFingers(loadMistakes(), FINGERS.length).map((f) => [f.finger, f.count]));
  const liveLetters = LETTERS.filter((l) => PRACTICEABLE.includes(l));
  const mastered = liveLetters.filter((l) => progress.items[l]?.mastered).length;
  const maxMiss = Math.max(1, ...FINGERS.map((f) => fingerCounts.get(f) ?? 0));

  const statusOf = (l: string) => {
    if (!isPracticeable(l)) return "Reference only";
    const it = progress.items[l];
    if (!it) return "Not started";
    return it.mastered ? "Mastered" : `Practising: ${Math.min(it.streak, 3)} of 3 in a row`;
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Progress</p>
        <h1>Your progress</h1>
        <p className="lead">
          <label htmlFor="mastered-meter">
            <strong>{mastered} of {liveLetters.length}</strong> live letters mastered
          </label>
        </p>
        <progress id="mastered-meter" className="meter" value={mastered} max={liveLetters.length} />
      </header>

      <section className="card" aria-labelledby="by-letter">
        <h2 id="by-letter">By letter</h2>
        <p className="muted small">Mastered means matching the reference 3 times in a row. Reference-only letters have no pass or fail.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Letter</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Misses</th>
              </tr>
            </thead>
            <tbody>
              {LETTERS.map((l) => {
                const it = progress.items[l];
                return (
                  <tr key={l}>
                    <th scope="row">{l}</th>
                    <td>
                      <span className={`pill ${!isPracticeable(l) ? "pill-ref" : it?.mastered ? "pill-done" : "pill-live"}`}>{statusOf(l)}</span>
                    </td>
                    <td>{it?.attempts ?? 0}</td>
                    <td>{it?.misses ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="by-finger">
        <h2 id="by-finger">By finger</h2>
        <p className="muted small">How often the camera measured each finger away from the reference. Fewer is better.</p>
        {fingerCounts.size === 0 && <p className="muted">No finger differences recorded yet. Practise a lesson and they will appear here.</p>}
        <ul className="finger-list">
          {FINGERS.map((f) => {
            const n = fingerCounts.get(f) ?? 0;
            return (
              <li key={f}>
                <span className="finger-name">{f[0].toUpperCase() + f.slice(1)}</span>
                <progress className="meter meter-small" value={n} max={maxMiss} aria-label={`${f}: ${n} differences`} />
                <span className="finger-count">{n} {n === 1 ? "difference" : "differences"}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
