import { useMemo } from "react";
import { PRACTICEABLE, isPracticeable } from "../cv";
import { LetterBadge, type LetterStatus } from "../components/LetterBadge";
import { StatusBadge, type BadgeKind } from "../components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { buildCurriculum } from "../lib/curriculum";
import { loadMistakes, weakFingers } from "../lib/mistakes";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { dueItems, loadProgress, nextLesson, weakItems } from "../lib/progress";

// Progress (Stats folded in). Every number comes from localStorage via the progress and mistakes code:
// no server call, so there is no "cloud" or "notifications" state to describe. If a figure has no data yet,
// its section shows a one-line local empty state or is left out.
// Wording rule: "matches the reference", never "correct".

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const pct = (n: number, of: number) => Math.round((n / of) * 100);

export function ProgressScreen() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const progress = loadProgress();
  const units = useMemo(() => buildCurriculum(profile).filter((u) => ["u1", "u2"].includes(u.id)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const fingerCounts = new Map(weakFingers(loadMistakes(), FINGERS.length).map((f) => [f.finger, f.count]));
  const maxMiss = Math.max(1, ...FINGERS.map((f) => fingerCounts.get(f) ?? 0));

  const demo = units.flatMap((u) => u.lessons).filter((l) => l.scope === "demo");
  const lessonsDone = demo.filter((l) => progress.completed.includes(l.id)).length;
  const next = nextLesson(units, progress);

  const items = Object.values(progress.items);
  const tries = items.reduce((n, it) => n + it.attempts, 0);
  const matched = items.reduce((n, it) => n + (it.attempts - it.misses), 0);

  const liveLetters = LETTERS.filter((l) => PRACTICEABLE.includes(l));
  const mastered = liveLetters.filter((l) => progress.items[l]?.mastered).length;

  const due = dueItems(progress);
  const needs = weakItems(progress, 5);
  const weakest = Object.entries(progress.items)
    .filter(([, it]) => it.attempts >= 2 && !it.mastered)
    .sort((a, b) => b[1].misses / b[1].attempts - a[1].misses / a[1].attempts)
    .slice(0, 5);

  const stateOf = (l: string): Exclude<LetterStatus, "reference-only"> => {
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practising" : "not-started";
  };
  const statusOf = (l: string): { kind: BadgeKind; text: string } => {
    if (!isPracticeable(l)) return { kind: "reference-only", text: "Reference only" };
    const it = progress.items[l];
    if (!it) return { kind: "not-started", text: "Not started" };
    return it.mastered ? { kind: "mastered", text: "Mastered" } : { kind: "practising", text: `Practising: ${Math.min(it.streak, 3)} of 3 in a row` };
  };

  return (
    <div className="page progress-page">
      <section className="focus stagger" style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="prog-title">
        <p className="focus-eyebrow">Progress</p>
        <h1 id="prog-title">
          {lessonsDone} of {demo.length} lessons done
        </h1>
        <div
          className="focus-bar"
          role="progressbar"
          aria-label="Lessons done"
          aria-valuemin={0}
          aria-valuemax={demo.length}
          aria-valuenow={lessonsDone}
          aria-valuetext={`${lessonsDone} of ${demo.length} lessons`}
        >
          <span style={{ width: `${demo.length ? pct(lessonsDone, demo.length) : 0}%` }} />
        </div>
        <dl className="focus-stats">
          <div>
            <dt>Streak</dt>
            <dd>{progress.streakDays} {progress.streakDays === 1 ? "day" : "days"}</dd>
          </div>
          <div>
            <dt>XP</dt>
            <dd>{progress.xp}</dd>
          </div>
          <div>
            <dt>Matches the reference</dt>
            <dd>{tries > 0 ? `${pct(matched, tries)}%` : "No tries yet"}</dd>
            {tries > 0 && <dd className="focus-sub">{matched} of {tries} tries</dd>}
          </div>
        </dl>
      </section>

      <div className="quiet-grid stagger" style={{ "--i": 1 } as React.CSSProperties}>
        <section className="rail" aria-labelledby="q-next">
          <h2 id="q-next">Practise next</h2>
          {next ? (
            <p>
              <a href={`#/lesson/${next.id}`}>Lesson {next.id}: {next.title}</a> · {next.xp} XP
            </p>
          ) : (
            <p className="muted">You finished every lesson that is available right now.</p>
          )}
          {due.length > 0 && (
            <>
              <p className="rail-label">Due for review</p>
              <div className="chip-row">
                {due.map((l) => (
                  <LetterBadge key={l} letter={l} status={isPracticeable(l) ? stateOf(l) : "reference-only"} />
                ))}
              </div>
            </>
          )}
          {needs.length > 0 && (
            <>
              <p className="rail-label">Needs practice</p>
              <div className="chip-row">
                {needs.map((l) => (
                  <LetterBadge key={l} letter={l} status={isPracticeable(l) ? stateOf(l) : "reference-only"} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rail" aria-labelledby="q-weak">
          <h2 id="q-weak">Weakest letters</h2>
          {weakest.length === 0 ? (
            <p className="muted">Nothing to show yet. After a few tries, the letters that match the reference least often appear here.</p>
          ) : (
            <ul className="plain-list">
              {weakest.map(([l, it]) => (
                <li key={l}>
                  <strong>{l}</strong>: matched the reference {pct(it.attempts - it.misses, it.attempts)}% of {it.attempts} tries
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rail" aria-labelledby="q-finger">
          <h2 id="q-finger">By finger</h2>
          {fingerCounts.size === 0 ? (
            <p className="muted">No finger differences recorded yet. Practise a lesson and they will appear here.</p>
          ) : (
            <ul className="finger-list">
              {FINGERS.map((f) => {
                const n = fingerCounts.get(f) ?? 0;
                return (
                  <li key={f}>
                    <span className="finger-name">{f[0].toUpperCase() + f.slice(1)}</span>
                    <Progress className="min-w-16 flex-1" value={(n / maxMiss) * 100} aria-label={`${f}: ${n} differences`} />
                    <span className="finger-count">{n} {n === 1 ? "difference" : "differences"}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="muted small">How often the camera measured each finger away from the reference. Fewer is better.</p>
        </section>
      </div>

      <section className="rail letters-section" aria-labelledby="q-letters">
        <h2 id="q-letters">Letters</h2>
        <details className="disclosure">
          <summary>
            Alphabet{" "}
            <span className="muted">
              · {mastered} of {liveLetters.length} live mastered, {LETTERS.length - liveLetters.length} reference only. Open or close the list.
            </span>
          </summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Letter</th>
                  <th scope="col">Status</th>
                  <th scope="col">Tries</th>
                  <th scope="col">Matched the reference</th>
                </tr>
              </thead>
              <tbody>
                {LETTERS.map((l) => {
                  const it = progress.items[l];
                  const st = statusOf(l);
                  return (
                    <tr key={l}>
                      <th scope="row">{l}</th>
                      <td>
                        <StatusBadge kind={st.kind}>{st.text}</StatusBadge>
                      </td>
                      <td>{it?.attempts ?? 0}</td>
                      <td>{it && it.attempts > 0 ? `${it.attempts - it.misses} of ${it.attempts}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
        <p className="muted small">Mastered means matching the reference 3 times in a row. Reference-only letters have no pass or fail.</p>
      </section>
    </div>
  );
}
