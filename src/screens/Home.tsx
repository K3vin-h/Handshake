import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { UnitSection, type MapLesson } from "../components/PathMap";
import { LetterBadge, type LetterStatus } from "../components/LetterBadge";
import { buildCurriculum } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Home: the path. Units 1-2 are active; Units 3-4 are locked ("Coming later").
// Reads the profile and progress from localStorage only.

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const due = dueItems(progress);
  const letterState = (l: string): Exclude<LetterStatus, "reference-only"> => {
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practising" : "not-started";
  };

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);
  const themKey = profile.theirName.toUpperCase().replace(/[^A-Z]/g, "");
  const spellThem = units.flatMap((u) => u.lessons).find((l) => l.title.toUpperCase() === `SPELL ${themKey}`);
  const spellOpen = spellThem ? isUnlocked(units, progress, spellThem.id) : false;
  // Big decorative letters for "Spell WORD" lessons: the eye-catcher. The lesson title already says it in text.
  const word = next?.title.match(/^Spell ([A-Za-z]+)$/)?.[1]?.toUpperCase().split("") ?? [];

  return (
    <div className="page home">
      <h1 className="greet-title stagger" style={{ "--i": 0 } as React.CSSProperties}>
        Start with your name, {profile.userName}. Then {profile.theirName}&rsquo;s.
      </h1>

      <section className="focus stagger" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="focus-title">
        {next ? (
          <div className="focus-next">
            <div className="focus-lesson">
              {word.length > 0 && (
                <div className="focus-letters" aria-hidden="true">
                  {word.map((l, i) => (
                    <span key={i} style={{ "--k": i } as React.CSSProperties}>{l}</span>
                  ))}
                </div>
              )}
              <div>
                <p className="focus-eyebrow">Up next · Lesson {next.id} · {next.xp} XP</p>
                <h2 id="focus-title">{next.title}</h2>
              </div>
            </div>
            <button type="button" className="focus-cta" onClick={() => open(next.id)}>
              Start
              <span className="sr-only"> lesson {next.id}</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="focus-eyebrow">All caught up</p>
            <h2 id="focus-title">Every available lesson is finished</h2>
            <p className="focus-note">More lessons are coming later.</p>
          </div>
        )}
      </section>

      <ul className="shortcuts stagger" style={{ "--i": 2 } as React.CSSProperties} aria-label="Shortcuts">
        <li><a href="#/progress">Progress</a></li>
        <li><a href="#/camera-demo">Camera demo</a></li>
        {spellThem && (
          <li>
            {spellOpen ? <a href={`#/lesson/${spellThem.id}`}>{spellThem.title}</a> : <span className="is-locked">{spellThem.title} (locked until the lessons before it are done)</span>}
          </li>
        )}
        <li><a href="#/welcome">Names and hand</a></li>
      </ul>

      <div className="home-layout">
        <div className="units stagger" style={{ "--i": 2 } as React.CSSProperties}>
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

        <aside className="side stagger" style={{ "--i": 3 } as React.CSSProperties} aria-label="Your letters and review">
          <section className="rail" aria-labelledby="rail-letters">
            <h2 id="rail-letters">Letters in {profile.theirName}</h2>
            <LiveCoverage name={profile.theirName} isLive={isPracticeable} stateOf={letterState} />
          </section>
          <section className="rail" aria-labelledby="rail-due">
            <h2 id="rail-due">Due for review</h2>
            {due.length === 0 ? (
              <p className="muted">Nothing is due. Letters you practise will come back here for review.</p>
            ) : (
              <div className="chip-row">
                {due.map((l) => (
                  <LetterBadge key={l} letter={l} status={isPracticeable(l) ? letterState(l) : "reference-only"} />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
