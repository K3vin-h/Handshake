import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { PathNode, type PathNodeState } from "../components/PathNode";
import { StreakXpChip } from "../components/StreakXpChip";
import { buildCurriculum } from "../lib/curriculum";
import { DEMO_PROFILE, WELCOME, fillNames, loadProfile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson, weakItems } from "../lib/progress";

// Home: the path. Units 1-2 are active; Units 3-4 are locked ("Coming later").
// Reads the profile and progress from localStorage only.

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const weak = weakItems(progress);
  const due = dueItems(progress).length;

  const stateOf = (id: string): PathNodeState => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);

  return (
    <div className="page home">
      <header className="hero">
        <div className="row spread">
          <p className="eyebrow">Your path</p>
          <StreakXpChip streakDays={progress.streakDays} xp={progress.xp} />
        </div>
        <h1>{fillNames(WELCOME, profile)}</h1>
        {next ? (
          <div className="row">
            <button type="button" onClick={() => open(next.id)}>
              Continue: {next.id} {next.title}
            </button>
            <a className="link-button" href="#/progress">See progress</a>
          </div>
        ) : (
          <p className="lead">You have finished every lesson that is available right now.</p>
        )}
      </header>

      <div className="home-grid">
        <div className="stack">
          {units.slice(0, 2).map((u, i) => (
            <section key={u.id} className="card" aria-labelledby={`unit-${u.id}`}>
              <h2 id={`unit-${u.id}`}>
                Unit {i + 1} · {u.title}
              </h2>
              <p className="muted">{u.goal}</p>
              <div className="stack">
                {u.lessons
                  .filter((l) => l.scope === "demo")
                  .map((l) => (
                    <PathNode key={l.id} id={l.id} title={l.title} state={stateOf(l.id)} xp={l.xp} onOpen={open} />
                  ))}
              </div>
            </section>
          ))}
          {units.slice(2, 4).map((u, i) => (
            <LockedUnit key={u.id} title={`Unit ${i + 3} · ${u.title}`} />
          ))}
        </div>

        <aside className="stack" aria-label="Your letters">
          <section className="card">
            <h2>Letters in {profile.theirName}</h2>
            <LiveCoverage name={profile.theirName} isLive={isPracticeable} />
          </section>
          <section className="card">
            <h2>Practice</h2>
            {weak.length === 0 && due === 0 ? (
              <p className="muted">Nothing to review yet. Finish a lesson and it will show up here.</p>
            ) : (
              <>
                {weak.length > 0 && <p>Needs practice: <strong>{weak.join(", ")}</strong></p>}
                {due > 0 && <p>{due} {due === 1 ? "item is" : "items are"} due for review.</p>}
              </>
            )}
          </section>
          <p className="muted small">
            <a href="#/welcome">Change names or hand</a>
          </p>
        </aside>
      </div>
    </div>
  );
}
