import { useEffect, useRef, useState } from "react";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// The player records completion. Visiting this route never awards XP or unlocks a lesson.
export function Complete({ lessonId }: { lessonId: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [lessonId]);
  const [progress] = useState(loadProgress);
  const [units] = useState(() => buildCurriculum(loadProfile() ?? DEMO_PROFILE).filter((unit) => ["u1", "u2"].includes(unit.id)));
  const lesson = flatLessons(units).find((item) => item.id === lessonId);
  if (!lesson) return <main className="page"><h1 ref={heading} tabIndex={-1}>Lesson unavailable</h1><a href="#/">Back to your path</a></main>;
  if (!progress.completed.includes(lessonId)) {
    return <main className="page"><h1 ref={heading} tabIndex={-1}>Keep practising</h1><p>Finish {lesson.title} to save its completion and earn XP.</p>
      {isUnlocked(units, progress, lessonId) && <p><a href={`#/lesson/${lessonId}`}>Return to lesson</a></p>}<a href="#/">Back to your path</a></main>;
  }
  const next = nextLesson(units, progress);
  return (
    <main className="page">
      <h1 ref={heading} tabIndex={-1}>Lesson complete</h1>
      <p role="status">You finished {lesson.title}.</p>
      <dl><dt>Lesson XP</dt><dd>{lesson.xp}</dd><dt>Total XP</dt><dd>{progress.xp}</dd><dt>Practice streak</dt><dd>{progress.streakDays} {progress.streakDays === 1 ? "day" : "days"}</dd></dl>
      {next && isUnlocked(units, progress, next.id) ? <p><a href={`#/lesson/${next.id}`}>Continue: {next.title}</a></p> : <p>You finished the current path. Greetings and conversations are coming later.</p>}
      <p><a href="#/progress">View progress</a></p>
      <a href="#/">Back to your path</a>
    </main>
  );
}
