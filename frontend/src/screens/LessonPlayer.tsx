import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { SIGNS, isPracticeable, meanPose3D, useLetterCheck } from "../cv";
import { TokenRunner } from "./TokenRunner";
import { buildCurriculum, flatLessons, type Step } from "../lib/curriculum";
import { completeLesson, dueItems, isUnlocked, loadProgress, recordAttempt, type Progress } from "../lib/progress";
import { reportAttempt, reportLessonComplete } from "../lib/track";
import { loadMistakes, mistakeCount, recordMistake } from "../lib/mistakes";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { SEND_SNAPSHOT, getCoachTip, getHowTo } from "../lib/api";
import { LessonView } from "../components/LessonView";
import { SceneView } from "../components/SceneView";
import { Camera } from "../components/Camera";
import { createCoachQueue } from "../lib/coachQueue";
import type { FingerFeedback } from "../cv/types";
import { loadTemplates } from "../cv/classifier";
import { celebrate } from "../components/celebrate";

const HandModel3D = lazy(() => import("../components/HandModel3D"));

/** Spec §1: "Matches our recording" until a fluent signer has checked the templates (Task 11 Step 2). */
export const MATCH_WORDING = "Matches our recording";

// A lesson's steps flattened into one item per thing the learner does.
export type Item =
  | { kind: "learn"; letter: string; referenceOnly: boolean }
  | { kind: "check"; letter: string; showReference: boolean; practiceStart?: number; word?: { letters: string[]; index: number } }
  | { kind: "other"; step: Step }; // sign / sentence / scene: group-1 Tasks 10 and 12

export function expand(steps: Step[], _progress: Progress): Item[] {
  const out: Item[] = [];
  for (const s of steps) {
    // Live letters: the practice step already shows the reference beside the camera, so no separate "learn" page.
    if (s.kind === "learn") { if (!isPracticeable(s.letter)) out.push({ kind: "learn", letter: s.letter, referenceOnly: true }); }
    else if (s.kind === "practice") {
      const practiceStart = out.length;
      if (isPracticeable(s.letter)) for (let i = 0; i < s.reps; i++) out.push({ kind: "check", letter: s.letter, showReference: true, practiceStart });
    } else if (s.kind === "spell") {
      const letters = [...s.word];
      letters.forEach((l, index) => out.push(isPracticeable(l)
        ? { kind: "check", letter: l, showReference: s.showReference, word: { letters, index } }
        : { kind: "learn", letter: l, referenceOnly: true }));
    } else if (s.kind === "contrast" || s.kind === "review") {
      const letters = s.kind === "contrast" ? s.letters : dueItems(_progress).filter((l) => /^[A-Z]$/.test(l));
      const graded = s.kind === "review" || letters.every(isPracticeable);
      for (const letter of letters) out.push(graded && isPracticeable(letter)
        ? { kind: "check", letter, showReference: true }
        : { kind: "learn", letter, referenceOnly: true });
    }
    else out.push({ kind: "other", step: s });
  }
  return out;
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  return <Player key={lessonId} lessonId={lessonId} />;
}
function Player({ lessonId }: { lessonId: string }) {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile).filter((u) => ["u1", "u2", "u3", "u4"].includes(u.id)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lesson = useMemo(() => flatLessons(units).find((l) => l.id === lessonId), [units, lessonId]);
  const progress = useRef(loadProgress()); // a ref, not state: recordAttempt mutates, and StrictMode would double-apply updaters
  const items = useMemo(() => (lesson ? expand(lesson.steps, progress.current) : []), [lesson]);
  const [i, setI] = useState(0);
  const [turn, setTurn] = useState(0); // which exchange of a conversation scene (hooks stay above the early returns)
  const lessonLetters = useMemo(() => [...new Set(items.flatMap((x) => (x.kind === "check" ? [x.letter] : [])))], [items]);

  const finishing = useRef(false);
  function next() {
    if (finishing.current) return;
    if (i + 1 < items.length) return setI(i + 1);
    finishing.current = true;
    if (!progress.current.completed.includes(lesson!.id)) {
      progress.current = completeLesson(progress.current, lesson!.id, lesson!.xp);
      reportLessonComplete(lesson!.id, lesson!.xp);
    }
    location.hash = `#/complete/${lesson!.id}`;
  }

  if (!lesson) return <div className="page"><p>Lesson not found. <a href="#/">Back to your path</a></p></div>;
  // Same baseline: no skipping ahead by URL. "Skip" inside a lesson passes an item without counting it as a match.
  if (!isUnlocked(units, progress.current, lesson.id)) return <div className="page"><p>Locked: finish the lessons before it first. <a href="#/">Back to your path</a></p></div>;
  const item = items[i];
  if (!item) return <div className="page"><p>Nothing to practise here yet.</p><button onClick={next}>Continue</button></div>;
  const stepLabel = `Step ${i + 1} of ${items.length}`;

  // Whole signs and sentences: one TokenRunner walks the parts (handshape → place → movement) on one camera.
  if (item.kind === "other" && (item.step.kind === "sign" || item.step.kind === "sentence")) {
    const s = item.step;
    const tokens = s.kind === "sign" ? [s.sign] : s.tokens;
    const title = s.kind === "sign" ? `Sign "${SIGNS[s.sign]?.english ?? s.sign}"` : s.english;
    return (
      <TokenRunner tokens={tokens} leftHanded={profile.leftHanded}
        onDone={() => { progress.current = recordAttempt(progress.current, tokens.join(" "), true); celebrate(); next(); }}
        render={(r) => (
          <LessonView title={title} target={tokens.join(" ")} reference={null} showReference={false} progress={0}
            camera={r.camera} status={r.prompt} landmarkTip="" coachTip="" coachCached={false} sideBySide={false}
            stepLabel={`${stepLabel} · part ${r.index + 1} of ${r.units.length}`} lessonProgress={i / items.length}
            actionLabel="Skip" onAction={next} onSelfCheck={r.selfCheck} />
        )} />
    );
  }
  // Conversation scene: their line, then your reply as signs, turn by turn, on one camera.
  if (item.kind === "other" && item.step.kind === "scene") {
    const turns = item.step.turns.map((t) => ({ them: { gloss: t.them.tokens.join(" "), english: t.them.english }, you: t.you }));
    return (
      <TokenRunner tokens={turns[turn].you.tokens} leftHanded={profile.leftHanded}
        onDone={() => {
          if (turn + 1 < turns.length) return setTurn(turn + 1);
          progress.current = recordAttempt(progress.current, `scene:${lesson.id}`, true);
          celebrate();
          setTurn(0);
          next();
        }}
        render={(r) => <SceneView turns={turns} turnIndex={turn} tokenIndex={r.token} camera={r.camera} prompt={r.prompt} onSelfCheck={r.selfCheck} />} />
    );
  }
  // ONE camera at a time: LetterItem stays mounted across consecutive letter items (no key), so the camera never restarts.
  if (item.kind === "other")
    return <div className="page"><p>Coming in a later milestone: {item.step.kind}</p><button onClick={next}>Continue</button></div>;
  return <LetterItem index={i} item={item} lessonLetters={lessonLetters} leftHanded={profile.leftHanded} stepLabel={stepLabel} lessonProgress={i / items.length} stepSize={1 / items.length} progress={progress} onNext={next} />;
}

