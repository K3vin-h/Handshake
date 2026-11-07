import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { isPracticeable, meanPose3D, useLetterCheck } from "../cv";
import { buildCurriculum, flatLessons, type Step } from "../lib/curriculum";
import { completeLesson, dueItems, isUnlocked, loadProgress, recordAttempt, type Progress } from "../lib/progress";
import { loadMistakes, mistakeCount, recordMistake } from "../lib/mistakes";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { SEND_SNAPSHOT, getCoachTip } from "../lib/api";
import { LessonView } from "../components/LessonView";
import { Camera } from "../components/Camera";
import { celebrate } from "../components/celebrate";

const HandModel3D = lazy(() => import("../components/HandModel3D"));

/** Spec §1: "Matches our recording" until a fluent signer has checked the templates (Task 11 Step 2). */
export const MATCH_WORDING = "Matches our recording";

// A lesson's steps flattened into one item per thing the learner does.
export type Item =
  | { kind: "learn"; letter: string; referenceOnly: boolean }
  | { kind: "check"; letter: string; showReference: boolean; word?: { letters: string[]; index: number } }
  | { kind: "other"; step: Step }; // sign / sentence / scene: group-1 Tasks 10 and 12

export function expand(steps: Step[], _progress: Progress): Item[] {
  const out: Item[] = [];
  for (const s of steps) {
    if (s.kind === "learn") out.push({ kind: "learn", letter: s.letter, referenceOnly: !isPracticeable(s.letter) });
    else if (s.kind === "practice") {
      if (isPracticeable(s.letter)) for (let i = 0; i < s.reps; i++) out.push({ kind: "check", letter: s.letter, showReference: true });
    } else if (s.kind === "spell") {
      const letters = [...s.word];
      letters.forEach((l, index) => isPracticeable(l) && out.push({ kind: "check", letter: l, showReference: s.showReference, word: { letters, index } }));
    } else if (s.kind === "contrast" || s.kind === "review") continue; // added in M2 (Task 9)
    else out.push({ kind: "other", step: s });
  }
  return out;
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lesson = useMemo(() => flatLessons(units).find((l) => l.id === lessonId), [units, lessonId]);
  const progress = useRef(loadProgress()); // a ref, not state: recordAttempt mutates, and StrictMode would double-apply updaters
  const items = useMemo(() => (lesson ? expand(lesson.steps, progress.current) : []), [lesson]);
  const [i, setI] = useState(0);
  const lessonLetters = useMemo(() => [...new Set(items.flatMap((x) => (x.kind === "check" ? [x.letter] : [])))], [items]);

  function next() {
    if (i + 1 < items.length) return setI(i + 1);
    progress.current = completeLesson(progress.current, lesson!.id, lesson!.xp);
    location.hash = `#/complete/${lesson!.id}`;
  }

  if (!lesson) return <div className="page"><p>Lesson not found. <a href="#/">Back to your path</a></p></div>;
  // Same baseline: no skipping ahead by URL. "Skip" inside a lesson passes an item without counting it as a match.
  if (!isUnlocked(units, progress.current, lesson.id)) return <div className="page"><p>Locked: finish the lessons before it first. <a href="#/">Back to your path</a></p></div>;
  const item = items[i];
  if (!item) return <div className="page"><p>Nothing to practise here yet.</p><button onClick={next}>Continue</button></div>;
  const stepLabel = `Step ${i + 1} of ${items.length}`;

  // ONE camera at a time: LetterItem stays mounted across consecutive letter items (no key), so the camera never restarts.
  if (item.kind === "other")
    return <div className="page"><p>Coming in a later milestone: {item.step.kind}</p><button onClick={next}>Continue</button></div>;
  return <LetterItem index={i} item={item} lessonLetters={lessonLetters} leftHanded={profile.leftHanded} stepLabel={stepLabel} progress={progress} onNext={next} />;
}

type LetterItemProps = {
  index: number;
  item: Exclude<Item, { kind: "other" }>;
  lessonLetters: string[];
  leftHanded: boolean;
  stepLabel: string;
  progress: { current: Progress };
  onNext: () => void;
};

function LetterItem({ index, item, lessonLetters, leftHanded, stepLabel, progress, onNext }: LetterItemProps) {
  const [landmarkTip, setLandmarkTip] = useState("");
  const [coach, setCoach] = useState({ tip: "", cached: false });
  const [sideBySide, setSideBySide] = useState(false);
  const [status, setStatus] = useState("");
  const asking = useRef(false);
  const gen = useRef(0); // bumps per item: a late coach reply for the previous item is dropped
  const target = item.letter;

  useEffect(() => {
    gen.current++;
    asking.current = false;
    setLandmarkTip("");
    setCoach({ tip: "", cached: false });
    setSideBySide(false);
  }, [index]);

  const check = useLetterCheck(target, lessonLetters, {
    leftHanded,
    enabled: item.kind === "check",
    onMatch: (d) => {
      progress.current = recordAttempt(progress.current, d.letter, true);
      setStatus(`${MATCH_WORDING}: ${d.letter}`);
      celebrate();
      onNext();
    },
    onMiss: (feedback) => {
      progress.current = recordAttempt(progress.current, target, false);
      const first = feedback[0];
      setStatus(`Not matching ${target} yet`);
      setLandmarkTip(first ? `Your ${first.finger} ${first.issue}.` : "Compare your hand with the reference and hold it still.");
      if (!first) return;
      const repeat = mistakeCount(recordMistake(loadMistakes(), target, first.code), target, first.code);
      setSideBySide(repeat >= 3);
      if (asking.current) return;
      asking.current = true;
      const g = gen.current;
      getCoachTip(target, feedback, repeat, SEND_SNAPSHOT ? check.snapshot() : undefined)
        .then((r) => g === gen.current && setCoach({ tip: r.tip, cached: !!r.cached }))
        .catch(() => {}) // the landmark tip is already on screen
        .finally(() => g === gen.current && (asking.current = false));
    },
  });

  const camera = (
    <>
      <Camera {...check.cam} progress={check.progress} />
      {check.hint && <p role="status">{check.hint}</p>}
    </>
  );
  const reference = (
    <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
      <HandModel3D pose={meanPose3D(target, check.templates, leftHanded)} letter={target} />
    </Suspense>
  );
  const common = { target, reference, camera, landmarkTip, coachTip: coach.tip, coachCached: coach.cached, sideBySide, stepLabel };

  if (item.kind === "learn")
    return (
      <LessonView {...common} title={`Learn ${item.letter}`} showReference progress={0}
        status={item.referenceOnly ? "Reference only, coming later" : `This is ${item.letter}. Try it, then continue.`}
        actionLabel="Continue" onAction={onNext} />
    );

  return (
    <LessonView {...common} title={item.word ? `Spell ${item.word.letters.join("")}` : `Sign ${item.letter}`} word={item.word}
      showReference={item.showReference || sideBySide} progress={check.progress} status={status} actionLabel="Skip" onAction={onNext} />
  );
}
