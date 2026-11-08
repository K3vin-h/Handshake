import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { UnitSection, type MapLesson } from "../components/PathMap";
import { MARK_LABEL, StatusMark, type MarkState } from "../components/StatusMark";
import { coverage } from "../components/LiveCoverage";
import { lessonHeadline } from "../components/lessonHeadline";
import { buildCurriculum } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Home: the path. Units 1-4 are active (demo lessons only).
// Reads the profile and progress from localStorage only.

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const due = dueItems(progress);
  const letterStatus = (l: string): MarkState => {
    if (!isPracticeable(l)) return "reference-only";
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practising" : "not-started";
  };
  const dueSet = new Set(due);

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);
  // Their name is the one "Spell ..." lesson in Unit 2. Found by position, not by comparing titles: the curriculum cleans
  // the name itself (accents, hyphens), so a title match broke for names like "Mary-Ann" or "José".
  const spellThem = units.find((u) => u.id === "u2")?.lessons.find((l) => /^Spell /i.test(l.title));
  const spellOpen = spellThem ? isUnlocked(units, progress, spellThem.id) : false;
  // Banner headline: one hand-written line per lesson (see lessonHeadline). No AI, no promises about outcomes.
  const them = profile.theirName;
  const headline = next ? lessonHeadline(next, them) : "You've finished every available lesson!";
  // Small letters + live coverage under each lesson block (replaces the old side panels).
  const lessonExtras = (l: { title: string; teaches?: string[] }): Pick<MapLesson, "letters" | "note"> => {
    const letters = (l.teaches ?? []).filter((x) => /^[A-Z]$/.test(x)).map((x) => ({ letter: x, status: letterStatus(x), due: dueSet.has(x) }));
    const spell = l.title.match(/^Spell (.+)$/i)?.[1];
    const c = spell ? coverage(spell, isPracticeable) : null;
    return { letters, note: c && c.total > 0 ? `${spell!.toUpperCase()}: ${c.liveCount} of ${c.total} have a camera check` : undefined };
  };

  return (
    <div className="page home">
      <section className="focus banner stagger" style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="focus-title">
        <div className="focus-next">
          <div>
            <h1 id="focus-title">{headline}</h1>
            {next ? (
              <p className="focus-kicker">Lesson {next.id} · {next.title} · {next.xp} XP</p>
            ) : (
              <p className="focus-kicker">More lessons are coming later.</p>
            )}
          </div>
          {next && (
            <button type="button" className="focus-cta" onClick={() => open(next.id)}>
              Go
              <span className="sr-only"> to lesson {next.id}</span>
            </button>
          )}
        </div>
      </section>

      <ul className="shortcuts stagger" style={{ "--i": 1 } as React.CSSProperties} aria-label="Shortcuts">
        <li><a href="#/progress">Progress</a></li>
        <li><a href="#/camera-demo">Camera demo</a></li>
        {spellThem && (
          <li>
            {spellOpen ? <a href={`#/lesson/${spellThem.id}`}>{spellThem.title}</a> : <span className="is-locked">{spellThem.title} (locked until the lessons before it are done)</span>}
          </li>
        )}
        <li><a href="#/welcome">Names and hand</a></li>
      </ul>

      <ul className="status-legend" aria-label="What the shapes mean">
        {(["mastered", "practising", "not-started", "reference-only"] as MarkState[]).map((m) => (
          <li key={m}><StatusMark state={m} size={14} /> {MARK_LABEL[m]}</li>
        ))}
      </ul>

      <div className="home-single">
        <div className="units stagger" style={{ "--i": 2 } as React.CSSProperties}>
          {units.slice(0, 4).map((u, i) => (
            <UnitSection
              key={u.id}
              index={i + 1}
              title={u.title}
              goal={u.goal}
              lessons={u.lessons.filter((l) => l.scope === "demo").map((l) => ({ id: l.id, title: l.title, summary: l.summary, xp: l.xp, state: stateOf(l.id), ...lessonExtras(l) }))}
              onOpen={open}
              showStart={false}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
