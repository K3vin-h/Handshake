import { useEffect, useMemo } from "react";
import "../components/landing/path-hero.css";
import { isPracticeable } from "../cv";
import { UnitSection, type MapLesson } from "../components/PathMap";
import { MARK_LABEL, StatusMark, type MarkState } from "../components/StatusMark";
import { coverage } from "../components/LiveCoverage";
import { lessonHeadline } from "../components/lessonHeadline";
import { buildCurriculum } from "../lib/curriculum";
import { loadProfile, type Profile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Path: the circles. Reached from Home (Continue / Levels). Units 1-4 are active (demo lessons only).
// Reads the profile and progress from localStorage only.

/** The names come from onboarding only. With no saved profile there is nothing to show, so send the learner to the welcome steps. */
export function PathPage() {
  const profile = loadProfile();
  useEffect(() => {
    if (!profile) location.hash = "#/welcome";
  }, [profile]);
  return profile ? <PathPageInner profile={profile} /> : null;
}

function PathPageInner({ profile }: { profile: Profile }) {
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const due = dueItems(progress);
  const letterStatus = (l: string): MarkState => {
    if (!isPracticeable(l)) return "reference-only";
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practicing" : "not-started";
  };
  const dueSet = new Set(due);

  // Hero stats. All from local progress; nothing is sent anywhere.
  const demoLessons = units.flatMap((u) => u.lessons).filter((l) => l.scope === "demo");
  const stats: [string, string][] = [
    [String(progress.streakDays), progress.streakDays === 1 ? "day streak" : "days streak"],
    [String(progress.xp), "XP earned"],
    [`${demoLessons.filter((l) => progress.completed.includes(l.id)).length}/${demoLessons.length}`, "lessons done"],
  ];

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);
  // Banner headline: one hand-written line per lesson (see lessonHeadline). No AI, no promises about outcomes.
  const them = profile.theirName;
  const headline = next ? lessonHeadline(next, them) : "You've finished every available lesson";
  // Small letters + live coverage under each lesson block (replaces the old side panels).
  const lessonExtras = (l: { title: string; teaches?: string[] }): Pick<MapLesson, "letters" | "note"> => {
    const letters = (l.teaches ?? []).filter((x) => /^[A-Z]$/.test(x)).map((x) => ({ letter: x, status: letterStatus(x), due: dueSet.has(x) }));
    const spell = l.title.match(/^Spell (.+)$/i)?.[1];
    const c = spell ? coverage(spell, isPracticeable) : null;
    return { letters, note: c && c.total > 0 ? `${spell!.toUpperCase()}: ${c.liveCount} of ${c.total} have a camera check` : undefined };
  };

  return (
    <div className="page home path-page">
      <section className="home-hero stagger" style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="focus-title">
        <div className="hero-main">
          <h1 id="focus-title">{headline}</h1>
          {next ? (
            <p className="hero-next">
              <span className="hero-next-pill">Up next</span>
              <span className="hero-next-id"><span className="sr-only">Lesson </span>{next.id}</span>
              <strong className="hero-next-title">{next.title}</strong>
              <span className="hero-next-xp">{next.xp} XP</span>
            </p>
          ) : (
            <p className="hero-kicker">More lessons are coming later.</p>
          )}
          {next && (
            <button type="button" className="hero-cta" onClick={() => open(next.id)}>
              Continue
              <span className="sr-only"> to lesson {next.id}</span>
            </button>
          )}
        </div>

        <dl className="hero-stats">
          {stats.map(([value, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ul className="status-legend" aria-label="What the shapes mean">
        {(["mastered", "practicing", "not-started", "reference-only"] as MarkState[]).map((m) => (
          <li key={m}><StatusMark state={m} size={14} /> {MARK_LABEL[m]}</li>
        ))}
      </ul>

      <div className="home-single">
        <div className="units stagger" style={{ "--i": 1 } as React.CSSProperties}>
          {units.slice(0, 4).map((u, i) => (
            <UnitSection
              key={u.id}
              index={i + 1}
              title={u.title}
              goal={u.goal}
              lessons={u.lessons.filter((l) => l.scope === "demo").map((l) => ({ id: l.id, title: l.title, summary: l.summary, xp: l.xp, state: stateOf(l.id), partial: progress.completed.includes(l.id) ? undefined : progress.partial?.[l.id], ...lessonExtras(l) }))}
              onOpen={open}
              showStart={false}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