type LetterItemProps = {
  index: number;
  item: Exclude<Item, { kind: "other" }>;
  lessonLetters: string[];
  leftHanded: boolean;
  stepLabel: string;
  lessonProgress: number; // fraction of steps finished before this one
  stepSize: number; // one step's share of the top bar, added once this step matches so the last step can fill the bar
  progress: { current: Progress };
  onNext: () => void;
};

function LetterItem({ index, item, lessonLetters, leftHanded, stepLabel, lessonProgress, stepSize, progress, onNext }: LetterItemProps) {
  const [landmarkTip, setLandmarkTip] = useState("");
  const [coach, setCoach] = useState({ tip: "", cached: false });
  const [sideBySide, setSideBySide] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<"" | "match" | "miss">(""); // drives the green/red footer
  const queue = useMemo(() => createCoachQueue<{ key: string; target: string; feedback: FingerFeedback[]; repeat: number; snapshot?: string }, {tip: string; cached?: boolean}>(
    request => getCoachTip(request.target, request.feedback, request.repeat, request.snapshot),
    result => setCoach({ tip: result.tip, cached: !!result.cached }),
    () => setStatus("Coach unavailable. Use the landmark tip above."),
  ), []);
  const target = item.letter;
  const feedbackGroup = item.kind === "check" ? (item.practiceStart ?? index) : index;
  useEffect(() => () => { queue.reset(); }, []);

  useEffect(() => {
    queue.reset();
    setLandmarkTip("");
    setCoach({ tip: "", cached: false });
    setSideBySide(Object.values(loadMistakes()[target] ?? {}).some((entry) => (entry?.count ?? 0) >= 3));
    setStatus("");
  }, [feedbackGroup]);

  useEffect(() => { check.reset(); setResult(""); }, [index]);

  function retry() {
    queue.reset();
    setLandmarkTip("");
    setCoach({ tip: "", cached: false });
    setStatus("");
    setResult("");
    check.reset();
  }

  const check = useLetterCheck(target, lessonLetters, {
    leftHanded,
    enabled: (item.kind === "check" || !item.referenceOnly) && result !== "match", // stop checking once matched; "Try again" restarts
    onMatch: (d) => {
      // Learn steps show the camera for trying the sign, but nothing is scored or advanced.
      if (item.kind !== "check") { setStatus(`Matches our recording: ${d.letter} (practice, not scored)`); return; }
      progress.current = recordAttempt(progress.current, d.letter, true);
      reportAttempt(d.letter, true);
      queue.reset();
      setLandmarkTip("");
      setCoach({ tip: "", cached: false });
      setResult("match");
      setStatus(`${MATCH_WORDING}: ${d.letter}`);
      celebrate();
    },
    onMiss: (feedback) => {
      if (item.kind !== "check") return;
      // A miss shows the tip and keeps the same rep going. It does not send the learner back to rep 1 (that looped for
      // anyone the model misses often). Mastery still needs 3 in a row: recordAttempt resets the streak on a miss.
      progress.current = recordAttempt(progress.current, target, false);
      reportAttempt(target, false, feedback.map((f) => f.code));
      setCoach({ tip: "", cached: false });
      const first = feedback[0];
      setResult("miss");
      setStatus(`Not matching ${target} yet. Keep trying.`);
      setLandmarkTip(first ? `Your ${first.finger} ${first.issue}.` : "Compare your hand with the reference and hold it still.");
      if (!first) return;
      const repeat = mistakeCount(recordMistake(loadMistakes(), target, first.code), target, first.code);
      setSideBySide(repeat >= 3);

      queue.submit({ key: `${target}:${first.code}:${first.issue}`, target, feedback, repeat, snapshot: SEND_SNAPSHOT ? check.snapshot() : undefined });
    },
  });

  // How to form the letter (Gemini, general ASL knowledge). Hidden until it arrives, and when Gemini is unsure or down.
  const [howTo, setHowTo] = useState<{ text: string; cached: boolean } | undefined>();
  useEffect(() => {
    setHowTo(undefined);
    let live = true;
    getHowTo(target).then((r) => live && r.text && setHowTo({ text: r.text, cached: !!r.cached })).catch(() => {});
    return () => { live = false; };
  }, [target]);

  // Once the target matches, the ring and bar stay full until "Try again" (retry() resets the check, so this goes back to live progress).
  const shownProgress = result === "match" ? 1 : check.progress;
  // Top bar: steps finished so far, plus this one once it matches, so the final step can reach 100%.
  const barProgress = Math.min(1, lessonProgress + (result === "match" ? stepSize : 0));
  const noLiveCheck = item.kind === "learn" && item.referenceOnly;
  const moving = target === "J" || target === "Z"; // these are drawn in the air, so a still camera frame can never check them
  const camera = noLiveCheck ? (
    <div className="card">
      {moving ? (
        <p><strong>{target} moves, so the camera can't check it.</strong> Watch the motion in a Deaf-led source such as Lifeprint (lifeprint.com), copy it, then continue.</p>
      ) : (
        <>
          <p><strong>No live check for {target} yet.</strong> It is reference only until the letter passes the Letter gate.</p>
          <p><a href="#/camera-demo">Try the camera and coach in the demo</a></p>
        </>
      )}
    </div>
  ) : (
    <>
      <Camera {...check.cam} progress={shownProgress} />
      {check.hint && <p role="status">{check.hint}</p>}
    </>
  );
  const reference = (
    <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
      <HandModel3D pose={meanPose3D(target, check.templates, leftHanded)} letter={target} />
    </Suspense>
  );
  const common = { target, reference, camera, landmarkTip, coachTip: coach.tip, coachCached: coach.cached, sideBySide, stepLabel, lessonProgress: barProgress, howTo };

  if (item.kind === "learn")
    return (
      <LessonView {...common} title={`Learn ${item.letter}`} showReference progress={0}
        status={item.referenceOnly ? (moving ? `${item.letter} moves: learn the motion, then continue.` : "Reference only, coming later") : `This is ${item.letter}. Try it, then continue.`}
        actionLabel="Continue" onAction={onNext} />
    );

  return (
    <LessonView {...common} title={item.word ? `Spell ${item.word.letters.join("")}` : `Sign ${item.letter}`} word={item.word}
      showReference={item.showReference || sideBySide} progress={shownProgress}
      status={status || `Hold the sign for ${target}`} feedback={result || undefined}
      actionLabel="Continue" actionDisabled={result !== "match"} onAction={onNext}
      onRetry={result === "match" ? retry : undefined} onSkip={result === "match" ? undefined : onNext} />
  );
}
