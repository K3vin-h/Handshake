import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { UnitSection, type MapLesson } from "../components/PathMap";
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

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);

  return (
    <div className="page home">
      <header className="hero">
        <p className="eyebrow">Your path</p>
        <h1>{fillNames(WELCOME, profile)}</h1>
        {next ? (
          <div className="row">
            <button type="button" className="start-button" onClick={() => open(next.id)}>
              Continue: {next.id} {next.title}
            </button>
            <a className="link-button" href="#/progress">See progress</a>
          </div>
        ) : (
          <p className="lead">You have finished every lesson that is available right now.</p>
        )}
      </header>

      <div className="home-layout">
        <div className="units">
          {units.slice(0, 2).map((u, i) => (
            <UnitSection
              key={u.id}
              index={i + 1}
              title={u.title}
              goal={u.goal}
              lessons={u.lessons.filter((l) => l.scope === "demo").map((l) => ({ id: l.id, title: l.title, summary: l.summary, xp: l.xp, state: stateOf(l.id) }))}
              onOpen={open}
            />
          ))}
          <div className="locked-grid">
            {units.slice(2, 4).map((u, i) => (
              <LockedUnit key={u.id} title={`Unit ${i + 3} · ${u.title}`} />
            ))}
          </div>
        </div>

        <aside className="side" aria-label="Your letters and practice">
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
