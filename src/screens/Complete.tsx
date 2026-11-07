import { useEffect, useRef, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { StreakXpChip } from "../components/StreakXpChip";
import { celebrate } from "../components/celebrate";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Level-complete. The player records completion: visiting this route never awards XP or unlocks a lesson.
// Focus moves to the heading on arrival and the result is also shown as text. Confetti is skipped under
// prefers-reduced-motion (see celebrate()). Only Units 1-2 are active, so only they are considered.

export function Complete({ lessonId }: { lessonId: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const celebrated = useRef(false);
  const [progress] = useState(loadProgress);
  const [units] = useState(() => buildCurriculum(loadProfile() ?? DEMO_PROFILE).filter((u) => ["u1", "u2"].includes(u.id)));
  const lesson = flatLessons(units).find((l) => l.id === lessonId);
  const done = !!lesson && progress.completed.includes(lessonId);

  useEffect(() => {
    heading.current?.focus();
    if (done && !celebrated.current) {
      celebrated.current = true;
      celebrate();
    }
  }, [lessonId, done]);

  if (!lesson) {
    return (
      <div className="page">
        <h1 ref={heading} tabIndex={-1}>Lesson unavailable</h1>
        <a href="#/">Back to your path</a>
      </div>
    );
  }

  if (!done) {
    return (
      <div className="page complete">
        <header className="hero">
          <p className="eyebrow">Lesson {lesson.id}</p>
          <h1 ref={heading} tabIndex={-1}>Keep practising</h1>
        </header>
        <StatusMessage kind="info" message={`Finish ${lesson.title} to save its completion and earn XP.`} />
        <div className="row">
          {isUnlocked(units, progress, lessonId) && <a className="link-button primary" href={`#/lesson/${lessonId}`}>Return to lesson</a>}
          <a className="link-button" href="#/">Back to your path</a>
        </div>
      </div>
    );
  }

  const next = nextLesson(units, progress);
  const nextOpen = next && isUnlocked(units, progress, next.id);
  return (
    <div className="page complete">
      <header className="hero">
        <p className="eyebrow">Lesson {lesson.id}</p>
        <h1 ref={heading} tabIndex={-1}>Lesson complete</h1>
        <StreakXpChip streakDays={progress.streakDays} xp={progress.xp} />
      </header>

      <StatusMessage kind="match" label="Lesson complete" message={`You finished ${lesson.title} and earned ${lesson.xp} XP. Your total is ${progress.xp} XP.`} />

      <dl className="stats">
        <div><dt>Lesson XP</dt><dd>{lesson.xp}</dd></div>
        <div><dt>Total XP</dt><dd>{progress.xp}</dd></div>
        <div><dt>Practice streak</dt><dd>{progress.streakDays} {progress.streakDays === 1 ? "day" : "days"}</dd></div>
      </dl>

      <section className="card">
        <h2>What next</h2>
        <div className="row">
          {nextOpen ? (
            <a className="link-button primary" href={`#/lesson/${next.id}`}>Continue: {next.id} {next.title}</a>
          ) : (
            <p>You finished the current path. Greetings and conversations are coming later.</p>
          )}
          <a className="link-button" href="#/">Back to your path</a>
          <a className="link-button" href="#/progress">View progress</a>
        </div>
      </section>
    </div>
  );
}
