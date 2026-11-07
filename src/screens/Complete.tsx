import { useEffect, useMemo, useRef } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { StreakXpChip } from "../components/StreakXpChip";
import { celebrate } from "../components/celebrate";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { loadProgress, nextLesson } from "../lib/progress";

// Level-complete. Focus moves to the heading on arrival; the result is also announced as text.
// Confetti is skipped under prefers-reduced-motion (see celebrate()).

export function Complete({ lessonId }: { lessonId: string }) {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lesson = flatLessons(units).find((l) => l.id === lessonId);
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const done = progress.completed.includes(lessonId);
  const heading = useRef<HTMLHeadingElement>(null);
  const celebrated = useRef(false);

  useEffect(() => {
    heading.current?.focus();
    if (done && !celebrated.current) {
      celebrated.current = true;
      celebrate();
    }
  }, [done]);

  if (!lesson) {
    return (
      <div className="page">
        <h1 ref={heading} tabIndex={-1}>Lesson not found</h1>
        <a href="#/">Back to your path</a>
      </div>
    );
  }

  return (
    <div className="page complete">
      <header className="hero">
        <p className="eyebrow">Lesson {lesson.id}</p>
        <h1 ref={heading} tabIndex={-1}>{done ? `${lesson.title} complete` : `${lesson.title} not finished yet`}</h1>
        <StreakXpChip streakDays={progress.streakDays} xp={progress.xp} />
      </header>

      <StatusMessage
        kind={done ? "match" : "info"}
        label={done ? "Lesson complete" : "Note"}
        message={done ? `You earned ${lesson.xp} XP. Your total is ${progress.xp} XP.` : "Finish every step of this lesson to earn its XP."}
      />

      <section className="card">
        <h2>What next</h2>
        <div className="row">
          {next ? (
            <a className="link-button primary" href={`#/lesson/${next.id}`}>Next: {next.id} {next.title}</a>
          ) : (
            <p>You have finished every lesson that is available right now.</p>
          )}
          <a className="link-button" href="#/">Back to your path</a>
          <a className="link-button" href="#/progress">See progress</a>
        </div>
      </section>
    </div>
  );
}
