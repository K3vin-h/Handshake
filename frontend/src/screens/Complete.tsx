import { useEffect, useRef, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { celebrate } from "../components/celebrate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { refreshPracticeWords } from "../lib/profile";
import { requireProfile } from "../lib/requireProfile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";
import { AlphabetStrip } from "../components/AlphabetStrip";

// Level-complete. The player records completion: visiting this route never awards XP or unlocks a lesson.
// Focus moves to the heading on arrival and the result is also shown as text. Confetti is skipped under
// prefers-reduced-motion (see celebrate()). Only Units 1-2 are active, so only they are considered.

export function Complete({ lessonId: routeParam }: { lessonId: string }) {
  const lessonId = routeParam.split("?")[0]; // tolerate a stray query on the hash
  const heading = useRef<HTMLHeadingElement>(null);
  const celebrated = useRef(false);
  const [progress] = useState(loadProgress);
  const [units] = useState(() => buildCurriculum(requireProfile()).filter((u) => ["u1", "u2", "u3", "u4"].includes(u.id)));
  const lesson = flatLessons(units).find((l) => l.id === lessonId);
  const done = !!lesson && progress.completed.includes(lessonId);
  // "Level" complete = the last demo lesson of its unit is now done. Stretch lessons never gate (same rule as unlocking).
  const unit = units.find((u) => u.lessons.some((l) => l.id === lessonId));
  const unitDone = !!unit && done && unit.lessons.filter((l) => l.scope === "demo").every((l) => progress.completed.includes(l.id));

  useEffect(() => {
    if (done) void refreshPracticeWords(); // re-pick practice words around the learner's weakest letters
  }, [lessonId, done]);

  useEffect(() => {
    heading.current?.focus();
    if (done && !celebrated.current) {
      celebrated.current = true;
      celebrate(unitDone ? "unit" : "lesson");
    }
  }, [lessonId, done, unitDone]);

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
          {isUnlocked(units, progress, lessonId) && (
            <Button asChild size="lg" className="h-12 rounded-2xl border-b-4 border-brand-deep">
              <a href={`#/lesson/${lessonId}`}>Return to lesson</a>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="h-12 rounded-2xl border-2">
            <a href="#/">Back to your path</a>
          </Button>
        </div>
      </div>
    );
  }

  const next = nextLesson(units, progress);
  const nextOpen = next && isUnlocked(units, progress, next.id);
  const btn = "h-12 rounded-2xl border-2";
  const primary = "h-12 rounded-2xl border-b-4 border-brand-deep";
  const status = (
    <>
      <StatusMessage kind="match" label="Lesson complete" message={`You finished ${lesson.title} and earned ${lesson.xp} XP. Your total is ${progress.xp} XP.`} />
      {unitDone && unit && <StatusMessage kind="match" label="Unit complete" message={`You finished every lesson in ${unit.title}.`} />}
    </>
  );
  const stats = (
    <dl className="stats">
      <div><dt>Lesson XP</dt><dd>{lesson.xp}</dd></div>
      <div><dt>Total XP</dt><dd>{progress.xp}</dd></div>
      <div><dt>Practice streak</dt><dd>{progress.streakDays} {progress.streakDays === 1 ? "day" : "days"}</dd></div>
    </dl>
  );
  const continueBtn = nextOpen ? (
    <Button asChild size="lg" className={primary}><a href={`#/lesson/${next.id}`}>Continue: {next.id} {next.title}</a></Button>
  ) : (
    <p>You finished the current path. Greetings and conversations are coming later.</p>
  );
  const others = (
    <>
      <Button asChild variant="outline" size="lg" className={btn}><a href={`#/lesson/${lessonId}`}>Practice again</a></Button>
      <Button asChild variant="outline" size="lg" className={btn}><a href="#/path">Back to levels</a></Button>
      <Button asChild variant="outline" size="lg" className={btn}><a href="#/progress">View progress</a></Button>
    </>
  );
  const whatNext = (
    <Card className="rounded-3xl border-2">
      <CardHeader><CardTitle className="text-xl">What next</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">{continueBtn}{others}</CardContent>
    </Card>
  );
  const hero = (
    <header className="hero">
      <p className="eyebrow">Lesson {lesson.id}</p>
      <h1 ref={heading} tabIndex={-1}>Lesson complete</h1>
    </header>
  );

  // Two columns on wide screens: the result and what next on the left, the alphabet always visible on the right.
  // On phones the columns stack.
  return (
    <div className="page complete reward-dawn">
      {hero}
      <div className="complete-cols">
        <div>{status}{stats}{whatNext}</div>
        <aside aria-label="Alphabet"><AlphabetStrip units={units} progress={progress} lessonId={lessonId} /></aside>
      </div>
    </div>
  );
}
